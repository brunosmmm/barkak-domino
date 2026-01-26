import React from 'react';
import { useGameStore } from '../store/gameStore';

interface RoundOverlayProps {
  onNextRound: () => void;
  onNewGame: () => void;
}

export function RoundOverlay({ onNextRound, onNewGame }: RoundOverlayProps) {
  const { roundOverInfo, matchOverInfo, gameState, showRoundOverlay, setShowRoundOverlay } = useGameStore();

  if (!showRoundOverlay || !roundOverInfo) return null;

  const {
    roundNumber,
    winnerId,
    winnerName,
    winnerTeam,
    pointsAwarded,
    remainingPips,
    wasBlocked,
    scores,
    matchWinner,
    isTeamGame,
  } = roundOverInfo;

  const isCreator = gameState?.players[0]?.is_you;
  const isMatchOver = !!matchWinner || !!matchOverInfo;

  // Determine if current player's team/self won
  const yourPlayerId = gameState?.your_player_id;
  const didYouWin = isTeamGame
    ? (winnerTeam === 'team_a' && gameState?.match?.team_a.includes(yourPlayerId || '')) ||
      (winnerTeam === 'team_b' && gameState?.match?.team_b.includes(yourPlayerId || ''))
    : winnerId === yourPlayerId;

  const getPlayerName = (playerId: string): string => {
    const player = gameState?.players.find(p => p.id === playerId);
    return player?.name || playerId;
  };

  const getTeamLabel = (team: string): string => {
    return team === 'team_a' ? 'Red Team' : 'Blue Team';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-green-900/90 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-green-700">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-gray-400 text-sm mb-1">Round {roundNumber}</p>
          <h2 className="text-3xl font-bold text-white">
            {wasBlocked ? 'Blocked!' : 'Domino!'}
          </h2>
        </div>

        {/* Winner announcement */}
        <div className="text-center mb-6">
          <p className="text-6xl mb-2">{didYouWin ? '🎉' : '😤'}</p>
          <p className="text-xl text-white">
            {isTeamGame ? (
              <>
                <span className={winnerTeam === 'team_a' ? 'text-red-400' : 'text-blue-400'}>
                  {getTeamLabel(winnerTeam || '')}
                </span>
                {' wins the round!'}
              </>
            ) : (
              <>
                <span className="text-yellow-300">{winnerName}</span>
                {' wins the round!'}
              </>
            )}
          </p>
        </div>

        {/* Points awarded */}
        <div className="bg-black/30 rounded-lg p-4 mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Points Awarded</p>
            <p className="text-4xl font-bold text-yellow-300">+{pointsAwarded}</p>
          </div>

          {/* Remaining pips breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(remainingPips).map(([playerId, pips]) => (
              <div
                key={playerId}
                className={`flex justify-between px-2 py-1 rounded ${
                  playerId === winnerId ? 'bg-green-700/50' : 'bg-black/20'
                }`}
              >
                <span className="text-gray-300 truncate">{getPlayerName(playerId)}</span>
                <span className="text-white font-mono">{pips}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current scores */}
        <div className="bg-black/30 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm text-center mb-2">Match Score</p>
          {isTeamGame ? (
            <div className="flex justify-center gap-4 text-xl font-bold">
              <span className="text-red-400">Red: {scores.team_a}</span>
              <span className="text-gray-500">-</span>
              <span className="text-blue-400">Blue: {scores.team_b}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(scores).map(([playerId, score]) => (
                <div key={playerId} className="flex justify-between px-2 py-1">
                  <span className="text-gray-300">{getPlayerName(playerId)}</span>
                  <span className="text-yellow-300 font-bold">{score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match winner announcement */}
        {isMatchOver && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-6 text-center">
            <p className="text-xl text-yellow-300 font-bold">
              {isTeamGame
                ? `${getTeamLabel(matchWinner || '')} wins the match!`
                : `${getPlayerName(matchWinner || '')} wins the match!`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isMatchOver ? (
            <button
              onClick={onNewGame}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg font-bold transition-colors"
            >
              New Match
            </button>
          ) : isCreator ? (
            <button
              onClick={onNextRound}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-colors"
            >
              Next Round
            </button>
          ) : (
            <p className="flex-1 text-center text-gray-400 py-3">
              Waiting for host to start next round...
            </p>
          )}
        </div>

        {/* Close button for non-hosts */}
        {!isCreator && !isMatchOver && (
          <button
            onClick={() => setShowRoundOverlay(false)}
            className="w-full mt-3 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
