/**
 * Reactions Tests
 *
 * Tests for the emoji reaction system.
 */

import { test, expect } from '../setup';
import { selectors } from '../pages/GamePage';
import { createAndStartGame, completePicking } from '../utils/actions';

test.describe('Reactions', () => {
  test('reaction picker is visible in playing phase', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await expect(page.locator(selectors.reactionPicker)).toBeVisible();
  });

  test('toggle opens popup', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Click toggle button
    await page.locator(selectors.reactionToggleBtn).click();

    // Popup should appear
    await expect(page.locator(selectors.reactionPopup)).toBeVisible();
  });

  test('popup has emoji buttons', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    // Check for some expected reactions
    await expect(page.locator(selectors.reaction('laughing'))).toBeVisible();
    await expect(page.locator(selectors.reaction('fire'))).toBeVisible();
  });

  test('clicking reaction closes popup', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    // Click a reaction
    await page.locator(selectors.reaction('fire')).click();
    await page.waitForTimeout(300);

    // Popup should close
    await expect(page.locator(selectors.reactionPopup)).not.toBeVisible();
  });

  test('cooldown activates after sending reaction', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    await page.locator(selectors.reaction('fire')).click();
    await page.waitForTimeout(300);

    // Toggle button should now show cooldown
    await expect(page.locator(selectors.reactionToggleBtn)).toHaveAttribute('data-cooldown', 'true');

    // Should not be able to open popup during cooldown
    await page.locator(selectors.reactionToggleBtn).click();
    await page.waitForTimeout(100);

    await expect(page.locator(selectors.reactionPopup)).not.toBeVisible();
  });

  test('cooldown clears after waiting', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    await page.locator(selectors.reaction('fire')).click();

    // Wait for cooldown to clear (2 seconds)
    await page.waitForTimeout(2500);

    // Should be able to open popup again
    await expect(page.locator(selectors.reactionToggleBtn)).toHaveAttribute('data-cooldown', 'false');

    await page.locator(selectors.reactionToggleBtn).click();
    await page.waitForTimeout(100);

    await expect(page.locator(selectors.reactionPopup)).toBeVisible();
  });
});
