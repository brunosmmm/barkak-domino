/**
 * Snake layout screenshot test - plays until we get enough tiles for snake layout
 */
import { test } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible, waitForBoardTiles } from '../utils/actions';

test('capture snake layout screenshots', async ({ page, playerName }) => {
  // Narrow viewport to trigger snake layout sooner
  await page.setViewportSize({ width: 450, height: 800 });

  const gamePage = await createAndStartGame(page, playerName, 3);
  await page.screenshot({ path: 'test-results/snake-01-game-started.png' });

  await completePicking(gamePage);
  await page.screenshot({ path: 'test-results/snake-02-picking-done.png' });

  await waitForBoardTiles(gamePage, 1, 30000);

  // Play aggressively until we have many tiles
  let lastTileCount = 0;
  for (let i = 0; i < 100; i++) {
    const status = await gamePage.getGameStatus();
    if (status === 'finished') {
      console.log('Game finished!');
      break;
    }

    const tileCount = await gamePage.getBoardTileCount();

    // Take screenshot when tile count increases significantly
    if (tileCount >= 4 && tileCount > lastTileCount) {
      await page.screenshot({
        path: 'test-results/snake-tiles-' + String(tileCount).padStart(2, '0') + '.png'
      });
      console.log('Screenshot at ' + tileCount + ' tiles');
      lastTileCount = tileCount;
    }

    // Check if snake layout is active
    if (tileCount >= 5) {
      const isSnake = await page.evaluate(() => {
        const boardTiles = document.querySelector('[data-testid="board-tiles"]');
        return boardTiles?.classList.contains('flex-col') || false;
      });
      if (isSnake) {
        console.log('Snake layout ACTIVE at ' + tileCount + ' tiles!');
      }
    }

    try {
      await gamePage.waitForYourTurn(2000);
      await playTurnIfPossible(gamePage);
    } catch { }

    await page.waitForTimeout(150);
  }

  // Final screenshot
  const finalCount = await gamePage.getBoardTileCount();
  await page.screenshot({ path: 'test-results/snake-final.png', fullPage: true });
  console.log('Final: ' + finalCount + ' tiles');
});
