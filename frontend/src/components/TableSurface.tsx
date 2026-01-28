import { ReactNode } from 'react';

// Player colors by position
const PLAYER_COLORS: Record<number, { border: string; text: string; shadow: string }> = {
  0: { border: 'border-orange-400', text: 'text-orange-400', shadow: 'shadow-orange-400/50' },
  1: { border: 'border-purple-400', text: 'text-purple-400', shadow: 'shadow-purple-400/50' },
  2: { border: 'border-cyan-400', text: 'text-cyan-400', shadow: 'shadow-cyan-400/50' },
  3: { border: 'border-lime-400', text: 'text-lime-400', shadow: 'shadow-lime-400/50' },
};

interface Player {
  id: string;
  name: string;
  position: number;
  is_you: boolean;
  is_cpu?: boolean;
  connected: boolean;
  tile_count: number;
}

interface TableSurfaceProps {
  children: ReactNode;
  players?: Player[];
  currentTurn?: string | null;
  avatarIds?: Record<number, number>;
}

function PlayerAvatar({
  player,
  isCurrent,
  avatarId,
  position
}: {
  player: Player;
  isCurrent: boolean;
  avatarId: number;
  position: 'top' | 'bottom' | 'left' | 'right';
}) {
  const colors = PLAYER_COLORS[player.position] || PLAYER_COLORS[0];
  const isHorizontal = position === 'left' || position === 'right';

  return (
    <div className={`flex items-center gap-2 ${isHorizontal ? 'flex-col' : 'flex-row'}`}>
      {/* Avatar container - extra padding for badge */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full overflow-hidden border-2 ${colors.border}
            ${isCurrent ? `animate-pulse shadow-lg ${colors.shadow}` : ''}
            ${player.is_you ? 'ring-2 ring-neon-amber/50' : ''}
            ${!player.connected ? 'opacity-50 grayscale' : ''}
          `}
          title={`${player.name}${player.is_cpu ? ' (CPU)' : ''}${!player.connected ? ' (disconnected)' : ''} - ${player.tile_count} tiles`}
        >
          <img
            src={`/images/avatar-${avatarId}.png`}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Tile count badge - outside the avatar circle */}
        <div className={`absolute -top-1 -right-1 w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-bar-dark border-2 ${colors.border}
          flex items-center justify-center text-[10px] lg:text-xs ${colors.text} font-bold`}>
          {player.tile_count}
        </div>
      </div>
      {/* Full name with backdrop */}
      <span className={`text-xs lg:text-sm ${colors.text} font-bold whitespace-nowrap
        bg-black/60 px-2 py-0.5 rounded-md`}>
        {player.is_you ? 'YOU' : player.name}
      </span>
    </div>
  );
}

export function TableSurface({ children, players, currentTurn, avatarIds }: TableSurfaceProps) {
  const getAvatarId = (position: number): number => {
    return avatarIds?.[position] || (position + 1);
  };

  const sortedPlayers = players ? [...players].sort((a, b) => a.position - b.position) : [];

  // Get players by position
  const playerByPosition = (pos: number) => sortedPlayers.find(p => p.position === pos);
  const p0 = playerByPosition(0); // bottom (you)
  const p1 = playerByPosition(1); // right
  const p2 = playerByPosition(2); // top
  const p3 = playerByPosition(3); // left

  const hasPlayers = players && players.length > 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Top player (P2) */}
      {hasPlayers && p2 && (
        <div className="mb-2 flex-shrink-0">
          <PlayerAvatar
            player={p2}
            isCurrent={p2.id === currentTurn}
            avatarId={getAvatarId(2)}
            position="top"
          />
        </div>
      )}

      {/* Middle row: Left player + Table + Right player */}
      <div className="flex items-center justify-center flex-1 min-h-0 w-full gap-2">
        {/* Left player (P3) */}
        {hasPlayers && p3 && (
          <div className="flex-shrink-0">
            <PlayerAvatar
              player={p3}
              isCurrent={p3.id === currentTurn}
              avatarId={getAvatarId(3)}
              position="left"
            />
          </div>
        )}

        {/* Table */}
        <div className="table-rim flex-1 min-w-0 h-full max-h-[60vh] flex items-center justify-center p-2 lg:p-3">
          <div className="table-felt w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
            {children}
          </div>
        </div>

        {/* Right player (P1) */}
        {hasPlayers && p1 && (
          <div className="flex-shrink-0">
            <PlayerAvatar
              player={p1}
              isCurrent={p1.id === currentTurn}
              avatarId={getAvatarId(1)}
              position="right"
            />
          </div>
        )}
      </div>

      {/* Bottom player (P0 - you) */}
      {hasPlayers && p0 && (
        <div className="mt-2 flex-shrink-0">
          <PlayerAvatar
            player={p0}
            isCurrent={p0.id === currentTurn}
            avatarId={getAvatarId(0)}
            position="bottom"
          />
        </div>
      )}
    </div>
  );
}
