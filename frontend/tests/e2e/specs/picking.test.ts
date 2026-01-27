/**
 * Tile Picking Phase Tests
 *
 * Tests for the picking phase where players claim tiles.
 */

import { test, expect } from '../setup';
import { selectors } from '../pages/GamePage';
import { createAndStartGame } from '../utils/actions';
import { extractGameState } from '../utils/stateExtractor';

test.describe('Tile Picking', () => {
  test('picking phase starts after game start', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    const status = await gamePage.getGameStatus();
    expect(status).toBe('picking');

    // Picking UI should be visible
    await expect(page.locator(selectors.tilePicking)).toBeVisible();
  });

  test('tile grid shows 28 positions', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Count tile positions
    let positionCount = 0;
    for (let i = 0; i < 28; i++) {
      const tile = page.locator(selectors.tilePosition(i));
      if (await tile.isVisible()) positionCount++;
    }

    expect(positionCount).toBe(28);
  });

  test('can claim available tiles', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Get initial available positions
    const initialAvailable = await gamePage.getAvailableTilePositions();
    expect(initialAvailable.length).toBeGreaterThan(0);

    // Claim one tile
    await gamePage.claimTile(initialAvailable[0]);

    // Wait for update
    await page.waitForTimeout(500);

    // Check available positions decreased (or stayed same if others also claimed)
    const afterAvailable = await gamePage.getAvailableTilePositions();
    expect(afterAvailable.length).toBeLessThan(initialAvailable.length);
  });

  test('player progress updates when claiming', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Get initial hand count
    const state1 = await extractGameState(page);
    const initialHandCount = state1.myHand.length;

    // Claim a tile
    const available = await gamePage.getAvailableTilePositions();
    if (available.length > 0) {
      await gamePage.claimTile(available[0]);
      await page.waitForTimeout(500);
    }

    // Check hand count increased
    const state2 = await extractGameState(page);
    expect(state2.myHand.length).toBeGreaterThan(initialHandCount);
  });

  test('can claim up to 6 tiles', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Claim 6 tiles
    await gamePage.claimAllTiles();

    // Check hand has 6 tiles
    const hand = await gamePage.getHandTiles();
    expect(hand.length).toBe(6);
  });

  test('cannot claim more than 6 tiles', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Claim 6 tiles
    await gamePage.claimAllTiles();

    // Get available positions
    const available = await gamePage.getAvailableTilePositions();

    // If there are still available tiles, they should be disabled for us
    if (available.length > 0) {
      const tile = page.locator(selectors.tilePosition(available[0]));
      await expect(tile).toBeDisabled();
    }
  });

  test('picking timer is displayed', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    await expect(page.locator(selectors.pickingTimer)).toBeVisible();

    const remaining = await gamePage.getPickingTimerRemaining();
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(0);
  });

  test('picked tiles show in preview', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Claim a tile
    const available = await gamePage.getAvailableTilePositions();
    if (available.length > 0) {
      await gamePage.claimTile(available[0]);
      await page.waitForTimeout(500);
    }

    // Check picked tiles section appears
    await expect(page.locator(selectors.pickedTiles)).toBeVisible();
  });

  test('transitions to playing after all tiles picked', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);

    // Claim all tiles
    await gamePage.claimAllTiles();

    // Wait for transition to playing (timeout or all players done)
    await gamePage.waitForStatus('playing', 120000);

    // Verify we're in playing mode
    const status = await gamePage.getGameStatus();
    expect(status).toBe('playing');
  });
});
