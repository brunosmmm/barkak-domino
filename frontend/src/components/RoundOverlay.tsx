import { useGameStore } from '../store/gameStore';

interface RoundOverlayProps {
  onNextRound: () => void;
  onNewGame: () => void;
}

export function RoundOverlay({ onNextRound, onNewGame }: RoundOverlayProps) {
  const { roundOverInfo, matchOverInfo, gameState, showRoundOverlay, setShowRoundOverlay } = useGameStore();

  // Show overlay if we have round info, OR if game is finished (e.g., after refresh)
  const gameIsFinished = gameState?.status === 'finished';
  const hasRoundInfo = showRoundOverlay && roundOverInfo;

  // If game is finished but we don't have round info (refresh scenario), show simple overlay
  if (gameIsFinished && !hasRoundInfo) {
    const isCreator = gameState?.players[0]?.is_you;
    const winner = gameState?.players.find(p => p.id === gameState?.winner_id);

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-bar-dark/95 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-neon-amber/30 backdrop-blur-md">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Round Over</h2>
            {winner && (
              <p className="text-xl text-gray-300">
                <span className="text-neon-amber">{winner.name}</span> won this round
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {isCreator ? (
              <button
                onClick={onNextRound}
                className="w-full bg-bar-felt-light hover:bg-bar-felt text-white py-3 rounded-lg font-bold transition-colors"
              >
                Next Round
              </button>
            ) : (
              <p className="text-center text-gray-400 py-3">
                Waiting for host to start next round...
              </p>
            )}
            <button
              onClick={onNewGame}
              className="w-full bg-red-600/80 hover:bg-red-500 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasRoundInfo) return null;

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
    if (team === 'team_a') {
      return gameState?.match?.team_a_name || 'Team A';
    }
    return gameState?.match?.team_b_name || 'Team B';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bar-dark/95 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-neon-amber/30 backdrop-blur-md">
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
                <span className={winnerTeam === 'team_a' ? 'text-orange-400' : 'text-purple-400'}>
                  {getTeamLabel(winnerTeam || '')}
                </span>
                {' wins the round!'}
              </>
            ) : (
              <>
                <span className="text-neon-amber">{winnerName}</span>
                {' wins the round!'}
              </>
            )}
          </p>
        </div>

        {/* Points awarded */}
        <div className="bg-black/30 rounded-lg p-4 mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Points Awarded</p>
            <p className="text-4xl font-bold text-neon-amber">+{pointsAwarded}</p>
          </div>

          {/* Remaining pips breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(remainingPips).map(([playerId, pips]) => (
              <div
                key={playerId}
                className={`flex justify-between px-2 py-1 rounded ${
                  playerId === winnerId ? 'bg-bar-felt/50' : 'bg-black/20'
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
              <span className="text-orange-400">{getTeamLabel('team_a')}: {scores.team_a}</span>
              <span className="text-gray-500">-</span>
              <span className="text-purple-400">{getTeamLabel('team_b')}: {scores.team_b}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(scores).map(([playerId, score]) => (
                <div key={playerId} className="flex justify-between px-2 py-1">
                  <span className="text-gray-300">{getPlayerName(playerId)}</span>
                  <span className="text-neon-amber font-bold">{score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match winner announcement */}
        {isMatchOver && (
          <div className="bg-neon-amber/20 border border-neon-amber rounded-lg p-4 mb-6 text-center">
            <p className="text-xl text-neon-amber font-bold">
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
              className="flex-1 bg-neon-amber hover:bg-neon-amber-glow shadow-neon-amber text-white py-3 rounded-lg font-bold transition-colors"
            >
              New Match
            </button>
          ) : isCreator ? (
            <button
              onClick={onNextRound}
              className="flex-1 bg-bar-felt-light hover:bg-bar-felt text-white py-3 rounded-lg font-bold transition-colors"
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
