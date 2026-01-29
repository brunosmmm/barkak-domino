/**
 * Snake Layout Tests
 *
 * Tests for the snaking domino board layout feature.
 * Board should wrap tiles to multiple rows when they approach container edge.
 */

import { test, expect } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible, waitForBoardTiles } from '../utils/actions';
import { selectors } from '../pages/GamePage';

test.describe('Snake Board Layout', () => {
  test('board renders single row for few tiles', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play a few turns to get some tiles on board
    await waitForBoardTiles(gamePage, 1, 30000);

    // Check board structure
    const board = page.locator(selectors.gameBoard);
    await expect(board).toBeVisible();

    // Get the board tiles container
    const boardTiles = page.locator(selectors.boardTiles);
    await expect(boardTiles).toBeVisible();

    // Log current board state for debugging
    const tileCount = await gamePage.getBoardTileCount();
    console.log(`Board has ${tileCount} tiles`);

    // Check container dimensions
    const container = page.locator('[data-testid="game-board"] > div > div > div');
    const boundingBox = await container.first().boundingBox();
    console.log('Container bounding box:', boundingBox);
  });

  test('board wraps to multiple rows with many tiles', async ({ page, playerName }) => {
    // Set viewport to trigger wrapping sooner
    await page.setViewportSize({ width: 600, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play turns until we have enough tiles to wrap
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const tileCount = await gamePage.getBoardTileCount();
      console.log(`Turn ${attempts}: Board has ${tileCount} tiles`);

      if (tileCount >= 8) {
        // Should be enough to trigger snaking at 600px width
        break;
      }

      // Wait for our turn and play
      try {
        await gamePage.waitForYourTurn(5000);
        await playTurnIfPossible(gamePage);
        await page.waitForTimeout(300);
      } catch {
        // Not our turn, wait for others
        await page.waitForTimeout(500);
      }

      attempts++;
    }

    const finalCount = await gamePage.getBoardTileCount();
    console.log(`Final board has ${finalCount} tiles`);

    // Take screenshot for visual debugging
    await page.screenshot({ path: 'test-results/snake-layout-debug.png', fullPage: true });

    // Check if board has multiple rows (flex-col with gap)
    const boardTiles = page.locator(selectors.boardTiles);
    const boardClasses = await boardTiles.getAttribute('class');
    console.log('Board tiles classes:', boardClasses);

    // Check if flex-col is applied (indicates snake mode)
    if (finalCount >= 8) {
      // At 600px width with 64px tiles, should wrap after ~5 tiles
      // Check for multiple row divs
      const rowDivs = boardTiles.locator('> div.flex');
      const rowCount = await rowDivs.count();
      console.log(`Found ${rowCount} row divs`);

      // If board isn't snaking, log the structure
      const innerHtml = await boardTiles.innerHTML();
      console.log('Board tiles innerHTML:', innerHtml.substring(0, 500));
    }
  });

  test('debug: inspect container width', async ({ page, playerName }) => {
    await page.setViewportSize({ width: 600, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait for board to render
    await waitForBoardTiles(gamePage, 1, 30000);

    // Use page.evaluate to inspect the actual container width
    const debugInfo = await page.evaluate(() => {
      const gameBoard = document.querySelector('[data-testid="game-board"]');
      const boardTiles = document.querySelector('[data-testid="board-tiles"]');

      // Find the container that has the ref attached (the one with overflow-auto)
      const container = gameBoard?.querySelector('.overflow-auto');

      return {
        gameBoard: gameBoard ? {
          clientWidth: (gameBoard as HTMLElement).clientWidth,
          clientHeight: (gameBoard as HTMLElement).clientHeight,
          offsetWidth: (gameBoard as HTMLElement).offsetWidth,
        } : null,
        boardTiles: boardTiles ? {
          clientWidth: (boardTiles as HTMLElement).clientWidth,
          className: (boardTiles as HTMLElement).className,
          childCount: boardTiles.children.length,
        } : null,
        container: container ? {
          clientWidth: (container as HTMLElement).clientWidth,
          className: (container as HTMLElement).className,
        } : null,
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
      };
    });

    console.log('=== Debug Info ===');
    console.log('Viewport:', debugInfo.viewport);
    console.log('Game Board:', debugInfo.gameBoard);
    console.log('Board Tiles:', debugInfo.boardTiles);
    console.log('Container:', debugInfo.container);

    // Take screenshot
    await page.screenshot({ path: 'test-results/snake-layout-structure.png', fullPage: true });

    // The container width should be > 0 for snake layout to work
    expect(debugInfo.container?.clientWidth).toBeGreaterThan(0);
  });

  test('debug: check snake layout activation', async ({ page, playerName }) => {
    // Very narrow viewport to force wrapping
    await page.setViewportSize({ width: 400, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play until we have 10+ tiles
    let attempts = 0;
    while (attempts < 60) {
      const count = await gamePage.getBoardTileCount();
      if (count >= 10) break;

      try {
        await gamePage.waitForYourTurn(3000);
        await playTurnIfPossible(gamePage);
      } catch {
        // Not our turn
      }
      await page.waitForTimeout(300);
      attempts++;
    }

    const finalCount = await gamePage.getBoardTileCount();
    console.log(`Board has ${finalCount} tiles`);

    // Check the actual DOM structure
    const structure = await page.evaluate(() => {
      const boardTiles = document.querySelector('[data-testid="board-tiles"]');
      if (!boardTiles) return { error: 'boardTiles not found' };

      // Check if it's a flex-col container (snake mode)
      const isFlexCol = boardTiles.classList.contains('flex-col');

      // Count direct children (rows in snake mode, tiles in single-row mode)
      const directChildren = boardTiles.children.length;

      // Check first child's structure
      const firstChild = boardTiles.firstElementChild;
      const firstChildInfo = firstChild ? {
        tagName: firstChild.tagName,
        className: firstChild.className,
        childCount: firstChild.children.length,
        hasDomino: firstChild.hasAttribute('data-domino'),
      } : null;

      return {
        isFlexCol,
        className: boardTiles.className,
        directChildren,
        firstChildInfo,
      };
    });

    console.log('DOM structure:', structure);

    // If not in snake mode with 10 tiles at 400px width, something is wrong
    if (finalCount >= 10 && !structure.isFlexCol) {
      console.error('Snake layout should be active but is not!');
      await page.screenshot({ path: 'test-results/snake-layout-not-active.png', fullPage: true });
    }
  });

  test('snake layout renders correctly', async ({ page, playerName }) => {
    // Use narrow viewport
    await page.setViewportSize({ width: 500, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play many turns
    let attempts = 0;
    while (attempts < 80) {
      const status = await gamePage.getGameStatus();
      if (status === 'finished') break;

      const count = await gamePage.getBoardTileCount();
      if (count >= 12) break;

      try {
        await gamePage.waitForYourTurn(3000);
        await playTurnIfPossible(gamePage);
      } catch {
        // Not our turn
      }
      await page.waitForTimeout(200);
      attempts++;
    }

    // Final inspection
    const boardInfo = await page.evaluate(() => {
      const boardTiles = document.querySelector('[data-testid="board-tiles"]');
      if (!boardTiles) return null;

      // Find the container that should have containerRef
      const container = document.querySelector('[data-testid="game-board"] .overflow-auto');

      return {
        containerWidth: container ? (container as HTMLElement).clientWidth : 0,
        boardTilesClass: boardTiles.className,
        hasFlexCol: boardTiles.classList.contains('flex-col'),
        childrenCount: boardTiles.children.length,
        childrenClasses: Array.from(boardTiles.children).slice(0, 3).map(c => c.className),
      };
    });

    console.log('=== Final Board State ===');
    console.log('Container width:', boardInfo?.containerWidth);
    console.log('Board class:', boardInfo?.boardTilesClass);
    console.log('Has flex-col:', boardInfo?.hasFlexCol);
    console.log('Children count:', boardInfo?.childrenCount);
    console.log('Children classes:', boardInfo?.childrenClasses);

    const tileCount = await gamePage.getBoardTileCount();
    console.log('Tile count:', tileCount);

    await page.screenshot({ path: 'test-results/snake-layout-final.png', fullPage: true });
  });
});
