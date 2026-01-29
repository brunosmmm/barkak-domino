/**
 * Chain Layout - Wider viewport test
 */
import { test, expect } from '../setup';
import { createAndStartGame, completePicking, playTurnIfPossible, waitForBoardTiles } from '../utils/actions';

test.setTimeout(180000);

test('chain layout wide viewport', async ({ page, playerName }) => {
  // Wider viewport - should still turn eventually
  await page.setViewportSize({ width: 600, height: 500 });

  const gamePage = await createAndStartGame(page, playerName, 3);
  await completePicking(gamePage);

  await waitForBoardTiles(gamePage, 1, 30000);

  let lastCount = 0;

  for (let i = 0; i < 150; i++) {
    const status = await gamePage.getGameStatus();
    if (status === 'finished') break;

    const count = await gamePage.getBoardTileCount();

    // Take screenshot at every few tiles
    if (count >= 5 && count > lastCount && count % 3 === 0) {
      await page.screenshot({
        path: `test-results/wide-${String(count).padStart(2, '0')}-tiles.png`
      });
      console.log(`Screenshot at ${count} tiles`);
      lastCount = count;
    }

    try {
      await gamePage.waitForYourTurn(2000);
      await playTurnIfPossible(gamePage);
    } catch { }

    await page.waitForTimeout(100);
  }

  const finalCount = await gamePage.getBoardTileCount();
  await page.screenshot({ path: 'test-results/wide-final.png' });
  console.log(`Final: ${finalCount} tiles`);

  expect(finalCount).toBeGreaterThan(5);
});
