import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

interface LobbyProps {
  onJoinGame: (gameId: string, playerName: string) => void;
  onCreateGame: (playerName: string, maxPlayers: number, addCpu: number) => void;
  initialJoinGameId?: string | null;
}

interface OpenGame {
  id: string;
  variant: string;
  players: number;
  max_players: number;
  player_names: string[];
}

export function Lobby({ onJoinGame, onCreateGame, initialJoinGameId }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [gameIdToJoin, setGameIdToJoin] = useState(initialJoinGameId || '');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [cpuPlayers, setCpuPlayers] = useState(0);
  const [openGames, setOpenGames] = useState<OpenGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(initialJoinGameId ? 'join' : 'menu');
  const { error, setError } = useGameStore();

  // Fetch open games
  useEffect(() => {
    if (mode === 'join') {
      fetch('/api/games')
        .then(res => res.json())
        .then(data => setOpenGames(data.games || []))
        .catch(err => console.error('Failed to fetch games:', err));
    }
  }, [mode]);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      onCreateGame(playerName.trim(), maxPlayers, cpuPlayers);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (gameId: string) => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      onJoinGame(gameId, playerName.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-bar-dark/90 rounded-2xl p-8 w-full max-w-md backdrop-blur-md shadow-2xl border border-neon-amber/30">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/images/logo.png" alt="Barkak Domino" className="h-20 w-auto drop-shadow-lg" />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 rounded-lg bg-bar-wood text-white placeholder-gray-400
                         border border-bar-wood-light focus:border-neon-amber focus:shadow-neon-amber focus:outline-none"
            />
            <button
              onClick={() => setMode('create')}
              disabled={!playerName.trim()}
              className="w-full bg-neon-amber hover:bg-neon-amber-glow shadow-neon-amber text-white py-3 rounded-lg
                         font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Game
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!playerName.trim()}
              className="w-full bg-bar-felt hover:bg-bar-felt-light text-white py-3 rounded-lg
                         font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('menu')}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back
            </button>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Max Players</label>
              <select
                value={maxPlayers}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  setMaxPlayers(max);
                  if (cpuPlayers >= max) setCpuPlayers(max - 1);
                }}
                className="w-full px-4 py-3 rounded-lg bg-bar-wood text-white
                           border border-bar-wood-light focus:border-neon-amber focus:shadow-neon-amber focus:outline-none"
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">CPU Players</label>
              <select
                value={cpuPlayers}
                onChange={(e) => setCpuPlayers(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-bar-wood text-white
                           border border-bar-wood-light focus:border-neon-amber focus:shadow-neon-amber focus:outline-none"
              >
                {[...Array(maxPlayers)].map((_, i) => (
                  <option key={i} value={i}>{i} CPU{i !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-neon-amber hover:bg-neon-amber-glow shadow-neon-amber text-white py-3 rounded-lg
                         font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            {!initialJoinGameId && (
              <button
                onClick={() => setMode('menu')}
                className="text-gray-400 hover:text-white text-sm"
              >
                ← Back
              </button>
            )}

            {initialJoinGameId && (
              <p className="text-center text-gray-300">
                You've been invited to join game <code className="bg-black/30 px-2 py-1 rounded text-neon-amber">{initialJoinGameId}</code>
              </p>
            )}

            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 rounded-lg bg-bar-wood text-white placeholder-gray-400
                         border border-bar-wood-light focus:border-neon-amber focus:shadow-neon-amber focus:outline-none"
            />

            {!initialJoinGameId && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gameIdToJoin}
                  onChange={(e) => setGameIdToJoin(e.target.value)}
                  placeholder="Game ID"
                  className="flex-1 px-4 py-3 rounded-lg bg-bar-wood text-white placeholder-gray-400
                             border border-bar-wood-light focus:border-neon-amber focus:shadow-neon-amber focus:outline-none"
                />
                <button
                  onClick={() => handleJoin(gameIdToJoin)}
                  disabled={loading || !gameIdToJoin.trim() || !playerName.trim()}
                  className="bg-neon-amber hover:bg-neon-amber-glow shadow-neon-amber text-white px-6 py-3 rounded-lg
                             font-medium transition-colors disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            )}

            {initialJoinGameId && (
              <button
                onClick={() => handleJoin(initialJoinGameId)}
                disabled={loading || !playerName.trim()}
                className="w-full bg-neon-amber hover:bg-neon-amber-glow shadow-neon-amber text-white py-3 rounded-lg
                           font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            )}

            {!initialJoinGameId && openGames.length > 0 && (
              <div>
                <p className="text-gray-300 text-sm mb-2">Open Games:</p>
                <div className="space-y-2">
                  {openGames.map(game => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between bg-bar-wood/50 p-3 rounded-lg"
                    >
                      <div>
                        <code className="text-neon-amber">{game.id}</code>
                        <p className="text-gray-400 text-xs">
                          {game.player_names.join(', ')} ({game.players}/{game.max_players})
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoin(game.id)}
                        disabled={loading || !playerName.trim()}
                        className="bg-bar-felt-light hover:bg-bar-felt text-white px-4 py-2 rounded
                                   text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!initialJoinGameId && openGames.length === 0 && (
              <p className="text-gray-400 text-center text-sm">
                No open games. Create one!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
