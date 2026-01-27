import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Player colors by position - matches TableVisualization
const PLAYER_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: 'bg-orange-500/30', border: 'border-orange-400', text: 'text-orange-400' },
  1: { bg: 'bg-purple-500/30', border: 'border-purple-400', text: 'text-purple-400' },
  2: { bg: 'bg-cyan-500/30', border: 'border-cyan-400', text: 'text-cyan-400' },
  3: { bg: 'bg-lime-500/30', border: 'border-lime-400', text: 'text-lime-400' },
};

interface TilePickingProps {
  onClaimTile: (gridPosition: number) => void;
}

export function TilePicking({ onClaimTile }: TilePickingProps) {
  const { gameState } = useGameStore();
  const [claimingPosition, setClaimingPosition] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Update countdown timer
  useEffect(() => {
    if (!gameState?.picking_timer) {
      setTimeRemaining(null);
      return;
    }

    // Calculate initial time remaining based on server timestamp
    const serverStarted = new Date(gameState.picking_timer.started_at).getTime();
    const now = Date.now();
    const elapsed = (now - serverStarted) / 1000;
    const remaining = Math.max(0, gameState.picking_timer.timeout - elapsed);
    setTimeRemaining(Math.ceil(remaining));

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.picking_timer?.started_at]);

  if (!gameState || gameState.status !== 'picking') return null;

  // Set of available grid positions (0-27)
  const availablePositions = new Set(gameState.available_tile_positions || []);
  const availableCount = availablePositions.size;
  const myTileCount = gameState.your_hand.length;
  const canPick = myTileCount < 6;

  // Find current player (you)
  const me = gameState.players.find(p => p.is_you);
  const myPosition = me?.position ?? 0;
  const myColors = PLAYER_COLORS[myPosition] || PLAYER_COLORS[0];

  const handleTileClick = (gridPosition: number) => {
    if (!canPick || claimingPosition !== null || !availablePositions.has(gridPosition)) {
      return;
    }
    setClaimingPosition(gridPosition);
    onClaimTile(gridPosition);
    // Reset claiming state after a short delay
    setTimeout(() => setClaimingPosition(null), 500);
  };

  // Create grid of 28 positions (7x4)
  const gridPositions = Array.from({ length: 28 }, (_, i) => i);

  return (
    <div className="flex flex-col items-center gap-4 p-4" data-testid="tile-picking">
      {/* Header with timer */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-neon-amber mb-2" data-testid="picking-header">Pick Your Tiles!</h2>
        <p className="text-gray-400 text-sm">
          Click face-down tiles to add them to your hand
        </p>
        {/* Countdown timer */}
        {timeRemaining !== null && (
          <div
            data-testid="picking-timer"
            data-time-remaining={timeRemaining}
            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full
            ${timeRemaining <= 10
              ? 'bg-red-500/20 border border-red-500 animate-pulse'
              : timeRemaining <= 30
                ? 'bg-orange-500/20 border border-orange-500'
                : 'bg-bar-dark/50 border border-gray-600'
            }`}
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`font-mono text-lg font-bold
              ${timeRemaining <= 10 ? 'text-red-400' : timeRemaining <= 30 ? 'text-orange-400' : 'text-gray-300'}`}
            >
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {/* Progress indicators for all players */}
      <div className="flex flex-wrap justify-center gap-3 mb-2" data-testid="player-progress">
        {gameState.players.map((player) => {
          const colors = PLAYER_COLORS[player.position] || PLAYER_COLORS[0];
          const avatarId = gameState.match?.avatar_ids?.[player.position] || (player.position + 1);
          return (
            <div
              key={player.id}
              data-testid={`player-progress-${player.id}`}
              data-tile-count={player.tile_count}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} border ${colors.border}`}
            >
              <img
                src={`/images/avatar-${avatarId}.png`}
                alt={player.name}
                className="w-6 h-6 rounded-full"
              />
              <span className={`text-sm font-medium ${colors.text}`}>
                {player.is_you ? 'YOU' : player.name}
              </span>
              <span className={`text-sm font-bold ${colors.text}`}>
                {player.tile_count}/6
              </span>
            </div>
          );
        })}
      </div>

      {/* Face-down tiles grid - fixed positions */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3" data-testid="tile-grid">
        {gridPositions.map((position) => {
          const isAvailable = availablePositions.has(position);
          const isClaiming = claimingPosition === position;

          return (
            <button
              key={position}
              onClick={() => handleTileClick(position)}
              disabled={!isAvailable || !canPick || isClaiming}
              data-testid={`tile-position-${position}`}
              data-available={isAvailable}
              className={`
                w-10 h-16 sm:w-12 sm:h-20 rounded-lg transition-all duration-200
                ${isAvailable
                  ? canPick
                    ? `bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-500
                       hover:border-neon-amber hover:scale-105 hover:shadow-lg hover:shadow-neon-amber/30
                       cursor-pointer active:scale-95`
                    : 'bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 opacity-60 cursor-not-allowed'
                  : 'bg-transparent border-2 border-dashed border-slate-700/50 opacity-30'
                }
                ${isClaiming ? 'animate-pulse scale-110 border-neon-amber' : ''}
              `}
            >
              {isAvailable && (
                <div className="w-full h-full flex items-center justify-center">
                  {/* Face-down pattern */}
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-600/50 flex items-center justify-center">
                    <span className="text-slate-400 text-lg">?</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Your picked tiles */}
      {myTileCount > 0 && (
        <div className="mt-4" data-testid="picked-tiles">
          <h3 className={`text-sm font-medium ${myColors.text} mb-2 text-center`}>
            Your Tiles ({myTileCount}/6)
          </h3>
          <div className="flex flex-wrap justify-center gap-2" data-testid="picked-tiles-container">
            {gameState.your_hand.map((domino, idx) => (
              <div
                key={`${domino.left}-${domino.right}-${idx}`}
                data-testid={`picked-tile-${idx}`}
                data-domino={`${domino.left}-${domino.right}`}
                className={`
                  w-12 h-20 sm:w-14 sm:h-24 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200
                  border-2 ${myColors.border} shadow-md flex flex-col items-center justify-center
                  animate-fade-in
                `}
              >
                <div className="flex-1 flex items-center justify-center">
                  <DominoPips value={domino.left} />
                </div>
                <div className="w-8 h-px bg-amber-400/60" />
                <div className="flex-1 flex items-center justify-center">
                  <DominoPips value={domino.right} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status message */}
      <p className="text-center text-gray-400 text-sm mt-2">
        {!canPick
          ? "You've picked all your tiles! Waiting for others..."
          : `${availableCount} tiles remaining`
        }
      </p>
    </div>
  );
}

// Simple pip display component
function DominoPips({ value }: { value: number }) {
  // Pip positions for each value (normalized 0-1 coordinates)
  const pipPositions: Record<number, [number, number][]> = {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
  };

  const pips = pipPositions[value] || [];

  return (
    <div className="relative w-6 h-6 sm:w-8 sm:h-8">
      {pips.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-800"
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
