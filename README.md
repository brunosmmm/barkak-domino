# Barkak Domino

A real-time multiplayer dominoes game with 2-4 players, supporting CPU opponents.

## Features

- **Block Game variant** - Classic dominoes rules
- **2-4 players** - Human or CPU opponents
- **Real-time multiplayer** - WebSocket-based communication
- **Responsive UI** - Works on desktop and tablet

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Python 3.11 + FastAPI + WebSockets

## Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies API and WebSocket requests to the backend.

## Deployment

### Using Docker

```bash
docker build -t barkak-domino .
docker run -p 8000:8000 barkak-domino
```

### Using fly.io

```bash
fly launch
fly deploy
```

## Game Rules (Block Game)

1. Each player starts with 7 tiles
2. The player with the highest double starts
3. Players take turns placing tiles that match an open end
4. If you can't play, pass your turn
5. First player to empty their hand wins
6. If all players are blocked, lowest hand total wins

## Architecture

```
barkak-domino/
├── backend/
│   ├── main.py          # FastAPI app, WebSocket handlers
│   ├── game/
│   │   ├── models.py    # Pydantic models
│   │   ├── logic.py     # Game rules engine
│   │   ├── cpu.py       # CPU player AI
│   │   ├── manager.py   # WebSocket connection manager
│   │   └── rooms.py     # Game room management
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks (useWebSocket)
│   │   └── store/       # Zustand game store
│   └── package.json
├── Dockerfile
├── fly.toml
└── README.md
```

## API

### REST Endpoints

- `GET /api/games` - List open games
- `POST /api/games` - Create a new game
- `GET /api/games/{id}` - Get game info
- `POST /api/games/{id}/join` - Join a game

### WebSocket Events

Connect to `/ws/{game_id}/{player_id}`

**Client → Server:**
- `play_tile` - Play a domino
- `pass_turn` - Pass when no moves available
- `start_game` - Start game early (creator only)

**Server → Client:**
- `game_state` - Full game state
- `tile_played` - A tile was played
- `turn_passed` - A player passed
- `game_over` - Game finished
