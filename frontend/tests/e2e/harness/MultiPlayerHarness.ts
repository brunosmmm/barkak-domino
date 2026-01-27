/**
 * Multi-Player Test Harness
 *
 * Infrastructure for running multiple browser contexts for multiplayer testing.
 * Uses Playwright's browser contexts for isolation.
 */

import { Browser, BrowserContext, Page, chromium } from '@playwright/test';
import { config } from '../config';
import { GamePage } from '../pages/GamePage';
import { randomPlayerName } from '../setup';

export interface PlayerContext {
  context: BrowserContext;
  page: Page;
  gamePage: GamePage;
  playerName: string;
  index: number;
}

export class MultiPlayerHarness {
  private browser: Browser | null = null;
  private contexts: PlayerContext[] = [];

  /**
   * Launch multiple browser contexts for multiplayer testing
   */
  async launchPlayers(count: number): Promise<PlayerContext[]> {
    this.browser = await chromium.launch();
    this.contexts = [];

    for (let i = 0; i < count; i++) {
      const context = await this.browser.newContext();
      const page = await context.newPage();

      const gamePage = new GamePage(page);
      const playerName = randomPlayerName();

      this.contexts.push({
        context,
        page,
        gamePage,
        playerName,
        index: i,
      });
    }

    return this.contexts;
  }

  /**
   * Create a game with the first player and have others join
   */
  async createAndJoinGame(playerNames?: string[]): Promise<string> {
    if (this.contexts.length === 0) {
      throw new Error('No players launched. Call launchPlayers first.');
    }

    // Update player names if provided
    if (playerNames) {
      playerNames.forEach((name, i) => {
        if (this.contexts[i]) {
          this.contexts[i].playerName = name;
        }
      });
    }

    // First player creates the game
    const host = this.contexts[0];
    await host.gamePage.gotoLobby();

    const gameId = await host.gamePage.createGame(host.playerName, {
      maxPlayers: this.contexts.length,
      cpuPlayers: 0,
    });

    // Other players join
    for (let i = 1; i < this.contexts.length; i++) {
      const player = this.contexts[i];
      await player.gamePage.gotoLobby();
      await player.gamePage.joinGame(gameId, player.playerName);
    }

    return gameId;
  }

  /**
   * Wait for all players to be in a specific game status
   */
  async waitForAllPlayersStatus(
    status: 'waiting' | 'picking' | 'playing' | 'finished',
    timeout: number = config.gameStateTimeout
  ): Promise<void> {
    const promises = this.contexts.map((ctx) =>
      ctx.gamePage.waitForStatus(status, timeout)
    );
    await Promise.all(promises);
  }

  /**
   * Execute actions in order across all players
   */
  async executeInOrder(
    actions: ((ctx: PlayerContext) => Promise<void>)[]
  ): Promise<void> {
    for (const action of actions) {
      for (const ctx of this.contexts) {
        await action(ctx);
      }
    }
  }

  /**
   * Execute an action for each player in parallel
   */
  async executeForAll(
    action: (ctx: PlayerContext) => Promise<void>
  ): Promise<void> {
    await Promise.all(this.contexts.map(action));
  }

  /**
   * Get the host (first player) context
   */
  getHost(): PlayerContext {
    return this.contexts[0];
  }

  /**
   * Get all player contexts
   */
  getAllPlayers(): PlayerContext[] {
    return this.contexts;
  }

  /**
   * Get a specific player by index
   */
  getPlayer(index: number): PlayerContext {
    return this.contexts[index];
  }

  /**
   * Take screenshots for all players
   */
  async takeScreenshotsAll(name: string): Promise<string[]> {
    const screenshots: string[] = [];

    for (const ctx of this.contexts) {
      const path = `tests/e2e/screenshots/multiplayer/${name}-player${ctx.index}.png`;
      await ctx.page.screenshot({ path, fullPage: true });
      screenshots.push(path);
    }

    return screenshots;
  }

  /**
   * Close all browser contexts
   */
  async closeAll(): Promise<void> {
    for (const ctx of this.contexts) {
      await ctx.context.close();
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.contexts = [];
  }
}

/**
 * Create a harness and run a multiplayer test
 */
export async function withMultiPlayerHarness(
  playerCount: number,
  testFn: (harness: MultiPlayerHarness) => Promise<void>
): Promise<void> {
  const harness = new MultiPlayerHarness();

  try {
    await harness.launchPlayers(playerCount);
    await testFn(harness);
  } finally {
    await harness.closeAll();
  }
}
