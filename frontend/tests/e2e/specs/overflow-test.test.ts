/**
 * Test to check if tiles overflow container at various widths
 */
import { test, expect } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible, waitForBoardTiles } from '../utils/actions';

test.describe('Overflow Debug', () => {
  test('check layout at 800px with tiles', async ({ page, playerName }) => {
    await page.setViewportSize({ width: 800, height: 600 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait for first tile
    await waitForBoardTiles(gamePage, 1, 30000);

    // Play a few turns quickly
    for (let i = 0; i < 20; i++) {
      const status = await gamePage.getGameStatus();
      if (status === 'finished') break;

      try {
        await gamePage.waitForYourTurn(2000);
        await playTurnIfPossible(gamePage);
      } catch { }
      await page.waitForTimeout(100);
    }

    const tileCount = await gamePage.getBoardTileCount();
    console.log(`Tiles on board: ${tileCount}`);

    await page.screenshot({ path: 'test-results/overflow-check.png', fullPage: true });

    // Check overflow - only check tiles within the board-tiles container
    const overflowInfo = await page.evaluate(() => {
      const gameBoard = document.querySelector('[data-testid="game-board"]');
      const boardTiles = document.querySelector('[data-testid="board-tiles"]');

      if (!gameBoard || !boardTiles) return { error: 'elements not found', hasOverflow: false };

      const containerRect = gameBoard.getBoundingClientRect();
      const tilesRect = boardTiles.getBoundingClientRect();

      // Check if the board-tiles container extends beyond the game board
      const hasRightOverflow = tilesRect.right > containerRect.right + 10; // 10px tolerance
      const hasLeftOverflow = tilesRect.left < containerRect.left - 10;

      return {
        containerWidth: containerRect.width,
        containerLeft: containerRect.left,
        containerRight: containerRect.right,
        tilesLeft: tilesRect.left,
        tilesRight: tilesRect.right,
        tilesWidth: tilesRect.width,
        hasOverflow: hasRightOverflow || hasLeftOverflow,
        hasRightOverflow,
        hasLeftOverflow,
        hasSnakeLayout: boardTiles.classList.contains('flex-col'),
      };
    });

    console.log('Overflow check result:', JSON.stringify(overflowInfo, null, 2));

    // Test passes if no overflow
    expect(overflowInfo.hasOverflow).toBe(false);
  });

  test('check snake layout at narrow viewport', async ({ page, playerName }) => {
    await page.setViewportSize({ width: 400, height: 800 });

    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Play until we have enough tiles for snake layout
    for (let i = 0; i < 30; i++) {
      const count = await gamePage.getBoardTileCount();
      if (count >= 8) break;

      const status = await gamePage.getGameStatus();
      if (status === 'finished') break;

      try {
        await gamePage.waitForYourTurn(2000);
        await playTurnIfPossible(gamePage);
      } catch { }
      await page.waitForTimeout(100);
    }

    const tileCount = await gamePage.getBoardTileCount();
    console.log(`Tiles on board: ${tileCount}`);

    await page.screenshot({ path: 'test-results/narrow-viewport.png', fullPage: true });

    // At 400px with 8+ tiles, snake layout should be active
    if (tileCount >= 5) {
      const layoutInfo = await page.evaluate(() => {
        const boardTiles = document.querySelector('[data-testid="board-tiles"]');
        return {
          hasSnakeLayout: boardTiles?.classList.contains('flex-col') || false,
          className: boardTiles?.className || '',
        };
      });

      console.log('Layout info:', layoutInfo);
      // Snake should be active with 5+ tiles at 400px
      expect(layoutInfo.hasSnakeLayout).toBe(true);
    }
  });
});
