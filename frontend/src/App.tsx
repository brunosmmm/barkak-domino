import { useMemo } from 'react';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { useGameStore } from './store/gameStore';

function App() {
  const { gameId, playerId, setCredentials, setError } = useGameStore();

  // Check for join parameter in URL
  const joinGameId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join');
  }, []);

  const handleCreateGame = async (playerName: string, maxPlayers: number, cpuPlayers: number, avatarId: number | null, cpuSpeed: string) => {
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          max_players: maxPlayers,
          cpu_players: cpuPlayers,
          avatar_id: avatarId,
          cpu_speed: cpuSpeed,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'Failed to create game');
        return;
      }

      const data = await response.json();
      setCredentials(data.game_id, data.player_id, playerName);
    } catch (e) {
      setError('Failed to connect to server');
    }
  };

  const handleJoinGame = async (gameId: string, playerName: string, avatarId: number | null) => {
    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_name: playerName,
          avatar_id: avatarId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'Failed to join game');
        return;
      }

      const data = await response.json();
      setCredentials(data.game_id, data.player_id, playerName);
    } catch (e) {
      setError('Failed to connect to server');
    }
  };

  // Show lobby if not in a game, otherwise show game
  const content = (!gameId || !playerId)
    ? <Lobby onJoinGame={handleJoinGame} onCreateGame={handleCreateGame} initialJoinGameId={joinGameId} />
    : <Game />;

  return (
    <>
      {/* Ambient bar atmosphere effects */}
      <div className="ambient-bar-glow" />
      <div className="smoke-wisp smoke-wisp-1" />
      <div className="smoke-wisp smoke-wisp-2" />
      <div className="smoke-wisp smoke-wisp-3" />
      {content}
    </>
  );
}

export default App;
