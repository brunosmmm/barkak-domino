"""WebSocket connection manager."""
from fastapi import WebSocket
from typing import Optional
import json


class ConnectionManager:
    """Manages WebSocket connections for all games."""

    def __init__(self):
        # game_id -> {player_id -> WebSocket}
        self.connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, game_id: str, player_id: str):
        """Register a new connection."""
        await websocket.accept()
        if game_id not in self.connections:
            self.connections[game_id] = {}
        self.connections[game_id][player_id] = websocket

    def disconnect(self, game_id: str, player_id: str):
        """Remove a connection."""
        if game_id in self.connections:
            self.connections[game_id].pop(player_id, None)
            if not self.connections[game_id]:
                del self.connections[game_id]

    async def send_to_player(self, game_id: str, player_id: str, message: dict):
        """Send a message to a specific player."""
        if game_id in self.connections:
            ws = self.connections[game_id].get(player_id)
            if ws:
                await ws.send_json(message)

    async def broadcast_to_game(self, game_id: str, message: dict, exclude: Optional[str] = None):
        """Broadcast a message to all players in a game."""
        if game_id in self.connections:
            for player_id, ws in self.connections[game_id].items():
                if player_id != exclude:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass  # Connection might be closed

    def get_connection(self, game_id: str, player_id: str) -> Optional[WebSocket]:
        """Get a specific connection."""
        return self.connections.get(game_id, {}).get(player_id)

    def is_connected(self, game_id: str, player_id: str) -> bool:
        """Check if a player is connected."""
        return self.get_connection(game_id, player_id) is not None


# Global connection manager instance
manager = ConnectionManager()
