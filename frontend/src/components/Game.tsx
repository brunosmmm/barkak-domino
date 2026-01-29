import { useState } from 'react';
import { GameBoard } from './GameBoard';
import { PlayerHand } from './PlayerHand';
import { PlayerList } from './PlayerList';
import { GameStatus } from './GameStatus';
import { RoundOverlay } from './RoundOverlay';
import { PassNotification } from './PassNotification';
import { ReactionPicker } from './ReactionPicker';
import { ReactionDisplay } from './ReactionDisplay';
import { Boneyard } from './Boneyard';
import { TurnTimer } from './TurnTimer';
import { TilePicking } from './TilePicking';
import { useGameStore } from '../store/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Domino } from '../types';

// Player colors by position - matches TableVisualization
const PLAYER_COLORS: Record<number, { border: string; text: string }> = {
  0: { border: 'border-orange-400', text: 'text-orange-400' },
  1: { border: 'border-purple-400', text: 'text-purple-400' },
  2: { border: 'border-cyan-400', text: 'text-cyan-400' },
  3: { border: 'border-lime-400', text: 'text-lime-400' },
};

export function Game() {
  const { gameState, selectedDomino, setSelectedDomino, reset, addReaction } = useGameStore();
  const { playTile, passTurn, startGame, addCpu, nextRound, claimTile, sendReaction, disconnect } = useWebSocket();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Send reaction with optimistic update (show immediately, don't wait for server roundtrip)
  const handleSendReaction = (emoji: string) => {
    // Optimistically add reaction locally for immediate feedback
    if (gameState) {
      const you = gameState.players.find(p => p.is_you);
      if (you) {
        addReaction(you.id, 'You', emoji);
      }
    }
    // Also send to server for other players
    sendReaction(emoji);
  };

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
    // Auto-play on first move (empty board)
    if (gameState.board.length === 0 && isYourTurn) {
      playTile(domino, 'left');
      return;
    }

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
    console.log('handleNextRound called');
    nextRound();
  };

  return (
    <div className="h-full flex flex-col lg:flex-row p-2 lg:p-4 gap-2 lg:gap-4 overflow-hidden" data-testid="game-container" data-game-status={gameState.status} data-game-id={gameState.id}>
      {/* Mobile header bar - shows turn order with avatars */}
      <div className={`lg:hidden flex items-center justify-between p-3 flex-shrink-0 rounded-lg border ${
        isYourTurn && gameState.status === 'playing'
          ? 'bg-neon-amber/20 border-neon-amber'
          : 'glass-panel border-transparent'
      }`}>
        {/* Player avatars in turn order */}
        <div className="flex items-center gap-2 flex-1">
          {[...gameState.players].sort((a, b) => a.position - b.position).map((player) => {
            const isCurrent = player.id === gameState.current_turn;
            const avatarId = gameState.match?.avatar_ids?.[player.position] || (player.position + 1);
            const colors = PLAYER_COLORS[player.position] || PLAYER_COLORS[0];
            return (
              <div
                key={player.id}
                className={`relative flex flex-col items-center px-1.5 py-1 rounded-lg bg-black/50 ${isCurrent ? 'scale-110' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full overflow-hidden border-2 ${colors.border} ${
                    isCurrent ? 'shadow-lg animate-pulse' : 'opacity-60'
                  }`}
                >
                  <img
                    src={`/images/avatar-${avatarId}.png`}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className={`text-[10px] font-semibold mt-0.5 max-w-[48px] truncate ${
                  isCurrent ? `font-bold ${colors.text}` : 'text-gray-300 opacity-80'
                }`}>
                  {player.is_you ? 'YOU' : player.name}
                </span>
              </div>
            );
          })}
          {/* Arrow showing turn direction */}
          <span className="text-gray-400 text-sm ml-1">→</span>
        </div>

        {/* Turn timer (compact) */}
        {gameState.status === 'playing' && gameState.turn_timer && (
          <TurnTimer compact />
        )}

        {/* Status text */}
        <span className={`text-xs mx-2 ${isYourTurn ? 'text-neon-amber font-bold' : 'text-gray-400'}`}>
          {gameState.status === 'waiting' ? 'Waiting...' :
           gameState.status === 'picking' ? 'Pick tiles!' :
           gameState.status === 'finished' ? 'Done' :
           isYourTurn ? 'GO!' : ''}
        </span>

        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="p-1.5 text-neon-amber hover:bg-neon-amber/20 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showMobileMenu ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute top-16 left-2 right-2 space-y-2 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <PlayerList />
            <GameStatus
              onPass={handlePass}
              onStartGame={startGame}
              onNewGame={handleNewGame}
              onAddCpu={addCpu}
              isYourTurn={isYourTurn}
              canPass={canPass()}
            />
            <button
              onClick={() => setShowMobileMenu(false)}
              className="w-full bg-gray-700 text-white py-2 rounded-lg"
            >
              Close Menu
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block lg:w-64 space-y-4">
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

      {/* Main game area - takes full height on mobile */}
      <div className="flex-1 flex flex-col gap-2 lg:gap-4 min-h-0 overflow-hidden">
        {/* Picking phase - show tile selection grid */}
        {gameState.status === 'picking' ? (
          <div className="flex-1 flex items-center justify-center glass-panel rounded-lg overflow-auto" data-testid="picking-phase">
            <TilePicking onClaimTile={claimTile} />
          </div>
        ) : (
          <>
            <GameBoard
              onPlayLeft={handlePlayLeft}
              onPlayRight={handlePlayRight}
              isYourTurn={isYourTurn}
            />
            <PlayerHand
              onTileSelect={handleTileSelect}
              isYourTurn={isYourTurn}
              canPass={canPass()}
              onPass={handlePass}
            />
          </>
        )}
      </div>


      {/* Boneyard - hidden on mobile portrait */}
      <div className="hidden landscape:block lg:block">
        <Boneyard />
      </div>

      {/* Round over overlay */}
      <RoundOverlay
        onNextRound={handleNextRound}
        onNewGame={handleNewGame}
      />

      {/* Pass notification toast */}
      <PassNotification />

      {/* Floating reactions display */}
      <ReactionDisplay />

      {/* Reaction picker button (bottom right, above player hand) */}
      {gameState.status === 'playing' && (
        <div className="fixed bottom-24 lg:bottom-4 right-4 z-40">
          <ReactionPicker onReaction={handleSendReaction} />
        </div>
      )}
    </div>
  );
}
