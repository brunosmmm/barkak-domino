import { useRef, useMemo } from 'react';
import type {
  ChainTilePlacement,
  ChainEnd,
  ChainLayoutResult,
  PlayedDomino,
} from '../types';

interface UseChainLayoutOptions {
  board: PlayedDomino[];
  containerWidth: number;
  containerHeight: number;
  tileWidth: number;   // Base tile width (long dimension, will be scaled)
  tileHeight: number;  // Base tile height (short dimension, will be scaled)
  padding?: number;
  tilesPerRow?: number;    // Fixed number of tiles per horizontal arm before turning
  tilesPerColumn?: number; // Fixed number of tiles per vertical arm before turning (fewer due to shorter height)
}

export interface ChainTilePlacementExt extends ChainTilePlacement {
  renderHorizontal: boolean;
  renderWidth: number;
  renderHeight: number;
  flipped: boolean;  // True if tile should be rotated 180°
}

export interface ChainLayoutResultExt extends Omit<ChainLayoutResult, 'placements'> {
  placements: ChainTilePlacementExt[];
  scale: number;  // Scale factor applied to tiles
}

// Direction state for each arm
type Direction = 'E' | 'W' | 'S' | 'N';

interface ArmState {
  x: number;           // Connection point X (center of outgoing edge)
  y: number;           // Connection point Y (center of outgoing edge)
  direction: Direction;
  tileCount: number;   // Tiles placed on current row/column
  goingRight: boolean; // Track horizontal direction for snake pattern
  lastTileWidth: number;  // Width of the tile that created this arm state
  lastTileHeight: number; // Height of the tile that created this arm state
  lastTileWasDouble: boolean; // Whether last tile was a double (affects turn positioning)
}

// Stable key for caching tile positions
function dominoKey(d: { left: number; right: number }): string {
  return `${d.left}-${d.right}`;
}

interface CachedPosition {
  x: number;
  y: number;
  horizontal: boolean;
  width: number;
  height: number;
  isCorner: boolean;
  flipped: boolean;  // True if tile should be rotated 180° (for left arm vertical tiles)
}

interface LayoutCache {
  positions: Map<string, CachedPosition>;
  leftArm: ArmState;
  rightArm: ArmState;
  containerWidth: number;
  containerHeight: number;
  scale: number;
}

/**
 * Chain layout with DYNAMIC SCALING and FIXED TILES PER ROW.
 *
 * Inspired by reference domino game implementations:
 * - Tile size scales to fit container
 * - Fixed number of tiles per row (turns at count, not pixels)
 * - Each tile positioned relative to previous tile
 * - Positions cached and never recalculated
 */
