import { GameBoard } from './GameBoard';
import { PlayerHand } from './PlayerHand';
import { PlayerList } from './PlayerList';
import { GameStatus } from './GameStatus';
import { TableVisualization } from './TableVisualization';
import { RoundOverlay } from './RoundOverlay';
import { PassNotification } from './PassNotification';
import { ReactionPicker } from './ReactionPicker';
import { ReactionDisplay } from './ReactionDisplay';
import { Boneyard } from './Boneyard';
import { useGameStore } from '../store/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Domino } from '../types';

export function Game() {
  const { gameState, selectedDomino, setSelectedDomino, reset } = useGameStore();
  const { playTile, passTurn, startGame, addCpu, nextRound, sendReaction, disconnect } = useWebSocket();

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white text-xl">Loading game...</p>
      </div>
    );
  }

  const isYourTurn = gameState.current_turn === gameState.your_player_id;

  // Check if player can pass (has no valid moves)
  const canPass = (): boolean => {
    if (!isYourTurn || gameState.board.length === 0) return false;

    const { left, right } = gameState.ends;
    return !gameState.your_hand.some(
      d => d.left === left || d.right === left || d.left === right || d.right === right
    );
  };

  const handleTileSelect = (domino: Domino) => {
    if (selectedDomino?.left === domino.left && selectedDomino?.right === domino.right) {
      setSelectedDomino(null);
    } else {
      setSelectedDomino(domino);
    }
  };

  const handlePlayLeft = () => {
    if (selectedDomino) {
      playTile(selectedDomino, 'left');
      setSelectedDomino(null);
    }
  };

  const handlePlayRight = () => {
    if (selectedDomino) {
      playTile(selectedDomino, 'right');
      setSelectedDomino(null);
    }
  };

  const handlePass = () => {
    passTurn();
  };

  const handleNewGame = () => {
    disconnect();
    reset();
  };

  const handleNextRound = () => {
    nextRound();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row p-4 gap-4">
      {/* Sidebar */}
      <div className="lg:w-64 space-y-4">
        <PlayerList />
        <GameStatus
          onPass={handlePass}
          onStartGame={startGame}
          onNewGame={handleNewGame}
          onAddCpu={addCpu}
          isYourTurn={isYourTurn}
          canPass={canPass()}
        />
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col gap-4">
        <GameBoard
          onPlayLeft={handlePlayLeft}
          onPlayRight={handlePlayRight}
          isYourTurn={isYourTurn}
        />
        <PlayerHand
          onTileSelect={handleTileSelect}
          isYourTurn={isYourTurn}
        />
      </div>

      {/* Table visualization (shows teams and scores) */}
      <TableVisualization />

      {/* Boneyard - face-down tiles shown for dramatic effect */}
      <Boneyard />

      {/* Round over overlay */}
      <RoundOverlay
        onNextRound={handleNextRound}
        onNewGame={handleNewGame}
      />

      {/* Pass notification toast */}
      <PassNotification />

      {/* Floating reactions display */}
      <ReactionDisplay />

      {/* Reaction picker button (bottom right) */}
      {gameState.status === 'playing' && (
        <div className="fixed bottom-4 right-4 z-30">
          <ReactionPicker onReaction={sendReaction} />
        </div>
      )}
    </div>
  );
}
