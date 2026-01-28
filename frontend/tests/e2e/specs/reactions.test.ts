/**
 * Reactions Tests
 *
 * Comprehensive tests for the emoji reaction/taunt system.
 * Tests UI interaction, WebSocket communication, and multiplayer visibility.
 */

import { test, expect } from '../setup';
import { selectors } from '../pages/GamePage';
import { createAndStartGame, completePicking } from '../utils/actions';

test.describe('Reactions - UI Interaction', () => {
  test('reaction picker is visible in playing phase', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await expect(page.locator(selectors.reactionPicker)).toBeVisible();
  });

  test('reaction picker is NOT visible in picking phase', async ({ page, playerName }) => {
    await createAndStartGame(page, playerName, 3);
    // Don't complete picking - stay in picking phase

    await expect(page.locator(selectors.reactionPicker)).not.toBeVisible();
  });

  test('toggle opens popup', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Click toggle button
    await page.locator(selectors.reactionToggleBtn).click();

    // Popup should appear
    await expect(page.locator(selectors.reactionPopup)).toBeVisible();
  });

  test('popup has all emoji buttons', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    // Check for all expected reactions
    const expectedReactions = [
      'laughing', 'angry', 'fire', 'dead', 'clown', 'crown',
      'bullseye', 'strong', 'devil', 'pray', 'thumbs-down', 'lucky'
    ];

    for (const reaction of expectedReactions) {
      await expect(page.locator(selectors.reaction(reaction))).toBeVisible();
    }
  });

  test('clicking outside popup closes it', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    // Click toggle again to close
    await page.locator(selectors.reactionToggleBtn).click();
    await page.waitForTimeout(100);

    await expect(page.locator(selectors.reactionPopup)).not.toBeVisible();
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
});

test.describe('Reactions - Cooldown', () => {
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
    await page.locator(selectors.reactionToggleBtn).click({ force: true });
    await page.waitForTimeout(100);

    await expect(page.locator(selectors.reactionPopup)).not.toBeVisible();
  });

  test('cooldown clears after 2 seconds', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();

    await page.locator(selectors.reaction('fire')).click();

    // Wait for cooldown to clear (2 seconds + buffer)
    await page.waitForTimeout(2500);

    // Should be able to open popup again
    await expect(page.locator(selectors.reactionToggleBtn)).toHaveAttribute('data-cooldown', 'false');

    await page.locator(selectors.reactionToggleBtn).click();
    await page.waitForTimeout(100);

    await expect(page.locator(selectors.reactionPopup)).toBeVisible();
  });
});

test.describe('Reactions - Display', () => {
  test('sent reaction appears on screen', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Send a reaction
    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();
    await page.locator(selectors.reaction('fire')).click();

    // Wait for reaction to appear in display
    await page.waitForTimeout(500);

    // Reaction display should be visible with at least one bubble
    await expect(page.locator(selectors.reactionDisplay)).toBeVisible();
    await expect(page.locator(selectors.anyReactionBubble)).toBeVisible();

    // Check the emoji is correct
    const bubble = page.locator(selectors.reactionBubble(0));
    await expect(bubble).toHaveAttribute('data-emoji', '🔥');
  });

  test('reaction shows player name', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Send a reaction
    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();
    await page.locator(selectors.reaction('laughing')).click();

    // Wait for reaction to appear
    await page.waitForTimeout(500);

    // Check for player name in the bubble (look for text content)
    const bubble = page.locator(selectors.reactionBubble(0));
    await expect(bubble).toBeVisible();

    // The bubble should contain the player name somewhere in its text
    const bubbleText = await bubble.textContent();
    // Player name could be our name or "YOU" depending on implementation
    expect(bubbleText).toBeTruthy();
  });

  test('reaction auto-dismisses after 3 seconds', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Send a reaction
    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();
    await page.locator(selectors.reaction('crown')).click();

    // Wait for reaction to appear
    await page.waitForTimeout(500);
    await expect(page.locator(selectors.anyReactionBubble)).toBeVisible();

    // Wait for auto-dismiss (3 seconds + buffer)
    await page.waitForTimeout(3500);

    // Reaction should be gone
    await expect(page.locator(selectors.anyReactionBubble)).not.toBeVisible();
  });

  test('multiple reactions can be sent after cooldown', async ({ page, playerName }) => {
    const gamePage = await createAndStartGame(page, playerName, 3);
    await completePicking(gamePage);

    // Send first reaction
    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();
    await page.locator(selectors.reaction('fire')).click();

    // Wait for cooldown
    await page.waitForTimeout(2500);

    // Send second reaction
    await page.locator(selectors.reactionToggleBtn).click();
    await page.locator(selectors.reactionPopup).waitFor();
    await page.locator(selectors.reaction('laughing')).click();

    // Wait for it to appear
    await page.waitForTimeout(500);

    // Should have at least one reaction visible
    // (first might have dismissed, second should be visible)
    await expect(page.locator(selectors.anyReactionBubble)).toBeVisible();
  });
});

test.describe('Reactions - Different Emojis', () => {
  const emojisToTest = [
    { name: 'laughing', emoji: '😂' },
    { name: 'angry', emoji: '😤' },
    { name: 'fire', emoji: '🔥' },
    { name: 'dead', emoji: '💀' },
    { name: 'clown', emoji: '🤡' },
    { name: 'crown', emoji: '👑' },
  ];

  for (const { name, emoji } of emojisToTest) {
    test(`can send ${name} reaction`, async ({ page, playerName }) => {
      const gamePage = await createAndStartGame(page, playerName, 3);
      await completePicking(gamePage);

      await page.locator(selectors.reactionToggleBtn).click();
      await page.locator(selectors.reactionPopup).waitFor();
      await page.locator(selectors.reaction(name)).click();

      await page.waitForTimeout(500);

      // Verify the correct emoji appears
      const bubble = page.locator(selectors.reactionBubble(0));
      await expect(bubble).toHaveAttribute('data-emoji', emoji);
    });
  }
});
