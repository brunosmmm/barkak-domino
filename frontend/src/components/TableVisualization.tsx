import { useGameStore } from '../store/gameStore';

// Player colors matching GameBoard.tsx - used for tile flash identification
const PLAYER_RING_COLORS: Record<number, string> = {
  0: 'ring-orange-400',
  1: 'ring-purple-400',
  2: 'ring-cyan-400',
  3: 'ring-lime-400',
};

const PLAYER_TEXT_COLORS: Record<number, string> = {
  0: 'text-orange-400',
  1: 'text-purple-400',
  2: 'text-cyan-400',
  3: 'text-lime-400',
};

export function TableVisualization() {
  const { gameState } = useGameStore();

  if (!gameState || !gameState.match) return null;

  const { match, players } = gameState;
  const { is_team_game, scores, avatar_ids } = match;

  // Position players around the table (0=bottom, 1=right, 2=top, 3=left)
  const positionClasses: Record<number, string> = {
    0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    1: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
    2: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    3: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
  };

  // Label positions for player names
  const labelClasses: Record<number, string> = {
    0: 'top-full mt-1 left-1/2 -translate-x-1/2',  // bottom player - name below
    1: 'top-full mt-1 left-1/2 -translate-x-1/2',  // right player - name below
    2: 'bottom-full mb-2 left-1/2 -translate-x-1/2', // top player - name ABOVE
    3: 'top-full mt-1 left-1/2 -translate-x-1/2',  // left player - name below
  };

  // Get avatar path for a position - uses randomly assigned avatar_ids from match
  const getAvatarPath = (position: number): string => {
    const avatarId = avatar_ids?.[position] || (position + 1);
    return `/images/avatar-${avatarId}.png`;
  };

  // Sort players by position
  const sortedPlayers = [...players].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed bottom-4 left-4 z-10">
      {/* Container with extra padding for labels */}
      <div className="bg-black/60 backdrop-blur-sm rounded-lg pt-14 pb-10 px-12">
        {/* Table with player seats - bigger */}
        <div className="relative w-48 h-48 mx-auto">
          {/* Table surface */}
          <div className="absolute inset-10 bg-bar-felt rounded-lg border-2 border-bar-dark shadow-inner" />

          {/* Player seats */}
          {sortedPlayers.map((player) => {
            const playerColor = PLAYER_RING_COLORS[player.position] || PLAYER_RING_COLORS[0];
            const textColor = PLAYER_TEXT_COLORS[player.position] || PLAYER_TEXT_COLORS[0];
            const isCurrentTurn = player.id === gameState.current_turn;

            return (
              <div
                key={player.id}
                className={`absolute ${positionClasses[player.position] || ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-full overflow-hidden ring-2 relative
                    ${isCurrentTurn ? `${playerColor} animate-pulse` : playerColor}
                    ${player.is_you ? 'ring-[3px]' : ''}
                    ${!player.connected ? 'opacity-50' : ''}
                  `}
                  title={`${player.name}${player.is_cpu ? ' (CPU)' : ''}${!player.connected ? ' (disconnected)' : ''}`}
                >
                  <img
                    src={getAvatarPath(player.position)}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Player name label */}
                <div className={`absolute ${labelClasses[player.position]} whitespace-nowrap`}>
                  <span className={`text-[10px] ${textColor} ${player.is_you ? 'font-bold' : ''}`}>
                    {player.name.length > 10 ? player.name.slice(0, 10) + '…' : player.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Score/info below the table */}
        <div className="mt-14 text-center">
          {is_team_game ? (
            <div className="flex justify-center gap-2 text-xs font-bold">
              <span className="text-orange-400">{match.team_a_name}: {scores.team_a}</span>
              <span className="text-gray-500">vs</span>
              <span className="text-purple-400">{match.team_b_name}: {scores.team_b}</span>
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              Round {match.current_round} • Target: {match.target_score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
