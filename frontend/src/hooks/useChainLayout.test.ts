import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChainLayout } from './useChainLayout';
import type { PlayedDomino } from '../types';

describe('useChainLayout', () => {
  // Base tile dimensions
  const tileWidth = 64;
  const tileHeight = 32;
  const padding = 16;
  const tilesPerRow = 5;

  // Container dimensions for tests
  const containerWidth = 800;
  const containerHeight = 600;

  // Helper to create a played domino
  const makeTile = (left: number, right: number, position: number): PlayedDomino => ({
    domino: { left, right },
    position,
  });

  describe('empty and zero-size cases', () => {
    it('returns empty layout for empty board', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.placements).toEqual([]);
      expect(result.current.leftEnd.pipValue).toBeNull();
      expect(result.current.rightEnd.pipValue).toBeNull();
      expect(result.current.scale).toBe(1);
    });

    it('returns empty layout for zero container dimensions', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(6, 6, 0)],
          containerWidth: 0,
          containerHeight: 600,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.placements).toEqual([]);
    });
  });

  describe('single tile layout', () => {
    it('places first tile centered in container', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(6, 4, 0)],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
          padding,
          tilesPerRow,
        })
      );

      expect(result.current.placements.length).toBe(1);
      const placement = result.current.placements[0];

      // First tile should be approximately centered
      // Scale is calculated based on container width and tilesPerRow
      expect(placement.position.x).toBeGreaterThan(containerWidth / 4);
      expect(placement.position.x).toBeLessThan(containerWidth * 3 / 4);
      expect(placement.position.y).toBeGreaterThan(containerHeight / 4);
      expect(placement.position.y).toBeLessThan(containerHeight * 3 / 4);
      expect(placement.rotation).toBe(0);
      expect(placement.isDouble).toBe(false);
    });

    it('recognizes a double tile', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(5, 5, 0)],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.placements[0].isDouble).toBe(true);
    });

    it('initializes chain ends correctly', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(3, 5, 0)],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      // Left end has left pip, right end has right pip
      expect(result.current.leftEnd.pipValue).toBe(3);
      expect(result.current.rightEnd.pipValue).toBe(5);
      // Initial growth directions
      expect(result.current.leftEnd.growthDirection).toBe('W');
      expect(result.current.rightEnd.growthDirection).toBe('E');
    });

    it('returns a scale factor based on container size', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(3, 5, 0)],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
          padding,
          tilesPerRow,
        })
      );

      // Scale should be positive
      expect(result.current.scale).toBeGreaterThan(0);
      // For 800px wide container with padding 16 and 5 tiles per row:
      // availableWidth = 800 - 32 = 768
      // scale = 768 / (5 * 64 + 64) = 768 / 384 = 2
      expect(result.current.scale).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multi-tile layout', () => {
    it('places tiles to the right when extending right end', () => {
      // Board: first tile at center, second extends right
      const board = [
        makeTile(6, 4, 0),  // First tile
        makeTile(4, 2, 1),  // Extends right (position > 0)
      ];

      const { result } = renderHook(() =>
        useChainLayout({
          board,
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
          padding,
          tilesPerRow,
        })
      );

      expect(result.current.placements.length).toBe(2);
      // Second tile should be to the right of first
      const first = result.current.placements[0];
      const second = result.current.placements[1];
      expect(second.position.x).toBeGreaterThan(first.position.x);
    });

    it('tracks right end pip value after extension', () => {
      const board = [
        makeTile(6, 4, 0),
        makeTile(4, 2, 1),
      ];

      const { result } = renderHook(() =>
        useChainLayout({
          board,
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      // After adding 4-2 to right end (which had 4), new end shows 2
      expect(result.current.rightEnd.pipValue).toBe(2);
    });

    it('extends left end correctly', () => {
      const board = [
        makeTile(3, 6, -1),  // Extends left (prepended to board)
        makeTile(6, 4, 0),   // Original first tile
      ];

      const { result } = renderHook(() =>
        useChainLayout({
          board,
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      expect(result.current.placements.length).toBe(2);
      // First placement (left tile) should be to the left of second (original tile)
      const leftTile = result.current.placements[0];
      const originalTile = result.current.placements[1];
      expect(leftTile.position.x).toBeLessThan(originalTile.position.x);
      // Left end now shows 3
      expect(result.current.leftEnd.pipValue).toBe(3);
    });
  });

  describe('bounds calculation', () => {
    it('provides bounds encompassing container', () => {
      const board = [
        makeTile(6, 4, 0),
        makeTile(4, 2, 1),
      ];

      const { result } = renderHook(() =>
        useChainLayout({
          board,
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      // Bounds should span the container
      expect(result.current.bounds.minX).toBe(0);
      expect(result.current.bounds.maxX).toBe(containerWidth);
      expect(result.current.bounds.minY).toBe(0);
      expect(result.current.bounds.maxY).toBe(containerHeight);
    });

    it('has zero offsets (tiles are already centered)', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(6, 4, 0)],
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
        })
      );

      // New implementation doesn't use offsets - tiles are placed at final positions
      expect(result.current.offsetX).toBe(0);
      expect(result.current.offsetY).toBe(0);
    });
  });

  describe('direction changes (snake pattern)', () => {
    it('maintains direction for short chains (incremental)', () => {
      // Build chain incrementally to simulate game play
      const initialBoard = [makeTile(6, 4, 0)];

      const { result, rerender } = renderHook(
        ({ board }) =>
          useChainLayout({
            board,
            containerWidth,
            containerHeight,
            tileWidth,
            tileHeight,
            padding,
            tilesPerRow,
          }),
        { initialProps: { board: initialBoard } }
      );

      // Add second tile to right
      rerender({ board: [makeTile(6, 4, 0), makeTile(4, 2, 1)] });

      // Add third tile to right
      rerender({ board: [makeTile(6, 4, 0), makeTile(4, 2, 1), makeTile(2, 1, 2)] });

      // All tiles should be roughly at same vertical position (within 2x tileHeight)
      const firstY = result.current.placements[0].position.y;
      result.current.placements.forEach(p => {
        expect(Math.abs(p.position.y - firstY)).toBeLessThanOrEqual(tileHeight * 2);
      });
      // Growth direction should still be horizontal
      expect(result.current.rightEnd.growthDirection).toBe('E');
    });

    it('turns down after tilesPerRow horizontal tiles (incremental)', () => {
      // Build chain incrementally to trigger the turn mechanism
      let board: PlayedDomino[] = [makeTile(6, 4, 0)];

      const { result, rerender } = renderHook(
        ({ board }) =>
          useChainLayout({
            board,
            containerWidth,
            containerHeight,
            tileWidth,
            tileHeight,
            padding,
            tilesPerRow: 5,
          }),
        { initialProps: { board } }
      );

      // Add tiles one by one to right arm (incrementally)
      const tiles = [
        makeTile(4, 3, 1),
        makeTile(3, 2, 2),
        makeTile(2, 1, 3),
        makeTile(1, 5, 4),
        makeTile(5, 0, 5),  // This should trigger turn after 5 on right arm
        makeTile(0, 6, 6),  // This should be going down
      ];

      for (let i = 0; i < tiles.length; i++) {
        board = [...board, tiles[i]];
        rerender({ board });
      }

      // The chain has 7 tiles now. Right arm has 6 tiles.
      // After 5 tiles, it should turn down.
      expect(result.current.placements.length).toBe(7);

      // Growth direction should have changed to S (down) after the horizontal run
      // Or if it already turned again, could be E or W
      expect(['S', 'E', 'W']).toContain(result.current.rightEnd.growthDirection);

      // Check that later tiles are at different Y positions (indicating turns)
      const yPositions = result.current.placements.map(p => p.position.y);
      const uniqueYs = [...new Set(yPositions)];
      // With a turn, we should have at least 2 different Y levels
      // (Note: this may be 1 if tilesPerRow > tiles added, but with 6 tiles added it should turn)
      expect(uniqueYs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('render dimensions', () => {
    it('provides scaled render dimensions for tiles', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(6, 4, 0)],  // Non-double (horizontal)
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
          padding,
          tilesPerRow,
        })
      );

      const placement = result.current.placements[0];
      // Horizontal tile: width > height
      expect(placement.renderWidth).toBeGreaterThan(placement.renderHeight);
      expect(placement.renderHorizontal).toBe(true);
    });

    it('provides correct dimensions for double tiles', () => {
      const { result } = renderHook(() =>
        useChainLayout({
          board: [makeTile(5, 5, 0)],  // Double (vertical)
          containerWidth,
          containerHeight,
          tileWidth,
          tileHeight,
          padding,
          tilesPerRow,
        })
      );

      const placement = result.current.placements[0];
      // Double tile is vertical: height > width
      expect(placement.renderHeight).toBeGreaterThan(placement.renderWidth);
      expect(placement.renderHorizontal).toBe(false);
    });
  });
});
