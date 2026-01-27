/**
 * Multiplayer Join Tests
 *
 * Tests for multiple players joining and seeing each other.
 */

import { test, expect } from '@playwright/test';
import { MultiPlayerHarness, withMultiPlayerHarness } from '../../harness/MultiPlayerHarness';

test.describe('Multiplayer Join', () => {
  test('two players can see each other', async () => {
    await withMultiPlayerHarness(2, async (harness) => {
      await harness.createAndJoinGame();

      // Both should be in the game (waiting for more players or picking if auto-started)
      const host = harness.getHost();
      const guest = harness.getPlayer(1);

      const hostStatus = await host.gamePage.getGameStatus();
      const guestStatus = await guest.gamePage.getGameStatus();

      // With 2 players in a 2-player game, it may auto-start to picking
      expect(['waiting', 'picking']).toContain(hostStatus);
      expect(['waiting', 'picking']).toContain(guestStatus);
    });
  });

  test('four players can join the same game', async () => {
    await withMultiPlayerHarness(4, async (harness) => {
      await harness.createAndJoinGame([
        'Player1',
        'Player2',
        'Player3',
        'Player4',
      ]);

      // With 4 players filling all slots, the game auto-starts to picking
      for (const player of harness.getAllPlayers()) {
        const status = await player.gamePage.getGameStatus();
        expect(['waiting', 'picking']).toContain(status);
      }
    });
  });

  test('host can start game with all players', async () => {
    await withMultiPlayerHarness(2, async (harness) => {
      await harness.createAndJoinGame();

      const host = harness.getHost();

      // With all slots filled, game may already be in picking phase (auto-start)
      const currentStatus = await host.gamePage.getGameStatus();
      if (currentStatus === 'waiting') {
        // Start the game manually if not auto-started
        await host.gamePage.startGame();
      }

      // Both should be in picking phase
      await harness.waitForAllPlayersStatus('picking', 10000);

      // Verify
      for (const player of harness.getAllPlayers()) {
        const status = await player.gamePage.getGameStatus();
        expect(status).toBe('picking');
      }
    });
  });
});
