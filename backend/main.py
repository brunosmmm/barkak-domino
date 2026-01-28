"""FastAPI application for multiplayer dominoes."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from datetime import datetime
import json
import os

from game.models import (
    Game, CreateGameRequest, JoinGameRequest, PlayTileRequest,
    Domino, GameStatus, Match
)
from game.logic import play_tile, pass_turn, start_game, get_valid_moves, has_valid_move, claim_tile, cpu_claim_tile, check_picking_complete, auto_assign_remaining_tiles
from game.manager import manager
from game.rooms import room_manager
from game.cpu import is_cpu_turn, execute_cpu_turn
import asyncio
import random

# Track games with active CPU picking tasks to prevent concurrent task spawning
_cpu_picking_active: set[str] = set()

# Test mode - set TEST_MODE=1 to make CPUs pick instantly
TEST_MODE = os.environ.get("TEST_MODE", "0") == "1"


async def cleanup_task():
    """Background task to periodically clean up stale games."""
    while True:
        await asyncio.sleep(60)  # Run every minute
        try:
            count, reasons = room_manager.cleanup_stale_games()
            if count > 0:
                print(f"Cleaned up {count} stale games: {reasons}")
        except Exception as e:
            print(f"Cleanup error: {e}")


async def picking_timer_task():
    """Background task to check for picking phase timeouts."""
    while True:
        await asyncio.sleep(5)  # Check every 5 seconds
        try:
            for game in room_manager.list_active_games():
                if game.status != GameStatus.PICKING:
                    continue
                if not game.picking_started_at:
                    continue

                elapsed = (datetime.utcnow() - game.picking_started_at).total_seconds()
                if elapsed >= game.picking_timeout:
                    await handle_picking_timeout(game.id)
        except Exception as e:
            print(f"Picking timer error: {e}")


async def handle_picking_timeout(game_id: str):
    """Handle picking timeout - auto-assign remaining tiles to players who haven't picked enough."""
    game = room_manager.get_game(game_id)
    if not game or game.status != GameStatus.PICKING:
        return

    # Find players who need more tiles (humans only - CPUs should have picked already)
    for player in game.players:
        if not player.is_cpu and len(player.hand) < 6:
            assigned = auto_assign_remaining_tiles(game, player.id)
            if assigned:
                # Notify about auto-assignment
                await manager.broadcast_to_game(game_id, {
                    "type": "tiles_auto_assigned",
                    "player_id": player.id,
                    "positions": assigned,
                    "reason": "timeout"
                })

    await broadcast_game_state(game_id)

    # If picking is now complete (transitioned to PLAYING), notify
    if game.status == GameStatus.PLAYING:
        await manager.broadcast_to_game(game_id, {"type": "game_started"})
        await process_cpu_turns(game_id)


async def turn_timer_task():
    """Background task to check for turn timeouts and auto-play."""
    while True:
        await asyncio.sleep(1)  # Check every second
        try:
            for game in room_manager.list_active_games():
                if game.status != GameStatus.PLAYING:
                    continue
                if game.turn_timeout <= 0:
                    continue
                if not game.turn_started_at:
                    continue
                # Skip CPU turns - they handle themselves
                if is_cpu_turn(game):
                    continue

                # Only enforce timeout for connected players
                current_player = game.get_player(game.current_turn)
                if not current_player or not current_player.connected:
                    continue

                elapsed = (datetime.utcnow() - game.turn_started_at).total_seconds()
                if elapsed >= game.turn_timeout:
                    await handle_turn_timeout(game.id)
        except Exception as e:
            print(f"Turn timer error: {e}")


