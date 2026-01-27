/**
 * Lobby Tests
 *
 * Tests for game creation, joining, and lobby interactions.
 */

import { test, expect } from '../setup';
import { selectors } from '../pages/GamePage';

test.describe('Lobby', () => {
  test('loads correctly', async ({ gamePage }) => {
    await gamePage.gotoLobby();

    await expect(gamePage.page.locator(selectors.lobby)).toBeVisible();
    await expect(gamePage.page.locator(selectors.playerNameInput)).toBeVisible();
    await expect(gamePage.page.locator(selectors.createGameBtn)).toBeVisible();
    await expect(gamePage.page.locator(selectors.joinGameBtn)).toBeVisible();
  });

  test('create button is disabled without name', async ({ gamePage }) => {
    await gamePage.gotoLobby();

    await expect(gamePage.page.locator(selectors.createGameBtn)).toBeDisabled();
  });

  test('create game flow shows options', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    // Enter name and click create
    await gamePage.enterPlayerName(playerName);

    // Button should now be enabled
    await expect(gamePage.page.locator(selectors.createGameBtn)).toBeEnabled();

    // Click create
    await gamePage.page.locator(selectors.createGameBtn).click();

    // Should show create options
    await expect(gamePage.page.locator(selectors.lobbyCreate)).toBeVisible();
    await expect(gamePage.page.locator(selectors.maxPlayersSelect)).toBeVisible();
    await expect(gamePage.page.locator(selectors.cpuPlayersSelect)).toBeVisible();
  });

  test('creates game successfully', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    const gameId = await gamePage.createGame(playerName, { maxPlayers: 4, cpuPlayers: 0 });

    // Should be in game
    await expect(gamePage.page.locator(selectors.gameContainer)).toBeVisible();

    // Should have a game ID
    expect(gameId.length).toBeGreaterThan(0);

    // Should be in waiting status
    const status = await gamePage.getGameStatus();
    expect(status).toBe('waiting');
  });

  test('creates game with CPUs', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    await gamePage.createGame(playerName, { maxPlayers: 4, cpuPlayers: 3 });

    // With all 4 slots filled (1 human + 3 CPUs), game auto-starts to picking phase
    await expect(gamePage.page.locator(selectors.gameContainer)).toBeVisible();
    const status = await gamePage.getGameStatus();
    expect(status).toBe('picking');
  });

  test('join game screen shows inputs', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    await gamePage.enterPlayerName(playerName);
    await gamePage.page.locator(selectors.joinGameBtn).click();

    await expect(gamePage.page.locator(selectors.lobbyJoin)).toBeVisible();
    await expect(gamePage.page.locator(selectors.gameIdInput)).toBeVisible();
  });

  test('back button returns to menu', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    await gamePage.enterPlayerName(playerName);
    await gamePage.page.locator(selectors.createGameBtn).click();

    await expect(gamePage.page.locator(selectors.lobbyCreate)).toBeVisible();

    await gamePage.page.locator(selectors.backBtn).click();

    await expect(gamePage.page.locator(selectors.lobbyMenu)).toBeVisible();
  });

  test('shows error for invalid game ID', async ({ gamePage, playerName }) => {
    await gamePage.gotoLobby();

    await gamePage.enterPlayerName(playerName);
    await gamePage.page.locator(selectors.joinGameBtn).click();

    // Enter invalid game ID
    await gamePage.page.locator(selectors.gameIdInput).fill('INVALID123');
    await gamePage.page.locator(selectors.joinByIdBtn).click();

    // Wait a bit for error handling
    await gamePage.page.waitForTimeout(2000);

    // Should still be in lobby (error should prevent navigation)
    await expect(gamePage.page.locator(selectors.lobby)).toBeVisible();
  });
});
