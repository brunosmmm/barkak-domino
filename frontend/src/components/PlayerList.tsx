import React from 'react';
import { useGameStore } from '../store/gameStore';

export function PlayerList() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { players, current_turn, status } = gameState;

  return (
    <div className="bg-green-900/50 rounded-xl p-4 backdrop-blur">
      <h3 className="text-white text-sm font-medium mb-3">Players</h3>
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`
              flex items-center justify-between p-2 rounded-lg
              ${current_turn === player.id && status === 'playing'
                ? 'bg-yellow-600/30 ring-1 ring-yellow-400'
                : 'bg-black/20'}
            `}
          >
            <div className="flex items-center gap-2">
              {/* Connection status dot */}
              <span
                className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
              <span className={`text-sm ${player.is_you ? 'text-yellow-300 font-medium' : 'text-white'}`}>
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