async def handle_turn_timeout(game_id: str):
    """Handle a turn timeout by auto-playing or passing."""
    game = room_manager.get_game(game_id)
    if not game or game.status != GameStatus.PLAYING:
        return

    player_id = game.current_turn
    if not player_id:
        return

    player = game.get_player(player_id)
    if not player or player.is_cpu:
        return

    # Get valid moves
    valid_moves = get_valid_moves(game, player_id)

    if valid_moves:
        # Auto-play a random valid move
        domino, side = random.choice(valid_moves)
        success, _ = play_tile(game, player_id, domino, side)

        if success:
            await manager.broadcast_to_game(game_id, {
                "type": "tile_played",
                "player_id": player_id,
                "domino": {"left": domino.left, "right": domino.right},
                "side": side,
                "auto_played": True  # Flag that this was auto-played due to timeout
            })
            await broadcast_game_state(game_id)

            if game.status == GameStatus.FINISHED:
                await handle_round_end(game_id, game)
            else:
                await process_cpu_turns(game_id)
    else:
        # No valid moves - auto-pass
        success, _ = pass_turn(game, player_id)

        if success:
            await manager.broadcast_to_game(game_id, {
                "type": "turn_passed",
                "player_id": player_id,
                "auto_passed": True  # Flag that this was auto-passed due to timeout
            })
            await broadcast_game_state(game_id)

            if game.status == GameStatus.FINISHED:
                await handle_round_end(game_id, game)
            else:
                await process_cpu_turns(game_id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("Dominoes server starting...")
    # Start background tasks
    cleanup = asyncio.create_task(cleanup_task())
    turn_timer = asyncio.create_task(turn_timer_task())
    picking_timer = asyncio.create_task(picking_timer_task())
    yield
    # Cancel background tasks on shutdown
    cleanup.cancel()
    turn_timer.cancel()
    picking_timer.cancel()
    try:
        await cleanup
    except asyncio.CancelledError:
        pass
    try:
        await turn_timer
    except asyncio.CancelledError:
        pass
    try:
        await picking_timer
    except asyncio.CancelledError:
        pass
    print("Dominoes server shutting down...")


app = FastAPI(title="Dominoes Multiplayer", lifespan=lifespan)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# REST endpoints for game management

@app.get("/api/games")
async def list_games():
    """List all open games."""
    games = room_manager.list_open_games()
    return {
        "games": [
            {
                "id": g.id,
                "variant": g.variant,
                "players": len(g.players),
                "max_players": g.max_players,
                "player_names": [p.name for p in g.players]
            }
            for g in games
        ]
    }


@app.post("/api/games")
async def create_game(request: CreateGameRequest):
    """Create a new game."""
    game, player = room_manager.create_game(request)

    # Create match wrapper for multi-round play
    match = room_manager.create_match(game, target_score=request.target_score)

    # Auto-start if game is full (e.g., 1 human + 3 CPUs = 4 players)
    if len(game.players) == game.max_players:
        room_manager.finalize_match_teams(game)
        start_game(game)

    return {
        "game_id": game.id,
        "player_id": player.id,
        "player_name": player.name,
        "match_id": match.id
    }


@app.get("/api/games/{game_id}")
async def get_game(game_id: str):
    """Get game info."""
    game = room_manager.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return {
        "id": game.id,
        "variant": game.variant,
        "status": game.status,
        "players": len(game.players),
        "max_players": game.max_players,
        "player_names": [p.name for p in game.players]
    }


@app.get("/api/stats")
async def get_stats():
    """Get server statistics."""
    return room_manager.get_stats()


# WebSocket endpoint

@app.websocket("/ws/{game_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str, player_id: str):
    """WebSocket connection for game play."""
    game = room_manager.get_game(game_id)
    if not game:
        await websocket.close(code=4004, reason="Game not found")
        return

    player = game.get_player(player_id)
    if not player:
        await websocket.close(code=4004, reason="Player not found")
        return

    await manager.connect(websocket, game_id, player_id)
    player.connected = True

    try:
        # If it's this player's turn and they just connected, reset their turn timer
        # This handles the case where game auto-started before player connected
        if game.status == GameStatus.PLAYING and game.current_turn == player_id:
            game.turn_started_at = datetime.utcnow()

        # Send initial game state
        await send_game_state(game_id, player_id)

        # Notify others of reconnection/join
        await manager.broadcast_to_game(
            game_id,
            {"type": "player_connected", "player_id": player_id, "player_name": player.name},
            exclude=player_id
        )

        # If game is in picking phase, start CPU tile claims in background
        # (don't await - that would block the message handler)
        if game.status == GameStatus.PICKING:
            asyncio.create_task(process_cpu_tile_claims(game_id))
        # If game is already playing and it's a CPU's turn, process CPU turns
        # (handles auto-start scenario where CPU should play first)
        elif game.status == GameStatus.PLAYING and is_cpu_turn(game):
            await process_cpu_turns(game_id)

        # Handle messages
        while True:
            data = await websocket.receive_json()
            await handle_message(game_id, player_id, data)

    except WebSocketDisconnect:
        manager.disconnect(game_id, player_id)
        if player:
            player.connected = False
        await manager.broadcast_to_game(
            game_id,
            {"type": "player_disconnected", "player_id": player_id}
        )


async def handle_message(game_id: str, player_id: str, data: dict):
    """Handle incoming WebSocket messages."""
    msg_type = data.get("type")
    game = room_manager.get_game(game_id)

    if not game:
        await manager.send_to_player(game_id, player_id, {
            "type": "error",
            "message": "Game not found"
        })
        return

    # Update activity timestamp on any message
    game.touch()

    if msg_type == "play_tile":
        domino_data = data.get("domino", {})
        domino = Domino(left=domino_data.get("left", 0), right=domino_data.get("right", 0))
        side = data.get("side", "left")

        success, message = play_tile(game, player_id, domino, side)

        if success:
            # Broadcast the move to all players
            await manager.broadcast_to_game(game_id, {
                "type": "tile_played",
                "player_id": player_id,
                "domino": {"left": domino.left, "right": domino.right},
                "side": side
            })

            # Send updated game state to all
            await broadcast_game_state(game_id)

            # Check for game over (round end)
            if game.status == GameStatus.FINISHED:
                await handle_round_end(game_id, game)
            else:
                # Process CPU turns
                await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": message
            })

    elif msg_type == "pass_turn":
        success, message = pass_turn(game, player_id)

        if success:
            await manager.broadcast_to_game(game_id, {
                "type": "turn_passed",
                "player_id": player_id
            })
            await broadcast_game_state(game_id)

            if game.status == GameStatus.FINISHED:
                await handle_round_end(game_id, game)
            else:
                # Process CPU turns
                await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": message
            })

    elif msg_type == "start_game":
        success, message = room_manager.start_game_early(game_id, player_id)

        if success:
            await manager.broadcast_to_game(game_id, {
                "type": "game_started"
            })
            await broadcast_game_state(game_id)
            # Process CPU turns if CPU starts
            await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": message
            })

    elif msg_type == "add_cpu":
        success, message, game_started = room_manager.add_cpu_player(game_id, player_id)

        if success:
            await manager.broadcast_to_game(game_id, {
                "type": "cpu_added",
                "player_count": len(game.players)
            })
            await broadcast_game_state(game_id)

            if game_started:
                await manager.broadcast_to_game(game_id, {"type": "game_started"})
                await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": message
            })

    elif msg_type == "claim_tile":
        tile_index = data.get("tile_index")
        if tile_index is None:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "Missing tile_index"
            })
            return

        success, message = claim_tile(game, player_id, tile_index)

        if success:
            # Broadcast that a tile was claimed
            await manager.broadcast_to_game(game_id, {
                "type": "tile_claimed",
                "player_id": player_id,
                "tile_index": tile_index
            })

            # Broadcast updated game state
            await broadcast_game_state(game_id)

            # If picking is complete, continue CPU claiming in background
            if game.status == GameStatus.PICKING:
                asyncio.create_task(process_cpu_tile_claims(game_id))
            elif game.status == GameStatus.PLAYING:
                await manager.broadcast_to_game(game_id, {"type": "game_started"})
                await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": message
            })

    elif msg_type == "get_valid_moves":
        moves = get_valid_moves(game, player_id)
        await manager.send_to_player(game_id, player_id, {
            "type": "valid_moves",
            "moves": [
                {"domino": {"left": d.left, "right": d.right}, "side": s}
                for d, s in moves
            ]
        })

    elif msg_type == "reaction":
        # Send emoji reaction to all players
        emoji = data.get("emoji", "👍")
        player = game.get_player(player_id)
        player_name = player.name if player else "Unknown"

        await manager.broadcast_to_game(game_id, {
            "type": "reaction",
            "player_id": player_id,
            "player_name": player_name,
            "emoji": emoji
        })

    elif msg_type == "next_round":
        # Start next round in a match
        match = room_manager.get_match_for_game(game_id)
        if not match:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "No match found for this game"
            })
            return

        if game.status != GameStatus.FINISHED:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "Current round is not finished"
            })
            return

        # Only the first player (creator) can start next round
        if not game.players or game.players[0].id != player_id:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "Only the game creator can start the next round"
            })
            return

        # Check if match is over
        if match.get_winner():
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "Match is already over"
            })
            return

        # Start next round
        if room_manager.start_next_round(match):
            await manager.broadcast_to_game(game_id, {
                "type": "round_started",
                "round_number": game.round_number
            })
            await broadcast_game_state(game_id)
            # Process CPU turns if CPU starts
            await process_cpu_turns(game_id)
        else:
            await manager.send_to_player(game_id, player_id, {
                "type": "error",
                "message": "Could not start next round"
            })

    else:
        await manager.send_to_player(game_id, player_id, {
            "type": "error",
            "message": f"Unknown message type: {msg_type}"
        })


