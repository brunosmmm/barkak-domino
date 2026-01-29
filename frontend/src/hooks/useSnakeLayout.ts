import { useMemo } from 'react';

export interface TileLayoutInfo {
  tileIndex: number;     // Index in board array
  row: number;           // Row number (0-indexed)
  isCorner: boolean;     // Last tile in row (needs rotation for turn)
  rotation: number;      // 0, 90, or -90 degrees
}

export interface SnakeLayoutResult {
  rows: TileLayoutInfo[][];
  leftEndRow: number;    // Which row has the left play button
  rightEndRow: number;   // Which row has the right play button
  tilesPerRow: number;
}

interface UseSnakeLayoutOptions {
  totalTiles: number;
  containerWidth: number;
  tileWidth: number;           // Width of horizontal tile
  tileHeight: number;          // Height of horizontal tile (= width of vertical corner tile)
  padding?: number;            // Container padding
  minTilesPerRow?: number;     // Minimum tiles per row (default: 3)
  playButtonWidth?: number;    // Width reserved for play buttons
}

/**
 * Calculates snake layout for domino tiles.
 *
 * Tiles wrap to new rows when approaching container edge.
 * Even rows go left-to-right, odd rows go right-to-left.
 * Corner tiles rotate to create the "turn" visual.
 */
export function useSnakeLayout({
  totalTiles,
  containerWidth,
  tileWidth,
  tileHeight,
  padding = 16,
  minTilesPerRow = 3,
  playButtonWidth = 88, // ~w-20 + margin
}: UseSnakeLayoutOptions): SnakeLayoutResult {
  return useMemo(() => {
    // Empty or no container width - return empty layout
    if (totalTiles === 0 || containerWidth === 0) {
      return {
        rows: [],
        leftEndRow: 0,
        rightEndRow: 0,
        tilesPerRow: 0,
      };
    }

    // Calculate available width (container minus padding and play buttons)
    const availableWidth = containerWidth - padding * 2 - playButtonWidth * 2;

    // Calculate tiles per row
    // Reserve space for corner connector tile (vertical tile = tileHeight width)
    const regularTileSpace = availableWidth - tileHeight;
    let tilesPerRow = Math.floor(regularTileSpace / tileWidth);

    // Enforce minimum and handle edge cases
    tilesPerRow = Math.max(tilesPerRow, minTilesPerRow);

    // If all tiles fit in one row, just show them
    if (totalTiles <= tilesPerRow) {
      const singleRow: TileLayoutInfo[] = [];
      for (let i = 0; i < totalTiles; i++) {
        singleRow.push({
          tileIndex: i,
          row: 0,
          isCorner: false,
          rotation: 0,
        });
      }
      return {
        rows: [singleRow],
        leftEndRow: 0,
        rightEndRow: 0,
        tilesPerRow,
      };
    }

    // Distribute tiles into rows
    const rows: TileLayoutInfo[][] = [];
    let currentIndex = 0;

    while (currentIndex < totalTiles) {
      const rowIndex = rows.length;
      const isLastRow = currentIndex + tilesPerRow >= totalTiles;
      const tilesInThisRow = isLastRow
        ? totalTiles - currentIndex
        : tilesPerRow;

      const row: TileLayoutInfo[] = [];

      for (let i = 0; i < tilesInThisRow; i++) {
        const tileIndex = currentIndex + i;
        const isLastInRow = i === tilesInThisRow - 1 && !isLastRow;

        // Corner tiles rotate:
        // - Even rows (L-to-R): last tile rotates 90° (turns down)
        // - Odd rows (R-to-L): last tile rotates -90° (turns down)
        let rotation = 0;
        if (isLastInRow) {
          rotation = rowIndex % 2 === 0 ? 90 : -90;
        }

        row.push({
          tileIndex,
          row: rowIndex,
          isCorner: isLastInRow,
          rotation,
        });
      }

      rows.push(row);
      currentIndex += tilesInThisRow;
    }

    // Determine which rows have the play buttons
    // Left end (index 0) is always at start of row 0
    const leftEndRow = 0;
    // Right end (last tile) is in the last row
    const rightEndRow = rows.length - 1;

    return {
      rows,
      leftEndRow,
      rightEndRow,
      tilesPerRow,
    };
  }, [totalTiles, containerWidth, tileWidth, tileHeight, padding, minTilesPerRow, playButtonWidth]);
}
