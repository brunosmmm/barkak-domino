/**
 * Chain Layout Screenshot Test
 *
 * Captures layout at various stages using a faster game simulation.
 */
import { test, expect } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible } from '../utils/actions';

test('chain layout progression', async ({ page, playerName }) => {
  test.setTimeout(90000); // 90 seconds

  // Narrow viewport to trigger turns sooner
  await page.setViewportSize({ width: 450, height: 600 });

  const gamePage = await createAndStartGame(page, playerName, 3);
  await completePicking(gamePage);

  await page.screenshot({ path: 'test-results/chain-00-start.png' });

  let lastScreenshotCount = 0;
  const screenshotCounts = new Set([1, 3, 5, 7, 10]);

  // Play game for up to 50 turns or until 10 tiles on board
  for (let turn = 0; turn < 50; turn++) {
    const status = await gamePage.getGameStatus();
    if (status === 'finished') {
      console.log('Game finished at turn', turn);
      break;
    }

    const boardCount = await gamePage.getBoardTileCount();

    // Take screenshot at key points
    if (screenshotCounts.has(boardCount) && boardCount > lastScreenshotCount) {
      await page.screenshot({
        path: `test-results/chain-${String(boardCount).padStart(2, '0')}-tiles.png`
      });
      console.log(`Screenshot at ${boardCount} tiles`);
      lastScreenshotCount = boardCount;
    }

    // Stop after getting 10 tiles screenshot
    if (boardCount >= 10) break;

    // Play if it's our turn
    const isOurTurn = await gamePage.isYourTurn();
    if (isOurTurn) {
      await playTurnIfPossible(gamePage);
    }

    // Short wait for CPU turns
    await page.waitForTimeout(300);
  }

  // Final screenshot
  const finalCount = await gamePage.getBoardTileCount();
  await page.screenshot({ path: 'test-results/chain-final.png' });
  console.log(`Final: ${finalCount} tiles on board`);

  expect(finalCount).toBeGreaterThan(0);
});
