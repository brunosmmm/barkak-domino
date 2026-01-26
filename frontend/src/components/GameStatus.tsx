import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface GameStatusProps {
  onPass: () => void;
  onStartGame: () => void;
  onNewGame: () => void;
  onAddCpu: () => void;
  isYourTurn: boolean;
  canPass: boolean;
}

export function GameStatus({ onPass, onStartGame, onNewGame, onAddCpu, isYourTurn, canPass }: GameStatusProps) {
  const { gameState, connected, error } = useGameStore();
  const [copied, setCopied] = useState(false);

  if (!gameState) return null;

  const copyShareLink = async () => {
    const url = `${window.location.origin}?join=${gameState.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { status, players, winner_id, ends, current_turn } = gameState;
  const currentPlayer = players.find(p => p.id === current_turn);
  const winner = players.find(p => p.id === winner_id);
  const isCreator = players[0]?.is_you;

  return (
    <div className="bg-green-900/50 rounded-xl p-4 backdrop-blur">
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-400">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-3 py-2 rounded-lg mb-3 text-sm">
          {error}
        </div>
      )}

      {/* Game status */}
      {status === 'waiting' && (
        <div className="space-y-3">
          <p className="text-white text-center">
            Waiting for players... ({players.length}/{gameState.players.length > 0 ? 4 : 4})
          </p>

          {/* Host controls */}
          {isCreator && (
            <div className="space-y-2">
              {players.length >= 2 && (
                <button
                  onClick={onStartGame}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Start Game
                </button>
              )}
              {players.length < 4 && (
                <button
                  onClick={onAddCpu}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  + Add CPU Player
                </button>
              )}
            </div>
          )}

          <div className="bg-black/20 rounded-lg p-3 space-y-2">
            <p className="text-gray-300 text-sm text-center">
              Game ID: <code className="bg-black/30 px-2 py-1 rounded text-yellow-300">{gameState.id}</code>
            </p>
            <button
              onClick={copyShareLink}
              className={`w-full py-2 rounded-lg font-medium transition-colors text-sm
                ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {copied ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      )}

      {status === 'playing' && (
        <div className="space-y-3">
          {/* Match score display */}
          {gameState.match && (
            <div className="bg-black/20 rounded-lg p-2 text-center text-sm">
              <p className="text-gray-400 text-xs mb-1">
                Round {gameState.match.current_round} - Target: {gameState.match.target_score}
              </p>
              {gameState.match.is_team_game ? (
                <div className="flex justify-center gap-3">
                  <span className="text-red-400 font-bold">Red: {gameState.match.scores.team_a}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-blue-400 font-bold">Blue: {gameState.match.scores.team_b}</span>
                </div>
              ) : (
                <div className="flex justify-center gap-2 flex-wrap">
                  {Object.entries(gameState.match.scores).map(([pid, score]) => {
                    const p = players.find(pl => pl.id === pid);
                    return (
                      <span key={pid} className={`${p?.is_you ? 'text-yellow-300' : 'text-gray-300'}`}>
                        {p?.name}: {score}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            {isYourTurn ? (
              canPass ? (
                <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-3 animate-pulse">
                  <p className="text-orange-300 font-medium text-lg">No Valid Moves!</p>
                  <p className="text-orange-200/80 text-sm">You must pass your turn</p>
                </div>
              ) : (
                <p className="text-yellow-300 font-medium text-lg">Your Turn</p>
              )
            ) : (
              <p className="text-white">
                Waiting for <span className="font-medium">{currentPlayer?.name}</span>...
              </p>
            )}
          </div>

          {/* Board ends */}
          {ends.left !== null && (
            <div className="flex justify-center gap-4 text-gray-300 text-sm">
              <span>Left: <strong>{ends.left}</strong></span>
              <span>Right: <strong>{ends.right}</strong></span>
            </div>
          )}

          {/* Pass button */}
          {isYourTurn && canPass && (
            <button
              onClick={onPass}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-lg font-bold
                         transition-colors shadow-lg shadow-orange-500/30 animate-bounce"
            >
              Pass Turn
            </button>
          )}
        </div>
      )}

      {status === 'finished' && (
        <div className="text-center space-y-4">
          {/* Match score display */}
          {gameState.match && (
            <div className="bg-black/20 rounded-lg p-3 mb-2">
              <p className="text-gray-400 text-xs mb-1">Round Complete</p>
              {gameState.match.is_team_game ? (
                <div className="flex justify-center gap-3">
                  <span className="text-red-400 font-bold">Red: {gameState.match.scores.team_a}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-blue-400 font-bold">Blue: {gameState.match.scores.team_b}</span>
                </div>
              ) : (
                <div className="text-sm">
                  {Object.entries(gameState.match.scores).map(([pid, score]) => {
                    const p = players.find(pl => pl.id === pid);
                    return (
                      <div key={pid} className={`${p?.is_you ? 'text-yellow-300' : 'text-gray-300'}`}>
                        {p?.name}: {score}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p className="text-4xl">
            {winner?.is_you ? '🎉' : '😔'}
          </p>
          <p className="text-white text-xl font-medium">
            {winner?.is_you ? 'Round Won!' : `${winner?.name} Won!`}
          </p>

          {/* If there's a match winner, show match over message */}
          {gameState.match?.match_winner && (
            <p className="text-yellow-300 font-bold">
              Match Over!
            </p>
          )}

          <button
            onClick={onNewGame}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg font-bold transition-colors"
          >
            New Game
          </button>
        </div>
      )}
    </div>
  );
}
