"""CPU player AI logic."""
import random
from typing import Optional
from .models import Game, Player, Domino
from .logic import get_valid_moves, play_tile, pass_turn

# CPU player names
CPU_NAMES = ["Bot Alice", "Bot Bob", "Bot Carol", "Bot Dave"]


def create_cpu_player(index: int = 0) -> Player:
    """Create a CPU player with a name."""
    name = CPU_NAMES[index % len(CPU_NAMES)]
    return Player(name=name, is_cpu=True, connected=True)


def get_cpu_move(game: Game, player_id: str) -> Optional[tuple[Domino, str]]:
    """
    Determine the best move for a CPU player.
    Uses a simple strategy:
    1. Play doubles first (to get rid of them)
    2. Play highest-value tiles
    3. If tied, prefer moves that match our other tiles
    """
    valid_moves = get_valid_moves(game, player_id)

    if not valid_moves:
        return None

    player = game.get_player(player_id)
    if not player:
        return None

    # Score each move
    scored_moves = []
    for domino, side in valid_moves:
        score = 0

        # Prefer doubles (get rid of them early)
        if domino.is_double():
            score += 10

        # Prefer higher value tiles
        score += domino.total()

        # Slight bonus if we have other tiles matching this domino's values
        # This helps keep options open
        for other in player.hand:
            if other != domino:
                if other.left in (domino.left, domino.right) or other.right in (domino.left, domino.right):
                    score += 1

        scored_moves.append((score, domino, side))

    # Sort by score descending, add some randomness for ties
    scored_moves.sort(key=lambda x: (x[0], random.random()), reverse=True)

    _, best_domino, best_side = scored_moves[0]
    return (best_domino, best_side)


async def execute_cpu_turn(game: Game, player_id: str) -> tuple[bool, str, Optional[tuple[Domino, str]]]:
    """
    Execute a CPU player's turn.
    Returns (success, message, move) where move is (domino, side) or None if passed.
    """
    move = get_cpu_move(game, player_id)

    if move:
        domino, side = move
        success, message = play_tile(game, player_id, domino, side)
        return success, message, move
    else:
        success, message = pass_turn(game, player_id)
        return success, message, None


def is_cpu_turn(game: Game) -> bool:
    """Check if it's a CPU player's turn."""
    if not game.current_turn:
        return False
    player = game.get_player(game.current_turn)
    return player is not None and player.is_cpu
