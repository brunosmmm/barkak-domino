import { DominoTile } from './DominoTile';
import { useGameStore } from '../store/gameStore';

// Player colors based on position (0-3) - distinct, visible on dark background
const PLAYER_COLORS: Record<number, { ring: string; shadow: string; bg: string }> = {
  0: { ring: 'ring-orange-400', shadow: 'shadow-orange-400/60', bg: 'bg-orange-400' },
  1: { ring: 'ring-purple-400', shadow: 'shadow-purple-400/60', bg: 'bg-purple-400' },
  2: { ring: 'ring-cyan-400', shadow: 'shadow-cyan-400/60', bg: 'bg-cyan-400' },
  3: { ring: 'ring-lime-400', shadow: 'shadow-lime-400/60', bg: 'bg-lime-400' },
};

interface GameBoardProps {
  onPlayLeft: () => void;
  onPlayRight: () => void;
  isYourTurn: boolean;
}

export function GameBoard({ onPlayLeft, onPlayRight, isYourTurn }: GameBoardProps) {
  const { gameState, selectedDomino, lastPlayedTile } = useGameStore();

  if (!gameState) return null;

  const { board, ends, players } = gameState;

  // Get player position by ID
  const getPlayerPosition = (playerId: string): number => {
    const player = players.find(p => p.id === playerId);
    return player?.position ?? 0;
  };

  // Get player color classes for the last played tile
  const getPlayerColorClasses = (): { ring: string; shadow: string } => {
    if (!lastPlayedTile) return { ring: 'ring-neon-amber', shadow: 'shadow-neon-amber/50' };
    const position = getPlayerPosition(lastPlayedTile.playerId);
    return PLAYER_COLORS[position] || PLAYER_COLORS[0];
  };

  // Check if a tile at index is the last played tile
  const isLastPlayed = (index: number): boolean => {
    if (!lastPlayedTile) return false;
    if (lastPlayedTile.position === 0 && index === 0) return true;
    if (lastPlayedTile.position === -1 && index === board.length - 1) return true;
    return false;
  };

  // Check if selected domino can play on a side
  const canPlayOnSide = (side: 'left' | 'right'): boolean => {
    if (!selectedDomino) return false;
    const targetEnd = side === 'left' ? ends.left : ends.right;
    if (targetEnd === null) return true;
    return selectedDomino.left === targetEnd || selectedDomino.right === targetEnd;
  };

  // Render a single tile with proper connection to neighbors
  const renderTile = (played: typeof board[0], globalIndex: number, isFirst: boolean) => {
    const isDouble = played.domino.left === played.domino.right;
    const justPlayed = isLastPlayed(globalIndex);
    const stableKey = `${globalIndex}-${played.domino.left}-${played.domino.right}`;
    const playerColors = getPlayerColorClasses();

    // Negative margin to make tiles touch (except first tile)
    const marginStyle = isFirst ? {} : { marginLeft: '-1px' };

    return (
      <div
        key={stableKey}
        className={`flex-shrink-0 relative ${
          justPlayed
            ? `z-10 animate-pulse ring-2 ${playerColors.ring} ring-opacity-90 rounded shadow-lg ${playerColors.shadow}`
            : ''
        }`}
        style={marginStyle}
      >
        {/* Small tiles on mobile, medium on desktop */}
        <div className="lg:hidden">
          <DominoTile domino={played.domino} horizontal={!isDouble} size="sm" />
        </div>
        <div className="hidden lg:block">
          <DominoTile domino={played.domino} horizontal={!isDouble} size="md" />
        </div>
      </div>
    );
  };

  if (board.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/50 text-xl">
          {!isYourTurn ? (
            <span className="text-gray-400">Waiting for first move...</span>
          ) : (
            <span className="text-neon-amber">Select a tile to play</span>
          )}
        </div>
      </div>
    );
  }

  // Simple horizontal layout - single scrollable row
  const canShowPlayZones = isYourTurn && selectedDomino;
  const showLeftZone = canShowPlayZones && canPlayOnSide('left');
  const showRightZone = canShowPlayZones && canPlayOnSide('right');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 lg:p-4 min-h-0 overflow-hidden">
      {/* Scrollable board container */}
      <div className="w-full overflow-x-auto pb-2 flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center min-w-max px-2 lg:px-4">
          {/* Left play zone */}
          {showLeftZone && (
            <button
              onClick={onPlayLeft}
              className="w-20 h-12 border-2 border-dashed border-neon-amber rounded-lg
                         flex items-center justify-center text-neon-amber text-xl
                         hover:bg-neon-amber/20 transition-colors flex-shrink-0 mr-2"
            >
              ← {ends.left}
            </button>
          )}

          {/* All tiles in a single row */}
          <div className="flex items-center">
            {board.map((played, index) => {
              const isFirst = index === 0;
              return renderTile(played, index, isFirst);
            })}
          </div>

          {/* Right play zone */}
          {showRightZone && (
            <button
              onClick={onPlayRight}
              className="w-20 h-12 border-2 border-dashed border-neon-amber rounded-lg
                         flex items-center justify-center text-neon-amber text-xl
                         hover:bg-neon-amber/20 transition-colors flex-shrink-0 ml-2"
            >
              {ends.right} →
            </button>
          )}
        </div>
      </div>

      {/* Tile count */}
      <div className="mt-2 text-xs text-gray-500">
        {board.length} tiles on board
      </div>
    </div>
  );
}