export function useChainLayout({
  board,
  containerWidth,
  containerHeight,
  tileWidth: baseTileWidth,
  tileHeight: baseTileHeight,
  padding = 16,
  tilesPerRow = 5,
  tilesPerColumn = 3, // Fewer tiles vertically since container is typically wider than tall
}: UseChainLayoutOptions): ChainLayoutResultExt {
  const cacheRef = useRef<LayoutCache | null>(null);

  return useMemo(() => {
    if (board.length === 0 || containerWidth === 0 || containerHeight === 0) {
      cacheRef.current = null;
      return createEmptyLayout();
    }

    // Calculate dynamic tile size based on container width
    const availableWidth = containerWidth - padding * 2;
    // Cap scale at 1.5 to allow reasonably larger tiles on wide screens
    const rawScale = availableWidth / (tilesPerRow * baseTileWidth + baseTileWidth);
    const scale = Math.min(rawScale, 1.5);
    const tileWidth = Math.floor(baseTileWidth * scale);
    const tileHeight = Math.floor(baseTileHeight * scale);

    // Gap between tiles
    const gap = Math.max(2, Math.floor(4 * scale));

    // Check if cache needs reset
    let cache = cacheRef.current;
    const needsReset = !cache ||
      Math.abs(cache.scale - scale) > 0.01 ||  // Scale changed significantly
      cache.containerWidth !== containerWidth ||
      cache.containerHeight !== containerHeight ||
      (cache.positions.size > 0 && board.length === 1); // New game

    if (needsReset) {
      // Initialize with first tile at center
      const firstTile = board[0];
      const isDouble = firstTile.domino.left === firstTile.domino.right;
      const horizontal = !isDouble;
      const width = horizontal ? tileWidth : tileHeight;
      const height = horizontal ? tileHeight : tileWidth;

      const centerX = (containerWidth - width) / 2;
      const centerY = (containerHeight - height) / 2;

      const positions = new Map<string, CachedPosition>();
      positions.set(dominoKey(firstTile.domino), {
        x: centerX,
        y: centerY,
        horizontal,
        width,
        height,
        isCorner: false,
        flipped: false,  // First tile is never flipped
      });

      cache = {
        positions,
        leftArm: {
          x: centerX,
          y: centerY + height / 2,
          direction: 'W',
          tileCount: 0,
          goingRight: false,  // Left arm starts going left
          lastTileWidth: width,
          lastTileHeight: height,
          lastTileWasDouble: isDouble,
        },
        rightArm: {
          x: centerX + width,
          y: centerY + height / 2,
          direction: 'E',
          tileCount: 0,
          goingRight: true,   // Right arm starts going right
          lastTileWidth: width,
          lastTileHeight: height,
          lastTileWasDouble: isDouble,
        },
        containerWidth,
        containerHeight,
        scale,
      };
      cacheRef.current = cache;
    }

    // At this point, cache is guaranteed to be non-null
    // (either we used existing cache or created a new one)
    const safeCache = cache!;

    // Process new tiles at each end
    const leftTile = board[0];
    const rightTile = board[board.length - 1];
    const leftKey = dominoKey(leftTile.domino);
    const rightKey = dominoKey(rightTile.domino);

    // Left arm: new tile at board[0]
    if (!safeCache.positions.has(leftKey)) {
      const isDouble = leftTile.domino.left === leftTile.domino.right;
      const result = placeNextTile(
        safeCache.leftArm,
        isDouble,
        tileWidth,
        tileHeight,
        gap,
        tilesPerRow,
        tilesPerColumn
      );

      safeCache.positions.set(leftKey, result.position);
      safeCache.leftArm = result.newArm;
    }

    // Right arm: new tile at board[N-1]
    if (rightKey !== leftKey && !safeCache.positions.has(rightKey)) {
      const isDouble = rightTile.domino.left === rightTile.domino.right;
      const result = placeNextTile(
        safeCache.rightArm,
        isDouble,
        tileWidth,
        tileHeight,
        gap,
        tilesPerRow,
        tilesPerColumn
      );

      safeCache.positions.set(rightKey, result.position);
      safeCache.rightArm = result.newArm;
    }

    // Build placements array
    const placements: ChainTilePlacementExt[] = board.map((tile, index) => {
      const key = dominoKey(tile.domino);
      const cached = safeCache.positions.get(key);

      if (cached) {
        return {
          tileIndex: index,
          position: { x: cached.x, y: cached.y },
          rotation: cached.flipped ? 180 : 0,
          isCorner: cached.isCorner,
          isDouble: tile.domino.left === tile.domino.right,
          renderHorizontal: cached.horizontal,
          renderWidth: cached.width,
          renderHeight: cached.height,
          flipped: cached.flipped,
        };
      }

      // Fallback (shouldn't happen)
      const isDouble = tile.domino.left === tile.domino.right;
      return {
        tileIndex: index,
        position: { x: padding + index * (tileWidth + gap), y: containerHeight / 2 },
        rotation: 0,
        isCorner: false,
        isDouble,
        renderHorizontal: !isDouble,
        renderWidth: isDouble ? tileHeight : tileWidth,
        renderHeight: isDouble ? tileWidth : tileHeight,
        flipped: false,
      };
    });

    // Chain ends for play buttons
    const leftEnd: ChainEnd = {
      position: { x: safeCache.leftArm.x, y: safeCache.leftArm.y },
      growthDirection: safeCache.leftArm.direction,
      pipValue: board[0]?.domino.left ?? null,
    };

    const rightEnd: ChainEnd = {
      position: { x: safeCache.rightArm.x, y: safeCache.rightArm.y },
      growthDirection: safeCache.rightArm.direction,
      pipValue: board[board.length - 1]?.domino.right ?? null,
    };

    return {
      placements,
      leftEnd,
      rightEnd,
      bounds: { minX: 0, maxX: containerWidth, minY: 0, maxY: containerHeight },
      offsetX: 0,
      offsetY: 0,
      scale,
    };
  }, [board, containerWidth, containerHeight, baseTileWidth, baseTileHeight, padding, tilesPerRow, tilesPerColumn]);
}

