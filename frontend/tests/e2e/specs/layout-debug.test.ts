/**
 * Layout Debug Tests
 *
 * Tests specifically for debugging and visual verification of board layouts.
 * Takes screenshots at each stage for visual inspection.
 */

import { test, expect } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible, waitForBoardTiles } from '../utils/actions';

test.describe('Layout Debug', () => {
  test('all-CPU game with screenshots at each stage', async ({ page, playerName }) => {
    // Use narrow viewport to trigger wrapping
    await page.setViewportSize({ width: 500, height: 800 });

    console.log('=== Starting all-CPU layout debug test ===');

    // Create game with CPUs
    const gamePage = await createAndStartGame(page, playerName, 3);
    await page.screenshot({ path: 'test-results/layout-debug-01-game-created.png' });

    // Complete picking phase
    await completePicking(gamePage);
    await page.screenshot({ path: 'test-results/layout-debug-02-picking-done.png' });

    // Wait for board to have at least 1 tile
    await waitForBoardTiles(gamePage, 1, 30000);
    await page.screenshot({ path: 'test-results/layout-debug-03-first-tile.png' });

    // Play turns and take screenshots periodically
    const screenshotTileThresholds = [3, 5, 8, 10, 12, 15];
    let lastScreenshotAt = 1;

    for (let attempt = 0; attempt < 100; attempt++) {
      const status = await gamePage.getGameStatus();
      if (status === 'finished') {
        console.log('Game finished!');
        break;
      }

      // Check tile count and take screenshots at thresholds
      const tileCount = await gamePage.getBoardTileCount();

      // Take screenshot at threshold
      const nextThreshold = screenshotTileThresholds.find(t => t > lastScreenshotAt && t <= tileCount);
      if (nextThreshold) {
        await page.screenshot({
          path: `test-results/layout-debug-${String(nextThreshold).padStart(2, '0')}-tiles.png`
        });
        console.log(`Screenshot taken at ${tileCount} tiles`);
        lastScreenshotAt = tileCount;

        // Log layout debug info
        const layoutInfo = await page.evaluate(() => {
          const boardTiles = document.querySelector('[data-testid="board-tiles"]');
          const container = document.querySelector('[data-testid="game-board"] .overflow-auto');

          return {
            containerWidth: container ? (container as HTMLElement).clientWidth : 0,
            boardTilesClass: boardTiles?.className || 'not found',
            childCount: boardTiles?.children.length || 0,
            hasFlexCol: boardTiles?.classList.contains('flex-col') || false,
          };
        });
        console.log(`Layout info at ${tileCount} tiles:`, layoutInfo);
      }

      // Try to play our turn
      try {
        await gamePage.waitForYourTurn(3000);
        await playTurnIfPossible(gamePage);
      } catch {
        // Not our turn, wait for CPUs
      }

      await page.waitForTimeout(200);
    }

    // Final screenshot
    const finalCount = await gamePage.getBoardTileCount();
    await page.screenshot({ path: 'test-results/layout-debug-final.png', fullPage: true });
    console.log(`Final board has ${finalCount} tiles`);

    // Basic assertion - game should have progressed
    expect(finalCount).toBeGreaterThan(0);
  });

  test('verify snake layout activates at narrow viewport', async ({ page, playerName }) => {
    // Very narrow viewport
    await page.setViewportSize({ width: 400, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play until we have enough tiles for snake layout
    for (let i = 0; i < 80; i++) {
      const count = await gamePage.getBoardTileCount();
      if (count >= 10) break;

      const status = await gamePage.getGameStatus();
      if (status === 'finished') break;

      try {
        await gamePage.waitForYourTurn(3000);
        await playTurnIfPossible(gamePage);
      } catch {
        // Not our turn
      }
      await page.waitForTimeout(200);
    }

    const finalCount = await gamePage.getBoardTileCount();
    await page.screenshot({ path: 'test-results/layout-snake-activated.png', fullPage: true });

    // Check if snake layout is active
    const isSnakeActive = await page.evaluate(() => {
      const boardTiles = document.querySelector('[data-testid="board-tiles"]');
      return boardTiles?.classList.contains('flex-col') || false;
    });

    console.log(`Snake layout active: ${isSnakeActive}, tiles: ${finalCount}`);

    // At 400px width with 10+ tiles, snake should be active
    if (finalCount >= 10) {
      expect(isSnakeActive).toBe(true);
    }
  });

  test('capture full game progression', async ({ page, playerName }) => {
    await page.setViewportSize({ width: 600, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    let turnNumber = 0;
    const maxTurns = 100;

    while (turnNumber < maxTurns) {
      const status = await gamePage.getGameStatus();
      if (status === 'finished') {
        await page.screenshot({ path: 'test-results/layout-game-finished.png', fullPage: true });
        console.log(`Game finished after ${turnNumber} turns`);
        break;
      }

      try {
        await gamePage.waitForYourTurn(5000);
        const tilesBefore = await gamePage.getBoardTileCount();
        const played = await playTurnIfPossible(gamePage);

        if (played) {
          turnNumber++;
          const tilesAfter = await gamePage.getBoardTileCount();
          console.log(`Turn ${turnNumber}: ${tilesBefore} -> ${tilesAfter} tiles`);

          // Take screenshot every 5 turns
          if (turnNumber % 5 === 0) {
            await page.screenshot({
              path: `test-results/layout-turn-${String(turnNumber).padStart(2, '0')}.png`
            });
          }
        }
      } catch {
        // Not our turn
      }

      await page.waitForTimeout(200);
    }

    expect(turnNumber).toBeGreaterThan(0);
  });
});
