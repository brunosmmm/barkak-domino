"""Game room management."""
import random
from typing import Optional
from datetime import datetime, timedelta
from .models import (
    Game, Player, GameStatus, GameVariant, CreateGameRequest,
    Match, RoundResult, TeamScores, IndividualScores
)
from .logic import start_game, calculate_round_points, calculate_team_round_points, start_new_round
from .cpu import create_cpu_player, MONKEY_SPECIES

# Cleanup timeouts
WAITING_TIMEOUT = timedelta(minutes=30)  # Remove waiting games after 30 min with no humans
FINISHED_TIMEOUT = timedelta(minutes=5)  # Remove finished games after 5 min
INACTIVE_TIMEOUT = timedelta(minutes=60)  # Remove any game inactive for 1 hour


class GameRoomManager:
    """Manages game rooms in memory."""

    def __init__(self):
        self.games: dict[str, Game] = {}
        self.matches: dict[str, Match] = {}

    def create_game(self, request: CreateGameRequest) -> tuple[Game, Player]:
        """Create a new game and add the creator as first player."""
        game = Game(
            variant=request.variant,
            max_players=request.max_players
        )

        player = Player(name=request.player_name)
        game.players.append(player)

        # Add CPU players
        cpu_count = min(request.cpu_players, request.max_players - 1)
        for i in range(cpu_count):
            existing_names = [p.name for p in game.players]
            cpu_player = create_cpu_player(i, existing_names)
            game.players.append(cpu_player)

        self.games[game.id] = game
        return game, player

    def get_game(self, game_id: str) -> Optional[Game]:
        """Get a game by ID."""
        return self.games.get(game_id)

    def join_game(self, game_id: str, player_name: str) -> tuple[Optional[Game], Optional[Player], str]:
        """
        Join an existing game.
        Returns (game, player, error_message).
        """
        game = self.games.get(game_id)
        if not game:
            return None, None, "Game not found"

        if game.status != GameStatus.WAITING:
            return None, None, "Game has already started"

        if len(game.players) >= game.max_players:
            return None, None, "Game is full"

        # Check if name is already taken
        if any(p.name == player_name for p in game.players):
            return None, None, "Name already taken in this game"

        player = Player(name=player_name)
        game.players.append(player)

        # Auto-start when enough players (minimum 2)
        if len(game.players) >= 2 and len(game.players) == game.max_players:
            self.finalize_match_teams(game)
            start_game(game)

        return game, player, ""

    def add_cpu_player(self, game_id: str, player_id: str) -> tuple[bool, str, bool]:
        """
        Add a CPU player to a waiting game.
        Returns (success, message, game_started).
        """
        game = self.games.get(game_id)
        if not game:
            return False, "Game not found", False

        if game.status != GameStatus.WAITING:
            return False, "Game has already started", False

        # Only the first player (creator) can add CPUs
        if not game.players or game.players[0].id != player_id:
            return False, "Only the game creator can add CPU players", False

        if len(game.players) >= game.max_players:
            return False, "Game is full", False

        # Get existing names to avoid duplicates
        existing_names = [p.name for p in game.players]
        cpu_player = create_cpu_player(existing_names=existing_names)
        game.players.append(cpu_player)

        # Auto-start if full
        game_started = False
        if len(game.players) == game.max_players:
            self.finalize_match_teams(game)
            start_game(game)
            game_started = True

        return True, "", game_started

    def start_game_early(self, game_id: str, player_id: str) -> tuple[bool, str]:
        """Start a game before max players (if at least 2)."""
        game = self.games.get(game_id)
        if not game:
            return False, "Game not found"

        if game.status != GameStatus.WAITING:
            return False, "Game has already started"

        # Only the first player (creator) can start early
        if not game.players or game.players[0].id != player_id:
            return False, "Only the game creator can start early"

        if len(game.players) < 2:
            return False, "Need at least 2 players to start"

        self.finalize_match_teams(game)
        start_game(game)
        return True, ""

    def remove_player(self, game_id: str, player_id: str) -> bool:
        """Remove a player from a game."""
        game = self.games.get(game_id)
        if not game:
            return False

        player = game.get_player(player_id)
        if player:
            player.connected = False
            # Don't actually remove, just mark as disconnected
            # This allows reconnection
            return True
        return False

    def reconnect_player(self, game_id: str, player_id: str) -> Optional[Player]:
        """Reconnect a player to a game."""
        game = self.games.get(game_id)
        if not game:
            return None

        player = game.get_player(player_id)
        if player:
            player.connected = True
            return player
        return None

    def delete_game(self, game_id: str) -> bool:
        """Delete a game."""
        if game_id in self.games:
            del self.games[game_id]
            return True
        return False

    def list_open_games(self) -> list[Game]:
        """List all games that are waiting for players."""
        return [g for g in self.games.values() if g.status == GameStatus.WAITING]

    def list_active_games(self) -> list[Game]:
        """List all games that are currently being played."""
        return [g for g in self.games.values() if g.status == GameStatus.PLAYING]

    def cleanup_stale_games(self) -> tuple[int, list[str]]:
        """
        Remove stale games based on various conditions.
        Returns (count_removed, list_of_removed_ids).
        """
        now = datetime.utcnow()
        to_remove = []
        reasons = []

        for game_id, game in self.games.items():
            reason = None

            # Any game inactive for too long
            if now - game.last_activity > INACTIVE_TIMEOUT:
                reason = "inactive"

            # Waiting games with no connected humans
            elif game.status == GameStatus.WAITING:
                if not game.has_connected_humans():
                    if now - game.last_activity > timedelta(minutes=2):
                        reason = "waiting_no_humans"

            # Finished games after timeout
            elif game.status == GameStatus.FINISHED:
                if now - game.last_activity > FINISHED_TIMEOUT:
                    reason = "finished"

            if reason:
                to_remove.append(game_id)
                reasons.append(f"{game_id}:{reason}")

        for game_id in to_remove:
            del self.games[game_id]

        return len(to_remove), reasons

    def get_stats(self) -> dict:
        """Get statistics about current games."""
        waiting = sum(1 for g in self.games.values() if g.status == GameStatus.WAITING)
        playing = sum(1 for g in self.games.values() if g.status == GameStatus.PLAYING)
        finished = sum(1 for g in self.games.values() if g.status == GameStatus.FINISHED)
        return {
            "total": len(self.games),
            "waiting": waiting,
            "playing": playing,
            "finished": finished
        }


    # ==================== MATCH MANAGEMENT ====================

    def create_match(self, game: Game, target_score: int = 100) -> Match:
        """Create a match wrapper for multi-round play."""
        match = Match(target_score=target_score)
        match.current_game = game

        # Store player info (will be updated when game starts if more players join)
        for player in game.players:
            match.player_names[player.id] = player.name
            match.player_positions.append(player.id)

        # Teams are set up later when game starts (finalize_match_teams)
        # to ensure we have all players present
        match.is_team_game = False
        # Initialize individual scores (will be replaced with team scores if 4 players)
        for player in game.players:
            match.individual_scores.scores[player.id] = 0

        # Store match reference in game
        game.match_id = match.id
        self.matches[match.id] = match
        return match

    def finalize_match_teams(self, game: Game) -> None:
        """
        Set up teams for the match when the game starts.
        This is called after all players have joined, not at game creation.
        """
        match = self.get_match_for_game(game.id)
        if not match:
            return

        # Update player info for any new players that joined after match creation
        for player in game.players:
            if player.id not in match.player_names:
                match.player_names[player.id] = player.name
                match.player_positions.append(player.id)
                match.individual_scores.scores[player.id] = 0

        # Randomly select 4 unique avatars from available pool (excluding removed avatars)
        if not match.avatar_ids:
            available_avatars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 20]
            match.avatar_ids = random.sample(available_avatars, min(4, len(game.players)))

        # Set up teams for 4 players
        if len(game.players) == 4:
            match.is_team_game = True
            # Opposite seats are teammates: 0+2 vs 1+3
            match.team_a = [game.players[0].id, game.players[2].id]
            match.team_b = [game.players[1].id, game.players[3].id]

            # Randomly select team names (exclude bot names to avoid confusion)
            bot_names = [p.name for p in game.players if p.is_cpu]
            available_names = [n for n in MONKEY_SPECIES if n not in bot_names]
            if len(available_names) >= 2:
                team_names = random.sample(available_names, 2)
                match.team_a_name = team_names[0]
                match.team_b_name = team_names[1]

            # Clear individual scores since we're using team scores
            match.individual_scores.scores.clear()

    def get_match(self, match_id: str) -> Optional[Match]:
        """Get a match by ID."""
        return self.matches.get(match_id)

    def get_match_for_game(self, game_id: str) -> Optional[Match]:
        """Get the match that contains a game."""
        game = self.get_game(game_id)
        if game and hasattr(game, 'match_id') and game.match_id:
            return self.matches.get(game.match_id)
        return None

    def complete_round(self, match: Match) -> RoundResult:
        """
        Process end of round, calculate scores, return result.
        """
        game = match.current_game
        if not game or game.status != GameStatus.FINISHED:
            return None

        round_number = len(match.completed_rounds) + 1

        # Check if game was blocked (all players have tiles)
        was_blocked = all(len(p.hand) > 0 for p in game.players)

        if match.is_team_game:
            winning_team, points, remaining_pips = calculate_team_round_points(
                game, match.team_a, match.team_b
            )

            # Update team scores
            if winning_team == "team_a":
                match.team_scores.team_a += points
            elif winning_team == "team_b":
                match.team_scores.team_b += points

            result = RoundResult(
                round_number=round_number,
                winner_id=game.winner_id,
                winner_team=winning_team,
                points_awarded=points,
                remaining_pips=remaining_pips,
                was_blocked=was_blocked
            )
        else:
            winner_id, points, remaining_pips = calculate_round_points(game)

            # Update individual scores
            if winner_id:
                current = match.individual_scores.scores.get(winner_id, 0)
                match.individual_scores.scores[winner_id] = current + points

            result = RoundResult(
                round_number=round_number,
                winner_id=winner_id,
                winner_team=None,
                points_awarded=points,
                remaining_pips=remaining_pips,
                was_blocked=was_blocked
            )

        match.completed_rounds.append(result)
        match.touch()
        return result

    def start_next_round(self, match: Match) -> bool:
        """
        Start a new round in the match.
        Returns True if new round started, False if match is over.
        """
        # Check if match is over
        if match.get_winner():
            return False

        game = match.current_game
        if not game:
            return False

        # Get the previous round winner to start the next round
        previous_winner_id = None
        if match.completed_rounds:
            previous_winner_id = match.completed_rounds[-1].winner_id

        # Reset game state for new round
        start_new_round(game)
        game.round_number = len(match.completed_rounds) + 1

        # Start the game - previous round winner starts
        start_game(game, starting_player_id=previous_winner_id)
        match.touch()
        return True

    def get_match_state(self, match: Match) -> dict:
        """Get serializable match state for frontend."""
        return {
            "id": match.id,
            "is_team_game": match.is_team_game,
            "target_score": match.target_score,
            "current_round": len(match.completed_rounds) + 1,
            "scores": match.get_current_scores(),
            "team_a": match.team_a if match.is_team_game else [],
            "team_b": match.team_b if match.is_team_game else [],
            "team_a_name": match.team_a_name if match.is_team_game else "",
            "team_b_name": match.team_b_name if match.is_team_game else "",
            "player_positions": match.player_positions,
            "player_names": match.player_names,
            "avatar_ids": match.avatar_ids,  # Randomly selected avatars for positions 0-3
            "completed_rounds": [
                {
                    "round_number": r.round_number,
                    "winner_id": r.winner_id,
                    "winner_team": r.winner_team,
                    "points_awarded": r.points_awarded,
                    "remaining_pips": r.remaining_pips,
                    "was_blocked": r.was_blocked
                }
                for r in match.completed_rounds
            ],
            "match_winner": match.get_winner()
        }


# Global room manager instance
room_manager = GameRoomManager()