interface PlaceResult {
  position: CachedPosition;
  newArm: ArmState;
}

/**
 * Place the next tile and return new arm state.
 * Uses COUNT-BASED turns (not boundary detection).
 *
 * Key concepts:
 * - Arm position (x, y) is always the CENTER of the outgoing edge of the last tile
 * - When turning, we adjust the arm position to the correct edge for the new direction
 * - Doubles are always perpendicular to the chain direction
 * - At corners, we don't double-rotate doubles
 */
function placeNextTile(
  arm: ArmState,
  isDouble: boolean,
  tileWidth: number,  // Long dimension of a horizontal tile
  tileHeight: number, // Short dimension of a horizontal tile
  gap: number,
  tilesPerRow: number,
  tilesPerColumn: number
): PlaceResult {
  let { x, y, direction, tileCount, goingRight, lastTileWidth, lastTileHeight, lastTileWasDouble } = arm;
  let isCorner = false;

  // Determine max tiles for current direction
  const maxTiles = isHorizontal(direction) ? tilesPerRow : tilesPerColumn;

  // Check if we need to turn (count-based)
  if (tileCount >= maxTiles) {
    isCorner = true;
    tileCount = 0;

    // When turning, adjust arm position from one edge to the NEW outgoing edge
    // Key insight: domino tiles have two halves. The "outgoing half" is where the next tile connects.
    // For E direction: right half is outgoing → connection at 3/4 of tile width from left
    // For W direction: left half is outgoing → connection at 1/4 of tile width from left
    // For S direction: bottom half is outgoing → connection at 3/4 of tile height from top
    // For N direction: top half is outgoing → connection at 1/4 of tile height from top
    // EXCEPTION: Doubles are symmetric, so we move to tile center (1/2) instead
    const xFraction = lastTileWasDouble ? 1/2 : 1/4;
    const yFraction = lastTileWasDouble ? 1/2 : 1/4;

    if (isHorizontal(direction)) {
      // Turning from E/W to S (going down)
      // Move to bottom edge, but at the CENTER OF THE OUTGOING HALF (not tile center)
      // For doubles: move to tile center (they're symmetric)
      if (direction === 'E') {
        // Arm is at right edge center. Outgoing half is the right half.
        // Move to: center of right half's bottom edge = 3/4 width from tile left
        // From right edge: move left by 1/4 width (or 1/2 for doubles)
        x = x - lastTileWidth * xFraction;
        y = y + lastTileHeight / 2;
      } else {
        // Arm is at left edge center. Outgoing half is the left half.
        // Move to: center of left half's bottom edge = 1/4 width from tile left
        // From left edge: move right by 1/4 width (or 1/2 for doubles)
        x = x + lastTileWidth * xFraction;
        y = y + lastTileHeight / 2;
      }
      direction = 'S';
    } else {
      // Turning from S/N to E or W (going horizontal)
      // Move to horizontal edge, but at the CENTER OF THE OUTGOING HALF
      // For doubles: move to tile center (they're symmetric)
      if (direction === 'S') {
        // Arm is at bottom edge center. Outgoing half is the bottom half.
        // Move to: center of bottom half's side edge = 3/4 height from tile top
        // From bottom edge: move up by 1/4 height (or 1/2 for doubles)
        y = y - lastTileHeight * yFraction;
        if (goingRight) {
          x = x + lastTileWidth / 2;
        } else {
          x = x - lastTileWidth / 2;
        }
      } else {
        // Arm is at top edge center. Outgoing half is the top half.
        // Move to: center of top half's side edge = 1/4 height from tile top
        // From top edge: move down by 1/4 height (or 1/2 for doubles)
        y = y + lastTileHeight * yFraction;
        if (goingRight) {
          x = x + lastTileWidth / 2;
        } else {
          x = x - lastTileWidth / 2;
        }
      }
      direction = goingRight ? 'E' : 'W';
    }
  }

  // Calculate tile dimensions based on direction
  // Regular tiles align with growth direction (long side parallel to direction)
  // Doubles are perpendicular (short side parallel to direction)
  // EXCEPTION: At corners, doubles align WITH the new direction (not perpendicular)
  // This allows the double to bridge the turn - connecting incoming and outgoing directions
  let horizontal: boolean;
  if (isCorner && isDouble) {
    // Corner double: align with the new direction
    horizontal = isHorizontal(direction);
  } else {
    // Normal behavior: regular tiles align, doubles are perpendicular
    horizontal = isHorizontal(direction) ? !isDouble : isDouble;
  }
  const width = horizontal ? tileWidth : tileHeight;
  const height = horizontal ? tileHeight : tileWidth;

  // Calculate position relative to arm connection point
  let tileX: number, tileY: number;
  let newX: number, newY: number;

  switch (direction) {
    case 'E':
      // Growing east: place tile to the right of arm, centered vertically
      tileX = x + gap;
      tileY = y - height / 2;
      // New arm at right edge center (same Y since tile is centered on y)
      newX = tileX + width;
      newY = y;
      break;
    case 'W':
      // Growing west: place tile to the left of arm, centered vertically
      tileX = x - width - gap;
      tileY = y - height / 2;
      // New arm at left edge center
      newX = tileX;
      newY = y;
      break;
    case 'S':
      // Growing south: place tile below arm, centered horizontally on arm.x
      tileX = x - width / 2;
      tileY = y + gap;
      // New arm at bottom edge center
      newX = x;
      newY = tileY + height;
      break;
    case 'N':
      // Growing north: place tile above arm, centered horizontally on arm.x
      tileX = x - width / 2;
      tileY = y - height - gap;
      // New arm at top edge center
      newX = x;
      newY = tileY;
      break;
  }

  // Left arm vertical tiles need to be flipped 180°
  // This is because on the left arm, tiles connect via their RIGHT pip,
  // but DominoTile renders LEFT on top for vertical tiles.
  // Flipping puts RIGHT on top where it should be for proper chain connection.
  const flipped = !goingRight && !horizontal;

  return {
    position: {
      x: tileX,
      y: tileY,
      horizontal,
      width,
      height,
      isCorner,
      flipped,
    },
    newArm: {
      x: newX,
      y: newY,
      direction,
      tileCount: tileCount + 1,
      goingRight,
      lastTileWidth: width,
      lastTileHeight: height,
      lastTileWasDouble: isDouble,
    },
  };
}

function isHorizontal(dir: Direction): boolean {
  return dir === 'E' || dir === 'W';
}

function createEmptyLayout(): ChainLayoutResultExt {
  return {
    placements: [],
    leftEnd: { position: { x: 0, y: 0 }, growthDirection: 'W', pipValue: null },
    rightEnd: { position: { x: 0, y: 0 }, growthDirection: 'E', pipValue: null },
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  };
}

export { useSnakeLayout } from './useSnakeLayout';
