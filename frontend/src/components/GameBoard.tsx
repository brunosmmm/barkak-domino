import { DominoTile } from './DominoTile';
import { useGameStore } from '../store/gameStore';

interface GameBoardProps {
  onPlayLeft: () => void;
  onPlayRight: () => void;
}

const TILES_PER_ROW = 8;

export function GameBoard({ onPlayLeft, onPlayRight }: GameBoardProps) {
  const { gameState, selectedDomino, lastPlayedTile } = useGameStore();

  if (!gameState) return null;

  const { board, ends } = gameState;

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

  // Split board into rows for snake pattern
  const getRows = () => {
    const rows: typeof board[] = [];
    for (let i = 0; i < board.length; i += TILES_PER_ROW) {
      rows.push(board.slice(i, i + TILES_PER_ROW));
    }
    return rows;
  };

  // Render a single tile
  const renderTile = (played: typeof board[0], globalIndex: number) => {
    const isDouble = played.domino.left === played.domino.right;
    const justPlayed = isLastPlayed(globalIndex);
    const stableKey = `${Math.min(played.domino.left, played.domino.right)}-${Math.max(played.domino.left, played.domino.right)}`;

    return (
      <div
        key={stableKey}
        className={`flex-shrink-0 ${
          justPlayed
            ? 'scale-110 animate-pulse ring-4 ring-yellow-400 ring-opacity-75 rounded-lg shadow-lg shadow-yellow-400/50'
            : ''
        }`}
      >
        <DominoTile
          domino={played.domino}
          horizontal={!isDouble}
          size="md"
        />
      </div>
    );
  };

  if (board.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/50 text-xl">
          {selectedDomino ? (
            <button
              onClick={onPlayLeft}
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Play First Tile
            </button>
          ) : (
            'Select a tile to play'
          )}
        </div>
      </div>
    );
  }

  const rows = getRows();
  const isMultiRow = rows.length > 1;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
      <div className="flex flex-col gap-2">
        {rows.map((row, rowIndex) => {
          const isReversed = rowIndex % 2 === 1;
          const globalStartIndex = rowIndex * TILES_PER_ROW;
          const isFirstRow = rowIndex === 0;
          const isLastRow = rowIndex === rows.length - 1;

          // Determine where play zones should appear
          const showLeftZone = isFirstRow && !isReversed && selectedDomino && canPlayOnSide('left');
          const showRightZone = isLastRow && (
            (isReversed && selectedDomino && canPlayOnSide('right')) ||
            (!isReversed && selectedDomino && canPlayOnSide('right'))
          );

          // For reversed rows, right zone appears at visual left
          const showLeftZoneReversed = isFirstRow && isReversed && selectedDomino && canPlayOnSide('left');
          const showRightZoneReversed = isLastRow && isReversed && selectedDomino && canPlayOnSide('right');

          return (
            <div key={rowIndex} className="flex items-center">
              {/* Corner connector from previous row */}
              {rowIndex > 0 && (
                <div
                  className={`w-8 flex items-center justify-center text-green-600 ${
                    isReversed ? 'order-last ml-2' : 'order-first mr-2'
                  }`}
                >
                  <div className="w-1 h-16 bg-green-700 rounded-full opacity-50" />
                </div>
              )}

              {/* Row of tiles */}
              <div
                className={`flex items-center gap-1 ${
                  isReversed ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Left play zone (only on first row, non-reversed) */}
                {showLeftZone && (
                  <button
                    onClick={onPlayLeft}
                    className="w-12 h-24 border-2 border-dashed border-yellow-400 rounded-lg
                               flex items-center justify-center text-yellow-400 text-2xl
                               hover:bg-yellow-400/20 transition-colors flex-shrink-0"
                  >
                    +
                  </button>
                )}

                {/* Left play zone for reversed first row */}
                {showLeftZoneReversed && (
                  <button
                    onClick={onPlayLeft}
                    className="w-12 h-24 border-2 border-dashed border-yellow-400 rounded-lg
                               flex items-center justify-center text-yellow-400 text-2xl
                               hover:bg-yellow-400/20 transition-colors flex-shrink-0"
                  >
                    +
                  </button>
                )}

                {/* Tiles in this row */}
                {row.map((played, localIndex) => {
                  const globalIndex = globalStartIndex + localIndex;
                  return renderTile(played, globalIndex);
                })}

                {/* Right play zone (only on last row) */}
                {isLastRow && !isReversed && selectedDomino && canPlayOnSide('right') && (
                  <button
                    onClick={onPlayRight}
                    className="w-12 h-24 border-2 border-dashed border-yellow-400 rounded-lg
                               flex items-center justify-center text-yellow-400 text-2xl
                               hover:bg-yellow-400/20 transition-colors flex-shrink-0"
                  >
                    +
                  </button>
                )}

                {/* Right play zone for reversed last row */}
                {isLastRow && isReversed && selectedDomino && canPlayOnSide('right') && (
                  <button
                    onClick={onPlayRight}
                    className="w-12 h-24 border-2 border-dashed border-yellow-400 rounded-lg
                               flex items-center justify-center text-yellow-400 text-2xl
                               hover:bg-yellow-400/20 transition-colors flex-shrink-0"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Row indicator for multi-row boards */}
      {isMultiRow && (
        <div className="mt-2 text-xs text-gray-500">
          {board.length} tiles in {rows.length} rows
        </div>
      )}
    </div>
  );
}