async def handle_round_end(game_id: str, game: Game):
    """Handle the end of a round, process scoring, broadcast results."""
    match = room_manager.get_match_for_game(game_id)

    winner = game.get_player(game.winner_id) if game.winner_id else None

    if match:
        # Process round in match context
        round_result = room_manager.complete_round(match)
        match_winner = match.get_winner()

        await manager.broadcast_to_game(game_id, {
            "type": "round_over",
            "round_number": round_result.round_number if round_result else 1,
            "winner_id": game.winner_id,
            "winner_name": winner.name if winner else None,
            "winner_team": round_result.winner_team if round_result else None,
            "points_awarded": round_result.points_awarded if round_result else 0,
            "remaining_pips": round_result.remaining_pips if round_result else {},
            "was_blocked": round_result.was_blocked if round_result else False,
            "scores": match.get_current_scores(),
            "match_winner": match_winner,
            "is_team_game": match.is_team_game
        })

        if match_winner:
            # Match is over
            await manager.broadcast_to_game(game_id, {
                "type": "match_over",
                "winner": match_winner,
                "is_team_game": match.is_team_game,
                "final_scores": match.get_current_scores(),
                "total_rounds": len(match.completed_rounds)
            })
    else:
        # Single game mode (no match)
        await manager.broadcast_to_game(game_id, {
            "type": "game_over",
            "winner_id": game.winner_id,
            "winner_name": winner.name if winner else None
        })


