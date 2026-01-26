import React from 'react';
import { DominoTile } from './DominoTile';
import { useGameStore } from '../store/gameStore';
import type { Domino } from '../types';

interface PlayerHandProps {
  onTileSelect: (domino: Domino) => void;
  isYourTurn: boolean;
}

export function PlayerHand({ onTileSelect, isYourTurn }: PlayerHandProps) {
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
    <div className="bg-green-900/50 rounded-xl p-4 backdrop-blur">
      <h3 className="text-white text-sm font-medium mb-3">
        Your Hand ({hand.length} tiles)
      </h3>
      <div className="flex flex-wrap gap-2 justify-center">
        {hand.map((domino, index) => (
          <DominoTile
            key={`${domino.left}-${domino.right}-${index}`}
            domino={domino}
            selected={isDominoSelected(domino)}
            disabled={!canPlay(domino)}
            onClick={() => canPlay(domino) && onTileSelect(domino)}
            size="md"
          />
        ))}
      </div>
      {hand.length === 0 && (
        <p className="text-gray-400 text-center py-4">No tiles remaining</p>
      )}
    </div>
  );
}
