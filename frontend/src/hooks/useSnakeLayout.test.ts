import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSnakeLayout } from './useSnakeLayout';

describe('useSnakeLayout', () => {
  // Tile dimensions (mobile size)
  const tileWidth = 64;
  const tileHeight = 32;
  const padding = 16;
  const playButtonWidth = 88;

  describe('empty and zero-width cases', () => {
    it('returns empty layout for zero tiles', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 0,
          containerWidth: 800,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.rows).toEqual([]);
      expect(result.current.tilesPerRow).toBe(0);
    });

    it('returns empty layout for zero container width', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 0,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.rows).toEqual([]);
    });
  });

  describe('single row layout', () => {
    it('keeps all tiles in one row when they fit', () => {
      // Container: 800px
      // Available: 800 - 16*2 (padding) - 88*2 (buttons) = 592px
      // Space for regular tiles: 592 - 32 (corner) = 560px
      // Tiles per row: floor(560/64) = 8
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 5,
          containerWidth: 800,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
        })
      );

      expect(result.current.rows.length).toBe(1);
      expect(result.current.rows[0].length).toBe(5);
      expect(result.current.tilesPerRow).toBeGreaterThanOrEqual(5);

      // No corners in single row
      result.current.rows[0].forEach(tile => {
        expect(tile.isCorner).toBe(false);
        expect(tile.rotation).toBe(0);
      });
    });

    it('respects minimum tiles per row', () => {
      // Very narrow container
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 2,
          containerWidth: 100,
          tileWidth,
          tileHeight,
          minTilesPerRow: 3,
        })
      );

      expect(result.current.tilesPerRow).toBeGreaterThanOrEqual(3);
    });
  });

  describe('multi-row snake layout', () => {
    it('wraps to multiple rows when tiles exceed capacity', () => {
      // Container: 400px
      // Available: 400 - 16*2 - 88*2 = 192px
      // Space for regular tiles: 192 - 32 = 160px
      // Tiles per row: floor(160/64) = 2, but min is 3
      // So tilesPerRow = 3
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 400,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      expect(result.current.rows.length).toBeGreaterThan(1);
      console.log('Tiles per row:', result.current.tilesPerRow);
      console.log('Rows:', result.current.rows.length);
      console.log('Row contents:', result.current.rows.map(r => r.length));
    });

    it('marks corner tiles in non-last rows', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 400,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      // All rows except last should have corner tile
      for (let i = 0; i < result.current.rows.length - 1; i++) {
        const row = result.current.rows[i];
        const lastTile = row[row.length - 1];
        expect(lastTile.isCorner).toBe(true);
        expect(lastTile.rotation).not.toBe(0);
      }

      // Last row should not have corner
      const lastRow = result.current.rows[result.current.rows.length - 1];
      lastRow.forEach(tile => {
        expect(tile.isCorner).toBe(false);
      });
    });

    it('alternates rotation direction by row', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 15,
          containerWidth: 400,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      // Even rows rotate 90, odd rows rotate -90
      for (let i = 0; i < result.current.rows.length - 1; i++) {
        const row = result.current.rows[i];
        const lastTile = row[row.length - 1];
        if (lastTile.isCorner) {
          const expectedRotation = i % 2 === 0 ? 90 : -90;
          expect(lastTile.rotation).toBe(expectedRotation);
        }
      }
    });
  });

  describe('play button positioning', () => {
    it('left end is always in row 0', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 400,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.leftEndRow).toBe(0);
    });

    it('right end is in last row', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 400,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.rightEndRow).toBe(result.current.rows.length - 1);
    });
  });

  describe('tile index continuity', () => {
    it('maintains correct tile indices across rows', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 10,
          containerWidth: 400,
          tileWidth,
          tileHeight,
        })
      );

      let expectedIndex = 0;
      for (const row of result.current.rows) {
        for (const tile of row) {
          expect(tile.tileIndex).toBe(expectedIndex);
          expectedIndex++;
        }
      }
      expect(expectedIndex).toBe(10);
    });
  });

  describe('real-world scenarios', () => {
    it('activates snake mode at 409px with 4+ tiles', () => {
      // This matches the Playwright test conditions
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 4,
          containerWidth: 409,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      console.log('=== 409px with 4 tiles ===');
      console.log('Tiles per row:', result.current.tilesPerRow);
      console.log('Total rows:', result.current.rows.length);
      console.log('hasSnakeLayout:', result.current.rows.length > 1);

      // At 409px:
      // available = 409 - 32 - 176 = 201
      // regularSpace = 201 - 32 = 169
      // tilesPerRow = max(floor(169/64), 3) = max(2, 3) = 3
      // With 4 tiles > 3 tilesPerRow, should have 2 rows
      expect(result.current.rows.length).toBe(2);
    });

    it('stays single row at 409px with 3 tiles', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 3,
          containerWidth: 409,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      console.log('=== 409px with 3 tiles ===');
      console.log('Tiles per row:', result.current.tilesPerRow);
      console.log('Total rows:', result.current.rows.length);

      // 3 tiles <= 3 tilesPerRow, single row
      expect(result.current.rows.length).toBe(1);
    });

    it('handles 12 tiles at narrow viewport', () => {
      const { result } = renderHook(() =>
        useSnakeLayout({
          totalTiles: 12,
          containerWidth: 400,
          tileWidth,
          tileHeight,
          padding,
          playButtonWidth,
          minTilesPerRow: 3,
        })
      );

      console.log('=== 400px with 12 tiles ===');
      console.log('Tiles per row:', result.current.tilesPerRow);
      console.log('Total rows:', result.current.rows.length);
      console.log('Row sizes:', result.current.rows.map(r => r.length));

      // 12 tiles / 3 per row = 4 rows
      expect(result.current.rows.length).toBe(4);
      expect(result.current.rows[0].length).toBe(3);
      expect(result.current.rows[1].length).toBe(3);
      expect(result.current.rows[2].length).toBe(3);
      expect(result.current.rows[3].length).toBe(3);
    });
  });
});