async def process_cpu_turns(game_id: str):
    """Process all consecutive CPU turns."""
    game = room_manager.get_game(game_id)
    if not game or game.status != GameStatus.PLAYING:
        return

    while is_cpu_turn(game):
        # Add a random delay for UX (feels more human-like)
        # In TEST_MODE, play instantly
        if not TEST_MODE:
            delay = random.uniform(5.0, 20.0)
            await asyncio.sleep(delay)

        cpu_player_id = game.current_turn
        success, message, move = await execute_cpu_turn(game, cpu_player_id)

        if success:
            if move:
                domino, side = move
                await manager.broadcast_to_game(game_id, {
                    "type": "tile_played",
                    "player_id": cpu_player_id,
                    "domino": {"left": domino.left, "right": domino.right},
                    "side": side
                })
            else:
                await manager.broadcast_to_game(game_id, {
                    "type": "turn_passed",
                    "player_id": cpu_player_id
                })

            await broadcast_game_state(game_id)

            if game.status == GameStatus.FINISHED:
                await handle_round_end(game_id, game)
                break
        else:
            # CPU failed to make a move (shouldn't happen)
            break


async def process_cpu_tile_claims(game_id: str):
    """Process tile claims for all CPU players during picking phase.

    CPUs pick simultaneously with humans but with delays to give
    humans a fair chance. This runs as a background task and picks
    one tile at a time (round-robin across CPUs) until all have 6.
    """
    # Prevent multiple concurrent tasks for the same game
    if game_id in _cpu_picking_active:
        return
    _cpu_picking_active.add(game_id)

    try:
        game = room_manager.get_game(game_id)
        if not game or game.status != GameStatus.PICKING:
            return

        # Keep picking until all CPUs have 6 tiles or game moves on
        while game and game.status == GameStatus.PICKING:
            # Find CPUs that still need tiles
            cpus_needing_tiles = [p for p in game.players if p.is_cpu and len(p.hand) < 6]
            if not cpus_needing_tiles:
                break

            # Pick one tile for ONE random CPU (round-robin would be predictable)
            cpu = random.choice(cpus_needing_tiles)

            # Delay before picking (1.5-3 seconds) - gives humans time to pick
            # In TEST_MODE, pick instantly
            if not TEST_MODE:
                delay = random.uniform(1.5, 3.0)
                await asyncio.sleep(delay)

            # Re-check game status after delay
            game = room_manager.get_game(game_id)
            if not game or game.status != GameStatus.PICKING:
                break

            success, message, tile_index = cpu_claim_tile(game, cpu.id)
            if success:
                await manager.broadcast_to_game(game_id, {
                    "type": "tile_claimed",
                    "player_id": cpu.id,
                    "tile_index": tile_index
                })
                await broadcast_game_state(game_id)

        # If picking complete, transition to playing
        if game and game.status == GameStatus.PLAYING:
            await manager.broadcast_to_game(game_id, {"type": "game_started"})
            await process_cpu_turns(game_id)
    finally:
        _cpu_picking_active.discard(game_id)


