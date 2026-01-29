/**
 * Multiplayer Reactions Tests
 *
 * Tests that reactions are broadcast to and visible by other players.
 */

import { test, expect } from '@playwright/test';
import { MultiPlayerHarness, withMultiPlayerHarness } from '../../harness/MultiPlayerHarness';
import { selectors } from '../../pages/GamePage';
import { completePicking } from '../../utils/actions';

test.describe('Multiplayer Reactions', () => {
  test('reaction sent by one player is visible to another', async () => {
    await withMultiPlayerHarness(2, async (harness) => {
      // Create and join game
      await harness.createAndJoinGame(['Player1', 'Player2']);

      // Wait for all players to be in picking phase
      await harness.waitForAllPlayersStatus('picking', 10000);

      // Both players complete picking
      const player1 = harness.getHost();
      const player2 = harness.getPlayer(1);

      await completePicking(player1.gamePage);
      await completePicking(player2.gamePage);

      // Wait for playing phase
      await harness.waitForAllPlayersStatus('playing', 60000);

      // Player 1 sends a reaction
      const p1Page = player1.gamePage.page;
      await p1Page.locator(selectors.reactionToggleBtn).click();
      await p1Page.locator(selectors.reactionPopup).waitFor();
      await p1Page.locator(selectors.reaction('fire')).click();

      // Wait for broadcast
      await p1Page.waitForTimeout(1000);

      // Player 2 should see the reaction
      const p2Page = player2.gamePage.page;
      await expect(p2Page.locator(selectors.reactionDisplay)).toBeVisible({ timeout: 5000 });
      await expect(p2Page.locator(selectors.anyReactionBubble)).toBeVisible({ timeout: 5000 });

      // Verify it's the fire emoji
      const bubble = p2Page.locator(selectors.reactionBubble(0));
      await expect(bubble).toHaveAttribute('data-emoji', '🔥');
    });
  });

  test('both players can send and see reactions', async () => {
    await withMultiPlayerHarness(2, async (harness) => {
      await harness.createAndJoinGame(['Alice', 'Bob']);
      await harness.waitForAllPlayersStatus('picking', 10000);

      const player1 = harness.getHost();
      const player2 = harness.getPlayer(1);

      await completePicking(player1.gamePage);
      await completePicking(player2.gamePage);
      await harness.waitForAllPlayersStatus('playing', 60000);

      const p1Page = player1.gamePage.page;
      const p2Page = player2.gamePage.page;

      // Player 1 sends fire
      await p1Page.locator(selectors.reactionToggleBtn).click();
      await p1Page.locator(selectors.reactionPopup).waitFor();
      await p1Page.locator(selectors.reaction('fire')).click();

      // Wait for broadcast and cooldown
      await p1Page.waitForTimeout(1000);

      // Player 2 sends laughing
      await p2Page.locator(selectors.reactionToggleBtn).click();
      await p2Page.locator(selectors.reactionPopup).waitFor();
      await p2Page.locator(selectors.reaction('laughing')).click();

      // Wait for broadcast
      await p2Page.waitForTimeout(1000);

      // Player 1 should see Player 2's reaction
      await expect(p1Page.locator(selectors.reactionDisplay)).toBeVisible({ timeout: 5000 });

      // Player 2 should see both (own + Player 1's if not expired)
      await expect(p2Page.locator(selectors.reactionDisplay)).toBeVisible({ timeout: 5000 });
    });
  });

  test('reaction shows sender player name', async () => {
    await withMultiPlayerHarness(2, async (harness) => {
      await harness.createAndJoinGame(['Alice', 'Bob']);
      await harness.waitForAllPlayersStatus('picking', 10000);

      const player1 = harness.getHost();
      const player2 = harness.getPlayer(1);

      await completePicking(player1.gamePage);
      await completePicking(player2.gamePage);
      await harness.waitForAllPlayersStatus('playing', 60000);

      // Player 1 (Alice) sends reaction
      const p1Page = player1.gamePage.page;
      await p1Page.locator(selectors.reactionToggleBtn).click();
      await p1Page.locator(selectors.reactionPopup).waitFor();
      await p1Page.locator(selectors.reaction('crown')).click();

      await p1Page.waitForTimeout(1000);

      // Player 2 (Bob) should see Alice's name in the reaction
      const p2Page = player2.gamePage.page;
      await expect(p2Page.locator(selectors.reactionDisplay)).toBeVisible({ timeout: 5000 });

      const bubble = p2Page.locator(selectors.reactionBubble(0));
      await expect(bubble).toBeVisible();

      // The bubble should show Alice's name
      const bubbleText = await bubble.textContent();
      expect(bubbleText).toContain('Alice');
    });
  });

  test('reactions work in 4-player game', async () => {
    await withMultiPlayerHarness(4, async (harness) => {
      await harness.createAndJoinGame(['P1', 'P2', 'P3', 'P4']);
      await harness.waitForAllPlayersStatus('picking', 10000);

      // All players complete picking
      for (const player of harness.getAllPlayers()) {
        await completePicking(player.gamePage);
      }
      await harness.waitForAllPlayersStatus('playing', 60000);

      // Player 1 sends reaction
      const p1Page = harness.getHost().gamePage.page;
      await p1Page.locator(selectors.reactionToggleBtn).click();
      await p1Page.locator(selectors.reactionPopup).waitFor();
      await p1Page.locator(selectors.reaction('dead')).click();

      await p1Page.waitForTimeout(1500);

      // All other players should see it
      for (let i = 1; i < 4; i++) {
        const playerPage = harness.getPlayer(i).gamePage.page;
        await expect(playerPage.locator(selectors.reactionDisplay)).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
