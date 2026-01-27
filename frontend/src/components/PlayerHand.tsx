import { DominoTile } from './DominoTile';
import { useGameStore } from '../store/gameStore';
import type { Domino } from '../types';

interface PlayerHandProps {
  onTileSelect: (domino: Domino) => void;
  isYourTurn: boolean;
  canPass?: boolean;
  onPass?: () => void;
}

export function PlayerHand({ onTileSelect, isYourTurn, canPass, onPass }: PlayerHandProps) {
  const { gameState, selectedDomino } = useGameStore();

  if (!gameState) return null;

  const hand = gameState.your_hand;

  // Check if a domino can be played
  const canPlay = (domino: Domino): boolean => {
    if (!isYourTurn) return false;
    if (gameState.board.length === 0) return true;

    const { left, right } = gameState.ends;
    return (
      domino.left === left ||
      domino.right === left ||
      domino.left === right ||
      domino.right === right
    );
  };

  const isDominoSelected = (d: Domino): boolean => {
    if (!selectedDomino) return false;
    return (
      (d.left === selectedDomino.left && d.right === selectedDomino.right) ||
      (d.left === selectedDomino.right && d.right === selectedDomino.left)
    );
  };

  return (
    <div className="glass-panel p-2 lg:p-3 mx-auto flex-shrink-0 relative z-20">
      <div className="flex flex-col lg:flex-row items-center justify-center gap-2 lg:gap-4">
        <span className="text-neon-amber-glow text-xs lg:text-sm font-medium neon-text whitespace-nowrap">
          Your Hand ({hand.length})
        </span>
        <div className="flex flex-wrap gap-1 lg:gap-2 justify-center">
          {hand.map((domino, index) => (
            <div key={`${domino.left}-${domino.right}-${index}`}>
              {/* Small tiles on mobile, medium on desktop */}
              <div className="lg:hidden">
                <DominoTile
                  domino={domino}
                  selected={isDominoSelected(domino)}
                  disabled={!canPlay(domino)}
                  onClick={() => canPlay(domino) && onTileSelect(domino)}
                  size="sm"
                />
              </div>
              <div className="hidden lg:block">
                <DominoTile
                  domino={domino}
                  selected={isDominoSelected(domino)}
                  disabled={!canPlay(domino)}
                  onClick={() => canPlay(domino) && onTileSelect(domino)}
                  size="md"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {hand.length === 0 && (
        <p className="text-gray-400 text-center py-2">No tiles remaining</p>
      )}

      {/* Pass button - appears when player must pass */}
      {isYourTurn && canPass && onPass && (
        <button
          onClick={onPass}
          className="mt-2 w-full bg-orange-600 active:bg-orange-500 text-white py-3 rounded-lg font-bold
                     shadow-lg shadow-orange-500/30 border-2 border-orange-400"
        >
          ⏭️ PASS TURN
        </button>
      )}
    </div>
  );
}
