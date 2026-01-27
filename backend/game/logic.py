"""Game logic for dominoes."""
import random
from datetime import datetime
from typing import Optional
from .models import Domino, Game, GameStatus, Player, PlayedDomino, BoardEnds


def generate_domino_set() -> list[Domino]:
    """Generate a full set of 28 dominoes (double-six)."""
    dominoes = []
    for i in range(7):
        for j in range(i, 7):
            dominoes.append(Domino(left=i, right=j))
    return dominoes


def shuffle_and_deal(game: Game) -> None:
    """Shuffle dominoes and deal to players."""
    all_dominoes = generate_domino_set()
    random.shuffle(all_dominoes)

    # Standard Puerto Rican dominoes: 6 tiles per player
    # Remaining tiles form the boneyard (inaccessible, shown face-down)
    tiles_per_player = 6

    for player in game.players:
        player.hand = all_dominoes[:tiles_per_player]
        all_dominoes = all_dominoes[tiles_per_player:]

    # Remaining tiles go to boneyard (for draw variant)
    game.boneyard = all_dominoes


def find_starting_player(game: Game) -> str:
    """Find the player with the highest double to start."""
    best_player_id = None
    best_double = -1

    for player in game.players:
        for domino in player.hand:
            if domino.is_double() and domino.left > best_double:
                best_double = domino.left
                best_player_id = player.id

    # If no doubles, find highest total
    if best_player_id is None:
        best_total = -1
        for player in game.players:
            for domino in player.hand:
                if domino.total() > best_total:
                    best_total = domino.total()
                    best_player_id = player.id

    return best_player_id


def start_game(game: Game, starting_player_id: str | None = None) -> None:
    """Initialize and start the game - enters PICKING phase.

    Args:
        game: The game to start
        starting_player_id: Optional player ID to start (used after picking complete).
    """
    # Generate and shuffle tiles for picking - assign to fixed grid positions
    all_dominoes = generate_domino_set()
    random.shuffle(all_dominoes)
    game.picking_tiles = {i: tile for i, tile in enumerate(all_dominoes)}

    # Clear hands for picking
    for player in game.players:
        player.hand = []

    game.board = []
    game.boneyard = []
    game.ends = BoardEnds()
    game.status = GameStatus.PICKING
    game.current_turn = None  # No turn order during picking
    game.turn_started_at = None
    game.picking_started_at = datetime.utcnow()  # Start picking timer


def start_playing_phase(game: Game, starting_player_id: str | None = None) -> None:
    """Transition from PICKING to PLAYING phase.

    Args:
        game: The game to start playing
        starting_player_id: Optional player ID to start. If None, uses highest double rule.
    """
    # Remaining tiles go to boneyard
    game.boneyard = list(game.picking_tiles.values())
    game.picking_tiles = {}
    game.picking_started_at = None

    # Use provided starting player or find by highest double
    if starting_player_id and game.get_player(starting_player_id):
        game.current_turn = starting_player_id
    else:
        game.current_turn = find_starting_player(game)

    game.status = GameStatus.PLAYING
    game.turn_started_at = datetime.utcnow()  # Start turn timer


def can_play_on_side(domino: Domino, end_value: Optional[int]) -> bool:
    """Check if a domino can be played on a given end value."""
    if end_value is None:
        return True
    return domino.left == end_value or domino.right == end_value


def get_valid_moves(game: Game, player_id: str) -> list[tuple[Domino, str]]:
    """Get all valid moves for a player. Returns list of (domino, side)."""
    player = game.get_player(player_id)
    if not player:
        return []

    if not game.board:
        # First move - any tile can be played
        return [(d, "left") for d in player.hand]

    valid_moves = []
    for domino in player.hand:
        if can_play_on_side(domino, game.ends.left):
            valid_moves.append((domino, "left"))
        if can_play_on_side(domino, game.ends.right) and game.ends.left != game.ends.right:
            valid_moves.append((domino, "right"))

    return valid_moves


def has_valid_move(game: Game, player_id: str) -> bool:
    """Check if a player has any valid moves."""
    return len(get_valid_moves(game, player_id)) > 0


