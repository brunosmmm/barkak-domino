import React, { useState, useEffect } from 'react';
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
      <div className="bg-green-900/80 rounded-2xl p-8 w-full max-w-md backdrop-blur shadow-2xl">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Dominoes
        </h1>

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
              className="w-full px-4 py-3 rounded-lg bg-green-800 text-white placeholder-gray-400
                         border border-green-700 focus:border-yellow-400 focus:outline-none"
            />
            <button
              onClick={() => setMode('create')}
              disabled={!playerName.trim()}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg
                         font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Game
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!playerName.trim()}
              className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg
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
                className="w-full px-4 py-3 rounded-lg bg-green-800 text-white
                           border border-green-700 focus:border-yellow-400 focus:outline-none"
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
                className="w-full px-4 py-3 rounded-lg bg-green-800 text-white
                           border border-green-700 focus:border-yellow-400 focus:outline-none"
              >
                {[...Array(maxPlayers)].map((_, i) => (
                  <option key={i} value={i}>{i} CPU{i !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg
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
                You've been invited to join game <code className="bg-black/30 px-2 py-1 rounded text-yellow-300">{initialJoinGameId}</code>
              </p>
            )}

            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 rounded-lg bg-green-800 text-white placeholder-gray-400
                         border border-green-700 focus:border-yellow-400 focus:outline-none"
            />

            {!initialJoinGameId && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gameIdToJoin}
                  onChange={(e) => setGameIdToJoin(e.target.value)}
                  placeholder="Game ID"
                  className="flex-1 px-4 py-3 rounded-lg bg-green-800 text-white placeholder-gray-400
                             border border-green-700 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  onClick={() => handleJoin(gameIdToJoin)}
                  disabled={loading || !gameIdToJoin.trim() || !playerName.trim()}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-lg
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
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg
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
                      className="flex items-center justify-between bg-green-800/50 p-3 rounded-lg"
                    >
                      <div>
                        <code className="text-yellow-300">{game.id}</code>
                        <p className="text-gray-400 text-xs">
                          {game.player_names.join(', ')} ({game.players}/{game.max_players})
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoin(game.id)}
                        disabled={loading || !playerName.trim()}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded
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