async def send_game_state(game_id: str, player_id: str):
    """Send full game state to a specific player."""
    game = room_manager.get_game(game_id)
    if not game:
        return

    # Create a sanitized view for this player
    state = create_player_game_view(game, player_id)
    await manager.send_to_player(game_id, player_id, {
        "type": "game_state",
        "state": state
    })


async def broadcast_game_state(game_id: str):
    """Broadcast game state to all players (each gets their own view)."""
    game = room_manager.get_game(game_id)
    if not game:
        return

    for player in game.players:
        if manager.is_connected(game_id, player.id):
            state = create_player_game_view(game, player.id)
            await manager.send_to_player(game_id, player.id, {
                "type": "game_state",
                "state": state
            })


def create_player_game_view(game: Game, player_id: str) -> dict:
    """Create a game state view for a specific player (hide other hands)."""
    player = game.get_player(player_id)

    # Get match info if available
    match_state = None
    if game.match_id:
        match = room_manager.get_match(game.match_id)
        if match:
            match_state = room_manager.get_match_state(match)

    # Calculate turn timer info
    turn_timer_info = None
    if game.turn_timeout > 0 and game.turn_started_at and game.status == GameStatus.PLAYING:
        elapsed = (datetime.utcnow() - game.turn_started_at).total_seconds()
        remaining = max(0, game.turn_timeout - elapsed)
        turn_timer_info = {
            "timeout": game.turn_timeout,
            "remaining": round(remaining, 1),
            "started_at": game.turn_started_at.isoformat() + "Z"
        }

    # Calculate picking timer info
    picking_timer_info = None
    if game.picking_started_at and game.status == GameStatus.PICKING:
        elapsed = (datetime.utcnow() - game.picking_started_at).total_seconds()
        remaining = max(0, game.picking_timeout - elapsed)
        picking_timer_info = {
            "timeout": game.picking_timeout,
            "remaining": round(remaining, 1),
            "started_at": game.picking_started_at.isoformat() + "Z"
        }

    return {
        "id": game.id,
        "variant": game.variant.value,
        "status": game.status.value,
        "current_turn": game.current_turn,
        "your_player_id": player_id,
        "your_hand": [{"left": d.left, "right": d.right} for d in player.hand] if player else [],
        "board": [
            {"domino": {"left": pd.domino.left, "right": pd.domino.right}, "position": pd.position}
            for pd in game.board
        ],
        "ends": {"left": game.ends.left, "right": game.ends.right},
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "tile_count": len(p.hand),
                "score": p.score,
                "connected": p.connected,
                "is_you": p.id == player_id,
                "is_cpu": p.is_cpu,
                "position": game.players.index(p)  # Seat position for table visualization
            }
            for p in game.players
        ],
        "winner_id": game.winner_id,
        "boneyard_count": len(game.boneyard),
        "round_number": game.round_number,
        "match": match_state,
        "turn_timer": turn_timer_info,
        "picking_timer": picking_timer_info,
        # Picking phase: grid positions that still have tiles (face-down)
        "available_tile_positions": list(game.picking_tiles.keys()) if game.status == GameStatus.PICKING else []
    }


# Join game via REST (returns player credentials for WebSocket)
@app.post("/api/games/{game_id}/join")
async def join_game(game_id: str, request: JoinGameRequest):
    """Join an existing game."""
    game, player, error = room_manager.join_game(game_id, request.player_name)

    if error:
        raise HTTPException(status_code=400, detail=error)

    # Notify existing players
    await manager.broadcast_to_game(game_id, {
        "type": "player_joined",
        "player_id": player.id,
        "player_name": player.name,
        "player_count": len(game.players)
    })

    # Always broadcast updated game state so waiting players see new count
    await broadcast_game_state(game_id)

    # If game auto-started, notify everyone
    if game.status == GameStatus.PLAYING:
        await manager.broadcast_to_game(game_id, {"type": "game_started"})

    return {
        "game_id": game.id,
        "player_id": player.id,
        "player_name": player.name
    }


# Serve frontend static files in production
# In Docker, backend is at /app and frontend dist is at /app/frontend/dist
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")
    # Serve images from public folder (copied to dist during build)
    images_dir = os.path.join(FRONTEND_DIR, "images")
    if os.path.exists(images_dir):
        app.mount("/images", StaticFiles(directory=images_dir), name="images")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