def play_tile(game: Game, player_id: str, domino: Domino, side: str) -> tuple[bool, str]:
    """
    Play a tile on the board.
    Returns (success, message).
    """
    if game.status != GameStatus.PLAYING:
        return False, "Game is not in progress"

    if game.current_turn != player_id:
        return False, "It's not your turn"

    player = game.get_player(player_id)
    if not player:
        return False, "Player not found"

    # Find the domino in player's hand
    hand_domino = None
    for d in player.hand:
        if d == domino:
            hand_domino = d
            break

    if not hand_domino:
        return False, "You don't have that domino"

    # First tile
    if not game.board:
        game.board.append(PlayedDomino(domino=domino, position=0))
        game.ends = BoardEnds(left=domino.left, right=domino.right)
        player.hand.remove(hand_domino)
        advance_turn(game)
        check_game_over(game)
        return True, "Tile played"

    # Validate and play
    if side == "left":
        target_value = game.ends.left
        if not can_play_on_side(domino, target_value):
            return False, f"Domino doesn't match left end ({target_value})"

        # Orient the domino correctly
        if domino.right == target_value:
            played_domino = domino
        else:
            played_domino = domino.flipped()

        game.board.insert(0, PlayedDomino(domino=played_domino, position=0))
        game.ends.left = played_domino.left

    elif side == "right":
        target_value = game.ends.right
        if not can_play_on_side(domino, target_value):
            return False, f"Domino doesn't match right end ({target_value})"

        # Orient the domino correctly
        if domino.left == target_value:
            played_domino = domino
        else:
            played_domino = domino.flipped()

        game.board.append(PlayedDomino(domino=played_domino, position=len(game.board)))
        game.ends.right = played_domino.right

    else:
        return False, "Invalid side (must be 'left' or 'right')"

    player.hand.remove(hand_domino)
    advance_turn(game)
    check_game_over(game)
    return True, "Tile played"


def pass_turn(game: Game, player_id: str) -> tuple[bool, str]:
    """
    Pass the turn (only valid if no moves available).
    Returns (success, message).
    """
    if game.status != GameStatus.PLAYING:
        return False, "Game is not in progress"

    if game.current_turn != player_id:
        return False, "It's not your turn"

    if has_valid_move(game, player_id):
        return False, "You have valid moves available"

    advance_turn(game)
    check_game_over(game)
    return True, "Turn passed"


def advance_turn(game: Game) -> None:
    """Advance to the next player's turn."""
    if not game.current_turn or not game.players:
        return

    current_index = game.get_player_index(game.current_turn)
    next_index = (current_index + 1) % len(game.players)
    game.current_turn = game.players[next_index].id
    game.turn_started_at = datetime.utcnow()  # Reset turn timer


def check_game_over(game: Game) -> bool:
    """
    Check if the game is over.
    Game ends when:
    - A player plays their last tile (they win)
    - All players are blocked (lowest hand total wins)
    """
    # Check if current player (who just played) won by emptying hand
    for player in game.players:
        if len(player.hand) == 0:
            game.status = GameStatus.FINISHED
            game.winner_id = player.id
            return True

    # Check if all players are blocked (no one can play)
    all_blocked = all(not has_valid_move(game, p.id) for p in game.players)
    if all_blocked:
        game.status = GameStatus.FINISHED
        # Winner is player with lowest hand total
        winner = min(game.players, key=lambda p: p.hand_total())
        game.winner_id = winner.id
        return True

    return False


def calculate_round_score(game: Game) -> dict[str, int]:
    """Calculate scores for a finished round."""
    scores = {}
    for player in game.players:
        scores[player.id] = player.hand_total()
    return scores


def calculate_round_points(game: Game) -> tuple[str, int, dict[str, int]]:
    """
    Calculate points awarded for a finished round.
    Returns (winner_id, points_awarded, remaining_pips).

    Scoring rules:
    - Winner gets sum of all opponents' remaining pips
    - In blocked game, lowest pip count wins, gets difference
    """
    remaining_pips = {p.id: p.hand_total() for p in game.players}
    winner_id = game.winner_id

    if not winner_id:
        return None, 0, remaining_pips

    winner = game.get_player(winner_id)

    # If winner has empty hand, they get all opponents' pips
    if winner and len(winner.hand) == 0:
        points = sum(pips for pid, pips in remaining_pips.items() if pid != winner_id)
    else:
        # Blocked game - winner (lowest pips) gets total of opponents minus their own
        winner_pips = remaining_pips.get(winner_id, 0)
        points = sum(pips for pid, pips in remaining_pips.items() if pid != winner_id) - winner_pips
        points = max(0, points)  # Ensure non-negative

    return winner_id, points, remaining_pips


