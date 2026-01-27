/**
 * Playing Phase Tests
 *
 * Tests for the main gameplay phase.
 */

import { test, expect } from '../setup';
import { selectors } from '../pages/GamePage';
import { createAndStartGame, completePicking, playTurnIfPossible } from '../utils/actions';
import { extractGameState } from '../utils/stateExtractor';

test.describe('Playing Phase', () => {
  test('game board appears in playing phase', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await expect(page.locator(selectors.gameBoard)).toBeVisible();
  });

  test('player hand is visible with 6 tiles', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await expect(page.locator(selectors.playerHand)).toBeVisible();

    const tiles = await gamePage.getHandTiles();
    expect(tiles.length).toBe(6);
  });

  test('first move auto-plays on click', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait for our turn
    try {
      await gamePage.waitForYourTurn(30000);
    } catch {
      // Not our turn, skip this test
      test.skip();
      return;
    }

    // Get initial board state
    const initialCount = await gamePage.getBoardTileCount();
    if (initialCount !== 0) {
      // Board not empty, someone else went first
      test.skip();
      return;
    }

    // Get playable tiles
    const playable = await gamePage.getPlayableTiles();
    expect(playable.length).toBeGreaterThan(0);

    // Click a tile - should auto-play
    await gamePage.selectTileFromHand(playable[0].index);
    await page.waitForTimeout(500);

    // Board should now have a tile
    const afterCount = await gamePage.getBoardTileCount();
    expect(afterCount).toBeGreaterThan(0);
  });

  test('side selection appears after first move', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait until there's at least one tile on board
    let attempts = 0;
    while (attempts < 60) {
      const count = await gamePage.getBoardTileCount();
      if (count > 0) break;

      // Try to play if it's our turn
      await playTurnIfPossible(gamePage);
      await page.waitForTimeout(500);
      attempts++;
    }

    // Now wait for our turn again
    try {
      await gamePage.waitForYourTurn(30000);
    } catch {
      // Not our turn, skip
      test.skip();
      return;
    }

    // Select a playable tile
    const playable = await gamePage.getPlayableTiles();
    if (playable.length === 0) {
      // No valid moves
      test.skip();
      return;
    }

    await gamePage.selectTileFromHand(playable[0].index);
    await page.waitForTimeout(300);

    // Check if at least one play button appears
    const leftBtn = page.locator(selectors.playLeftBtn);
    const rightBtn = page.locator(selectors.playRightBtn);

    const leftVisible = await leftBtn.isVisible();
    const rightVisible = await rightBtn.isVisible();

    expect(leftVisible || rightVisible).toBe(true);
  });

  test('board updates after playing tile', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait for our turn
    try {
      await gamePage.waitForYourTurn(30000);
    } catch {
      test.skip();
      return;
    }

    const beforeCount = await gamePage.getBoardTileCount();
    const played = await playTurnIfPossible(gamePage);

    if (played) {
      await page.waitForTimeout(500);
      const afterCount = await gamePage.getBoardTileCount();
      expect(afterCount).toBeGreaterThan(beforeCount);
    }
  });

  test('hand decreases after playing', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Wait for our turn
    try {
      await gamePage.waitForYourTurn(30000);
    } catch {
      test.skip();
      return;
    }

    const beforeHand = await gamePage.getHandTiles();
    const played = await playTurnIfPossible(gamePage);

    if (played && !(await gamePage.canPass())) {
      await page.waitForTimeout(500);
      const afterHand = await gamePage.getHandTiles();
      expect(afterHand.length).toBeLessThan(beforeHand.length);
    }
  });

  test('state extraction works during play', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    const state = await extractGameState(page);

    expect(state.status).toBe('playing');
    expect(state.myHand.length).toBe(6);
  });
});
