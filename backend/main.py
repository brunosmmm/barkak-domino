"""FastAPI application for multiplayer dominoes."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import json
import os

from game.models import (
    Game, CreateGameRequest, JoinGameRequest, PlayTileRequest,
    Domino, GameStatus, Match
)
from game.logic import play_tile, pass_turn, start_game, get_valid_moves
from game.manager import manager
from game.rooms import room_manager
from game.cpu import is_cpu_turn, execute_cpu_turn
import asyncio
import random


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("Dominoes server starting...")
    # Start background cleanup task
    cleanup = asyncio.create_task(cleanup_task())
    yield
    # Cancel cleanup task on shutdown
    cleanup.cancel()
    try:
        await cleanup
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
        # Send initial game state
        await send_game_state(game_id, player_id)

        # Notify others of reconnection/join
        await manager.broadcast_to_game(
            game_id,
            {"type": "player_connected", "player_id": player_id, "player_name": player.name},
            exclude=player_id
        )

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
        "match": match_state
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
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