def calculate_team_round_points(game: Game, team_a: list[str], team_b: list[str]) -> tuple[str, int, dict[str, int]]:
    """
    Calculate team points for a finished round.
    Returns (winning_team, points_awarded, remaining_pips).

    Team scoring:
    - Team pip count is sum of both teammates' remaining pips
    - Winning team gets losing team's total pips
    """
    remaining_pips = {p.id: p.hand_total() for p in game.players}

    team_a_pips = sum(remaining_pips.get(pid, 0) for pid in team_a)
    team_b_pips = sum(remaining_pips.get(pid, 0) for pid in team_b)

    winner_id = game.winner_id

    # Determine winning team
    if winner_id:
        if winner_id in team_a:
            winning_team = "team_a"
            # If player dominoed (empty hand), team gets all of opposing team's pips
            winner = game.get_player(winner_id)
            if winner and len(winner.hand) == 0:
                points = team_b_pips
            else:
                # Blocked - winning team gets difference
                points = max(0, team_b_pips - team_a_pips)
        else:
            winning_team = "team_b"
            winner = game.get_player(winner_id)
            if winner and len(winner.hand) == 0:
                points = team_a_pips
            else:
                points = max(0, team_a_pips - team_b_pips)
    else:
        # No winner (shouldn't happen)
        winning_team = None
        points = 0

    return winning_team, points, remaining_pips


def start_new_round(game: Game) -> None:
    """Reset game state for a new round within a match."""
    game.status = GameStatus.WAITING
    game.board = []
    game.boneyard = []
    game.ends = BoardEnds()
    game.winner_id = None
    game.picking_tiles = {}
    game.picking_started_at = None
    for player in game.players:
        player.hand = []
    # Don't reset scores or round_number - those are tracked by Match


def claim_tile(game: Game, player_id: str, grid_position: int) -> tuple[bool, str]:
    """
    Claim a face-down tile during the PICKING phase.
    Returns (success, message).

    Args:
        game: The game
        player_id: Player claiming the tile
        grid_position: Fixed grid position (0-27) of the tile to claim
    """
    if game.status != GameStatus.PICKING:
        return False, "Game is not in picking phase"

    player = game.get_player(player_id)
    if not player:
        return False, "Player not found"

    # Check if player already has 6 tiles
    if len(player.hand) >= 6:
        return False, "You already have 6 tiles"

    # Validate grid position has an available tile
    if grid_position not in game.picking_tiles:
        return False, "That tile is not available"

    # Remove tile from grid and add to player's hand
    tile = game.picking_tiles.pop(grid_position)
    player.hand.append(tile)

    # Check if picking is complete (all players have 6 tiles)
    if check_picking_complete(game):
        start_playing_phase(game)

    return True, "Tile claimed"


def check_picking_complete(game: Game) -> bool:
    """Check if all players have picked their 6 tiles."""
    return all(len(p.hand) >= 6 for p in game.players)


def cpu_claim_tile(game: Game, cpu_player_id: str) -> tuple[bool, str, int | None]:
    """
    Have a CPU player claim a random available tile.
    Returns (success, message, claimed_grid_position).
    """
    if game.status != GameStatus.PICKING:
        return False, "Game is not in picking phase", None

    player = game.get_player(cpu_player_id)
    if not player or not player.is_cpu:
        return False, "Not a CPU player", None

    if len(player.hand) >= 6:
        return False, "CPU already has 6 tiles", None

    if not game.picking_tiles:
        return False, "No tiles available", None

    # Pick a random available grid position
    grid_position = random.choice(list(game.picking_tiles.keys()))
    success, message = claim_tile(game, cpu_player_id, grid_position)
    return success, message, grid_position if success else None


def auto_assign_remaining_tiles(game: Game, player_id: str) -> list[int]:
    """
    Auto-assign random tiles to a player until they have 6.
    Used for picking timeout.
    Returns list of grid positions that were assigned.
    """
    player = game.get_player(player_id)
    if not player:
        return []

    assigned_positions = []
    while len(player.hand) < 6 and game.picking_tiles:
        grid_position = random.choice(list(game.picking_tiles.keys()))
        tile = game.picking_tiles.pop(grid_position)
        player.hand.append(tile)
        assigned_positions.append(grid_position)

    # Check if picking is complete
    if check_picking_complete(game):
        start_playing_phase(game)

    return assigned_positions
