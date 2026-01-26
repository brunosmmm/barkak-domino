import { useGameStore } from '../store/gameStore';

export function PlayerList() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { players, current_turn, status } = gameState;

  return (
    <div className="glass-panel p-4">
      <h3 className="text-neon-amber-glow text-sm font-medium mb-3 neon-text">Players</h3>
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`
              flex items-center justify-between p-2 rounded-lg
              ${current_turn === player.id && status === 'playing'
                ? 'bg-neon-amber/20 ring-1 ring-neon-amber shadow-neon-amber'
                : 'bg-black/20'}
            `}
          >
            <div className="flex items-center gap-2">
              {/* Connection status dot */}
              <span
                className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-neon-amber-glow' : 'bg-gray-500'
                }`}
              />
              <span className={`text-sm ${player.is_you ? 'text-neon-amber font-medium' : 'text-white'}`}>
                {player.name}
                {player.is_you && ' (You)'}
                {player.is_cpu && ' (CPU)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">
                {player.tile_count} tiles
              </span>
              <span className="text-white text-sm font-medium">
                {player.score} pts
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
