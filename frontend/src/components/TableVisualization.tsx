import React from 'react';
import { useGameStore } from '../store/gameStore';

export function TableVisualization() {
  const { gameState } = useGameStore();

  if (!gameState || !gameState.match) return null;

  const { match, players } = gameState;
  const { is_team_game, team_a, team_b, scores } = match;

  // Position players around the table (0=bottom, 1=right, 2=top, 3=left)
  const positionClasses: Record<number, string> = {
    0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    1: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
    2: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    3: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
  };

  const getTeamColor = (playerId: string): string => {
    if (!is_team_game) return 'bg-gray-600';
    if (team_a.includes(playerId)) return 'bg-red-600';
    if (team_b.includes(playerId)) return 'bg-blue-600';
    return 'bg-gray-600';
  };

  const getPlayerInitial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  // Sort players by position
  const sortedPlayers = [...players].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed bottom-4 left-4 z-10">
      {/* Container */}
      <div className="bg-black/40 backdrop-blur rounded-xl p-3">
        {/* Score display */}
        {is_team_game ? (
          <div className="flex gap-2 mb-2 text-xs">
            <span className="text-red-400 font-bold">Red: {scores.team_a}</span>
            <span className="text-gray-400">vs</span>
            <span className="text-blue-400 font-bold">Blue: {scores.team_b}</span>
          </div>
        ) : (
          <div className="text-xs text-gray-400 mb-2">
            Round {match.current_round}
          </div>
        )}

        {/* Table with player seats */}
        <div className="relative w-24 h-24">
          {/* Table surface */}
          <div className="absolute inset-3 bg-green-800 rounded-lg border-2 border-green-900 shadow-inner" />

          {/* Player seats */}
          {sortedPlayers.map((player) => (
            <div
              key={player.id}
              className={`absolute ${positionClasses[player.position] || ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                  ${getTeamColor(player.id)}
                  ${player.id === gameState.current_turn ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
                  ${player.is_you ? 'ring-2 ring-white' : ''}
                  ${!player.connected ? 'opacity-50' : ''}
                `}
                title={`${player.name}${player.is_cpu ? ' (CPU)' : ''}${!player.connected ? ' (disconnected)' : ''}`}
              >
                {player.is_cpu ? '🤖' : getPlayerInitial(player.name)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        {is_team_game && (
          <div className="flex gap-2 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600" /> Team A
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600" /> Team B
            </span>
          </div>
        )}

        {/* Target score */}
        <div className="text-[10px] text-gray-500 text-center mt-1">
          First to {match.target_score}
        </div>
      </div>
    </div>
  );
}
