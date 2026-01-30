import { DominoTile } from './DominoTile';
import { TableSurface } from './TableSurface';
import { useGameStore } from '../store/gameStore';
import { useContainerSize } from '../hooks/useContainerWidth';
import { useChainLayout, type ChainTilePlacementExt } from '../hooks/useChainLayout';
import type { GrowthDirection } from '../types';

// Player colors based on position (0-3)
const PLAYER_COLORS: Record<number, { ring: string; shadow: string; bg: string }> = {
  0: { ring: 'ring-orange-400', shadow: 'shadow-orange-400/60', bg: 'bg-orange-400' },
  1: { ring: 'ring-purple-400', shadow: 'shadow-purple-400/60', bg: 'bg-purple-400' },
  2: { ring: 'ring-cyan-400', shadow: 'shadow-cyan-400/60', bg: 'bg-cyan-400' },
  3: { ring: 'ring-lime-400', shadow: 'shadow-lime-400/60', bg: 'bg-lime-400' },
};

// Base tile dimensions - will be scaled dynamically
const BASE_TILE = { width: 64, height: 32 };

interface GameBoardProps {
  onPlayLeft: () => void;
  onPlayRight: () => void;
  isYourTurn: boolean;
}

export function GameBoard({ onPlayLeft, onPlayRight, isYourTurn }: GameBoardProps) {
  const { gameState, selectedDomino, lastPlayedTile } = useGameStore();
  const [containerRef, containerSize] = useContainerSize();

  // Compute adaptive tiles per row/column based on container dimensions
  // Portrait mode: fewer tiles per row (narrower), more tiles per column (taller)
  // Landscape mode: more tiles per row, fewer per column
  const aspectRatio = containerSize.width > 0 && containerSize.height > 0
    ? containerSize.width / containerSize.height
    : 1;

  // Adaptive snaking: adjust tile counts based on aspect ratio
  const tilesPerRow = aspectRatio < 0.8 ? 3 : aspectRatio < 1.2 ? 4 : 5;
  const tilesPerColumn = aspectRatio < 0.8 ? 3 : 2;

  const layout = useChainLayout({
    board: gameState?.board ?? [],
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    tileWidth: BASE_TILE.width,
    tileHeight: BASE_TILE.height,
    padding: 16,
    tilesPerRow,
    tilesPerColumn,
  });

  if (!gameState) return null;

  const { board, ends, players } = gameState;

  const getPlayerPosition = (playerId: string): number => {
    const player = players.find(p => p.id === playerId);
    return player?.position ?? 0;
  };

  const getPlayerColorClasses = (): { ring: string; shadow: string } => {
    if (!lastPlayedTile) return { ring: 'ring-neon-amber', shadow: 'shadow-neon-amber/50' };
    const position = getPlayerPosition(lastPlayedTile.playerId);
    return PLAYER_COLORS[position] || PLAYER_COLORS[0];
  };

  const isLastPlayed = (index: number): boolean => {
    if (!lastPlayedTile) return false;
    if (lastPlayedTile.position === 0 && index === 0) return true;
    if (lastPlayedTile.position === -1 && index === board.length - 1) return true;
    return false;
  };

  const canPlayOnSide = (side: 'left' | 'right'): boolean => {
    if (!selectedDomino) return false;
    const targetEnd = side === 'left' ? ends.left : ends.right;
    if (targetEnd === null) return true;
    return selectedDomino.left === targetEnd || selectedDomino.right === targetEnd;
  };

  const getDirectionArrow = (direction: GrowthDirection): string => {
    switch (direction) {
      case 'N': return '↑';
      case 'S': return '↓';
      case 'E': return '→';
      case 'W': return '←';
    }
  };

  // Render tile with absolute positioning and dynamic scaling
  const renderChainTile = (placement: ChainTilePlacementExt) => {
    const played = board[placement.tileIndex];
    if (!played) return null;

    const justPlayed = isLastPlayed(placement.tileIndex);
    const stableKey = `chain-${placement.tileIndex}-${played.domino.left}-${played.domino.right}`;
    const playerColors = getPlayerColorClasses();

    // Build transform: scale + optional rotation for flipped tiles
    // For flipped tiles, we need to:
    // 1. Scale from top-left (so positioning is consistent)
    // 2. Then rotate 180° around the CENTER of the SCALED element
    // This is achieved by: scale, then translate to center, rotate, translate back
    const scaledW = placement.renderWidth;
    const scaledH = placement.renderHeight;
    const transform = placement.flipped
      ? `translate(${scaledW / 2}px, ${scaledH / 2}px) rotate(180deg) translate(-${scaledW / 2}px, -${scaledH / 2}px) scale(${layout.scale})`
      : `scale(${layout.scale})`;
    const transformOrigin = 'top left';  // Always scale from top-left for consistent positioning

    // Z-index based on distance from board center - tiles at ends (newest) are on top
    // This ensures proper stacking for both left and right arm plays
    const centerIndex = (board.length - 1) / 2;
    const distanceFromCenter = Math.abs(placement.tileIndex - centerIndex);
    const baseZIndex = Math.round(distanceFromCenter) + 1;

    return (
      <div
        key={stableKey}
        className={`absolute ${
          justPlayed
            ? `animate-pulse ring-2 ${playerColors.ring} ring-opacity-90 rounded shadow-lg ${playerColors.shadow}`
            : ''
        }`}
        style={{
          left: placement.position.x,
          top: placement.position.y,
          width: placement.renderWidth,
          height: placement.renderHeight,
          zIndex: justPlayed ? 10 : baseZIndex,
        }}
      >
        {/* Scale transform applied only to the tile, not the container (to keep ring effect at correct size) */}
        <div style={{ transform, transformOrigin }}>
          <DominoTile domino={played.domino} horizontal={placement.renderHorizontal} size="sm" />
        </div>
      </div>
    );
  };

  // Render play button at chain end
  const renderPlayButtonAtEnd = (
    side: 'left' | 'right',
    canPlay: boolean,
    canPlayBoth: boolean,
    onClick: () => void
  ) => {
    if (!canPlay) return null;

    const isLeft = side === 'left';
    const endValue = isLeft ? ends.left : ends.right;
    const testId = isLeft ? 'play-left-btn' : 'play-right-btn';
    const chainEnd = isLeft ? layout.leftEnd : layout.rightEnd;
    const arrow = getDirectionArrow(chainEnd.growthDirection);

    // Scale button size based on layout scale
    const buttonWidth = Math.floor(80 * layout.scale);
    const buttonHeight = Math.floor(48 * layout.scale);
    const buttonGap = Math.floor(8 * layout.scale);

    let buttonX = chainEnd.position.x;
    let buttonY = chainEnd.position.y - buttonHeight / 2;

    switch (chainEnd.growthDirection) {
      case 'E':
        buttonX += buttonGap;
        break;
      case 'W':
        buttonX -= buttonWidth + buttonGap;
        break;
      case 'N':
        buttonX -= buttonWidth / 2;
        buttonY = chainEnd.position.y - buttonHeight - buttonGap;
        break;
      case 'S':
        buttonX -= buttonWidth / 2;
        buttonY = chainEnd.position.y + buttonGap;
        break;
    }

    return (
      <button
        key={`play-btn-${side}`}
        onClick={onClick}
        data-testid={testId}
        data-end-value={endValue}
        className={`absolute border-2 border-dashed rounded-lg
                   flex items-center justify-center
                   transition-all z-20
                   ${canPlayBoth
                     ? 'border-green-400 text-green-400 hover:bg-green-400/20 animate-pulse shadow-lg shadow-green-400/30'
                     : 'border-neon-amber text-neon-amber hover:bg-neon-amber/20'}`}
        style={{
          left: Math.max(8, Math.min(buttonX, containerSize.width - buttonWidth - 8)),
          top: Math.max(8, Math.min(buttonY, containerSize.height - buttonHeight - 8)),
          width: buttonWidth,
          height: buttonHeight,
          fontSize: Math.max(12, Math.floor(16 * layout.scale)),
        }}
      >
        {arrow} {endValue}
      </button>
    );
  };

  if (board.length === 0) {
    return (
      <div className="flex-1 p-2 lg:p-4 min-h-0" data-testid="game-board" data-board-empty="true">
        <TableSurface
          players={players}
          currentTurn={gameState.current_turn}
          avatarIds={gameState.match?.avatar_ids}
        >
          <div className="text-white/50 text-xl">
            {!isYourTurn ? (
              <span className="text-gray-400">Waiting for first move...</span>
            ) : (
              <span className="text-neon-amber">Select a tile to play</span>
            )}
          </div>
        </TableSurface>
      </div>
    );
  }

  const canShowPlayZones = isYourTurn && !!selectedDomino;
  const showLeftZone = canShowPlayZones && canPlayOnSide('left');
  const showRightZone = canShowPlayZones && canPlayOnSide('right');
  const canPlayBothSides = !!(showLeftZone && showRightZone);

  const isLayoutReady = containerSize.width > 0 && containerSize.height > 0 && layout.placements.length > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 lg:p-4 min-h-0 overflow-hidden" data-testid="game-board" data-board-tiles={board.length}>
      {/* Choose side prompt */}
      <div className={`mb-2 px-4 py-1.5 rounded-full z-10 transition-opacity duration-200 ${
        canPlayBothSides
          ? 'bg-gradient-to-r from-green-500/20 via-emerald-500/30 to-green-500/20 border border-green-400/50 animate-pulse opacity-100'
          : 'opacity-0'
      }`}>
        <span className="text-green-300 text-sm font-medium">
          Can play on both sides! Choose one
        </span>
      </div>

      {/* Table surface */}
      <div className="w-full flex-1 min-h-0">
        <TableSurface
          players={players}
          currentTurn={gameState.current_turn}
          avatarIds={gameState.match?.avatar_ids}
        >
          <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden"
            data-testid="board-tiles"
          >
            {!isLayoutReady ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/30">
                Loading board...
              </div>
            ) : (
              <>
                {layout.placements.map(renderChainTile)}
                {renderPlayButtonAtEnd('left', showLeftZone ?? false, canPlayBothSides, onPlayLeft)}
                {renderPlayButtonAtEnd('right', showRightZone ?? false, canPlayBothSides, onPlayRight)}
              </>
            )}
          </div>
        </TableSurface>
      </div>

      {/* Tile count */}
      <div className="mt-2 text-xs text-gray-500">
        {board.length} tiles on board
      </div>
    </div>
  );
}
