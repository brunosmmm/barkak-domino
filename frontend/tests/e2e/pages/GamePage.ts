/**
 * Game Page Object Model
 *
 * Abstraction layer for DOM interactions in the domino game.
 * Provides reliable selectors and high-level navigation methods.
 */

import { Page, Locator, expect } from '@playwright/test';
import { config } from '../config';

export type GameStatus = 'waiting' | 'picking' | 'playing' | 'finished';

export interface Domino {
  left: number;
  right: number;
}

export interface PlayedDomino {
  domino: Domino;
  index: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  tileCount: number;
  isCurrentTurn: boolean;
  isYou: boolean;
}

export interface GameOptions {
  maxPlayers?: number;
  cpuPlayers?: number;
}

/**
 * Selectors for all testable elements
 */
export const selectors = {
  // Lobby
  lobby: '[data-testid="lobby"]',
  lobbyContainer: '[data-testid="lobby-container"]',
  lobbyMenu: '[data-testid="lobby-menu"]',
  lobbyCreate: '[data-testid="lobby-create"]',
  lobbyJoin: '[data-testid="lobby-join"]',
  playerNameInput: '[data-testid="player-name-input"]',
  createGameBtn: '[data-testid="create-game-btn"]',
  joinGameBtn: '[data-testid="join-game-btn"]',
  confirmCreateBtn: '[data-testid="confirm-create-btn"]',
  maxPlayersSelect: '[data-testid="max-players-select"]',
  cpuPlayersSelect: '[data-testid="cpu-players-select"]',
  backBtn: '[data-testid="back-btn"]',
  gameIdInput: '[data-testid="game-id-input"]',
  joinByIdBtn: '[data-testid="join-by-id-btn"]',
  openGamesList: '[data-testid="open-games-list"]',

  // Game container
  gameContainer: '[data-testid="game-container"]',
  gameStatus: '[data-testid="game-status"]',
  gameId: '[data-testid="game-id"]',

  // Waiting status
  waitingStatus: '[data-testid="waiting-status"]',
  startGameBtn: '[data-testid="start-game-btn"]',
  addCpuBtn: '[data-testid="add-cpu-btn"]',
  copyInviteBtn: '[data-testid="copy-invite-btn"]',

  // Picking phase
  pickingPhase: '[data-testid="picking-phase"]',
  tilePicking: '[data-testid="tile-picking"]',
  pickingTimer: '[data-testid="picking-timer"]',
  tileGrid: '[data-testid="tile-grid"]',
  tilePosition: (pos: number) => `[data-testid="tile-position-${pos}"]`,
  playerProgress: '[data-testid="player-progress"]',
  pickedTiles: '[data-testid="picked-tiles"]',

  // Playing phase
  gameBoard: '[data-testid="game-board"]',
  boardTiles: '[data-testid="board-tiles"]',
  playLeftBtn: '[data-testid="play-left-btn"]',
  playRightBtn: '[data-testid="play-right-btn"]',
  playerHand: '[data-testid="player-hand"]',
  handTiles: '[data-testid="hand-tiles"]',
  handTile: (index: number) => `[data-testid="hand-tile-${index}"]`,
  passBtn: '[data-testid="pass-btn"]',

  // Reactions
  reactionPicker: '[data-testid="reaction-picker"]',
  reactionToggleBtn: '[data-testid="reaction-toggle-btn"]',
  reactionPopup: '[data-testid="reaction-popup"]',
  reaction: (name: string) => `[data-testid="reaction-${name}"]`,

  // Round overlay
  roundOverlay: '[data-testid="round-overlay"]',
  nextRoundBtn: '[data-testid="next-round-btn"]',
  newMatchBtn: '[data-testid="new-match-btn"]',
  leaveGameBtn: '[data-testid="leave-game-btn"]',
};

export class GamePage {
  public readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Locator helpers
  private locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Navigate to the lobby
   */
  async gotoLobby(): Promise<void> {
    await this.page.goto('/');
    await this.locator(selectors.lobby).waitFor();
  }

  /**
   * Navigate to join a specific game via URL
   */
  async gotoJoinGame(gameId: string): Promise<void> {
    await this.page.goto(`/?join=${gameId}`);
    await this.locator(selectors.lobby).waitFor();
  }

  /**
   * Enter player name in the lobby
   */
  async enterPlayerName(name: string): Promise<void> {
    const input = this.locator(selectors.playerNameInput);
    await input.fill(name);
  }

  /**
   * Create a new game with options
   */
  async createGame(playerName: string, options: GameOptions = {}): Promise<string> {
    const { maxPlayers = 4, cpuPlayers = 0 } = options;

    // Enter name and click create
    await this.enterPlayerName(playerName);
    await this.locator(selectors.createGameBtn).click();

    // Wait for create form
    await this.locator(selectors.lobbyCreate).waitFor();

    // Set max players
    if (maxPlayers !== 4) {
      await this.locator(selectors.maxPlayersSelect).selectOption(String(maxPlayers));
    }

    // Set CPU players
    if (cpuPlayers > 0) {
      await this.locator(selectors.cpuPlayersSelect).selectOption(String(cpuPlayers));
    }

    // Confirm create
    await this.locator(selectors.confirmCreateBtn).click();

    // Wait for game container (indicates successful game creation)
    await this.locator(selectors.gameContainer).waitFor({ timeout: config.gameStateTimeout });

    // Get the game ID
    return this.getGameId();
  }

  /**
   * Join an existing game by ID
   */
  async joinGame(gameId: string, playerName: string): Promise<void> {
    await this.enterPlayerName(playerName);
    await this.locator(selectors.joinGameBtn).click();

    await this.locator(selectors.lobbyJoin).waitFor();

    // Use the join-mode name input
    const nameInput = this.page.locator('[data-testid="player-name-input-join"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(playerName);
    }

    // Enter game ID
    await this.locator(selectors.gameIdInput).fill(gameId);

    // Click join
    await this.locator(selectors.joinByIdBtn).click();

    // Wait for game container
    await this.locator(selectors.gameContainer).waitFor({ timeout: config.gameStateTimeout });
  }

  /**
   * Get the current game ID
   */
  async getGameId(): Promise<string> {
    // First try the container's data-game-id attribute (always present)
    const container = this.locator(selectors.gameContainer);
    const gameId = await container.getAttribute('data-game-id');
    if (gameId) return gameId;

    // Fallback to the game-id element (only in waiting status)
    const element = this.locator(selectors.gameId);
    return (await element.textContent()) ?? '';
  }

  /**
   * Get the current game status
   */
  async getGameStatus(): Promise<GameStatus> {
    const container = this.locator(selectors.gameContainer);
    const status = await container.getAttribute('data-game-status');
    return (status as GameStatus) || 'waiting';
  }

  /**
   * Wait for a specific game status
   */
  async waitForStatus(status: GameStatus, timeout: number = config.gameStateTimeout): Promise<void> {
    await expect(this.locator(selectors.gameContainer)).toHaveAttribute('data-game-status', status, { timeout });
  }

  /**
   * Start the game (host only)
   */
  async startGame(): Promise<void> {
    await this.locator(selectors.startGameBtn).click();
    await this.waitForStatus('picking');
  }

  /**
   * Add a CPU player (host only)
   */
  async addCpu(): Promise<void> {
    await this.locator(selectors.addCpuBtn).click();
    // Wait for player count to increase
    await this.page.waitForTimeout(500);
  }

  /**
   * Claim a tile at the given grid position during picking phase
   */
  async claimTile(gridPosition: number): Promise<void> {
    const tile = this.locator(selectors.tilePosition(gridPosition));

    // Check if available
    await expect(tile).toHaveAttribute('data-available', 'true');

    await tile.click();
    // Wait for tile to be claimed (animation)
    await this.page.waitForTimeout(100);
  }

  /**
   * Get list of available tile positions in picking phase
   */
  async getAvailableTilePositions(): Promise<number[]> {
    const positions: number[] = [];
    for (let i = 0; i < 28; i++) {
      const tile = this.locator(selectors.tilePosition(i));
      if (await tile.isVisible()) {
        const isAvailable = await tile.getAttribute('data-available');
        if (isAvailable === 'true') {
          positions.push(i);
        }
      }
    }
    return positions;
  }

  /**
   * Claim all remaining tiles (up to 6)
   */
  async claimAllTiles(): Promise<void> {
    for (let picked = 0; picked < 6; picked++) {
      const available = await this.getAvailableTilePositions();
      if (available.length === 0) break;

      await this.claimTile(available[0]);
      await this.page.waitForTimeout(200); // Wait between picks
    }
  }

  /**
   * Get tiles currently in hand
   */
  async getHandTiles(): Promise<Domino[]> {
    await this.locator(selectors.handTiles).waitFor();

    const tiles = await this.page.$$eval(
      `${selectors.handTiles} > div[data-domino]`,
      (elements) =>
        elements.map((el) => {
          const domino = el.getAttribute('data-domino');
          if (!domino) return null;
          const [left, right] = domino.split('-').map(Number);
          return { left, right };
        })
    );

    return tiles.filter((t): t is Domino => t !== null);
  }

  /**
   * Get playable tiles from hand
   */
  async getPlayableTiles(): Promise<{ index: number; domino: Domino }[]> {
    await this.locator(selectors.handTiles).waitFor();

    const tiles = await this.page.$$eval(
      `${selectors.handTiles} > div[data-testid^="hand-tile-"]`,
      (elements) =>
        elements.map((el, index) => {
          const domino = el.getAttribute('data-domino');
          const playable = el.getAttribute('data-playable') === 'true';
          if (!domino || !playable) return null;
          const [left, right] = domino.split('-').map(Number);
          return { index, domino: { left, right } };
        })
    );

    return tiles.filter((t): t is { index: number; domino: Domino } => t !== null);
  }

  /**
   * Select a tile from hand by index
   */
  async selectTileFromHand(index: number): Promise<void> {
    await this.locator(selectors.handTile(index)).click();
  }

  /**
   * Play selected tile on the left side
   */
  async playLeft(): Promise<void> {
    await this.locator(selectors.playLeftBtn).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Play selected tile on the right side
   */
  async playRight(): Promise<void> {
    await this.locator(selectors.playRightBtn).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Play a tile (first move or single-side play)
   */
  async playTile(index: number, side?: 'left' | 'right'): Promise<void> {
    await this.selectTileFromHand(index);

    // For first move, clicking tile auto-plays it
    const boardTileCount = await this.getBoardTileCount();
    if (boardTileCount === 0) {
      return; // Already played on first click
    }

    // Otherwise select the side
    if (side === 'left') {
      await this.playLeft();
    } else if (side === 'right') {
      await this.playRight();
    } else {
      // Try left first, then right if not available
      const leftBtn = this.locator(selectors.playLeftBtn);
      if (await leftBtn.isVisible()) {
        await this.playLeft();
      } else {
        await this.playRight();
      }
    }
  }

  /**
   * Pass the current turn
   */
  async passTurn(): Promise<void> {
    await this.locator(selectors.passBtn).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Check if it's currently your turn
   */
  async isYourTurn(): Promise<boolean> {
    const status = this.locator(selectors.gameStatus);
    if (!(await status.isVisible())) return false;

    const text = await status.textContent();
    return text?.includes('Your Turn') || text?.includes('GO!') || false;
  }

  /**
   * Wait for it to be your turn
   */
  async waitForYourTurn(timeout: number = config.gameStateTimeout): Promise<void> {
    await expect(async () => {
      const isYourTurn = await this.isYourTurn();
      expect(isYourTurn).toBe(true);
    }).toPass({ timeout });
  }

  /**
   * Get the number of tiles on the board
   */
  async getBoardTileCount(): Promise<number> {
    const board = this.locator(selectors.gameBoard);
    if (!(await board.isVisible())) return 0;

    const count = await board.getAttribute('data-board-tiles');
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Get board end values
   */
  async getBoardEnds(): Promise<{ left: number | null; right: number | null }> {
    const leftBtn = this.locator(selectors.playLeftBtn);
    const rightBtn = this.locator(selectors.playRightBtn);

    const left = (await leftBtn.isVisible())
      ? parseInt((await leftBtn.getAttribute('data-end-value')) ?? '', 10) || null
      : null;

    const right = (await rightBtn.isVisible())
      ? parseInt((await rightBtn.getAttribute('data-end-value')) ?? '', 10) || null
      : null;

    return { left, right };
  }

  /**
   * Check if pass button is available
   */
  async canPass(): Promise<boolean> {
    return this.locator(selectors.passBtn).isVisible();
  }

  /**
   * Send a reaction emoji
   */
  async sendReaction(emoji: string): Promise<void> {
    // Open reaction picker
    await this.locator(selectors.reactionToggleBtn).click();
    await this.locator(selectors.reactionPopup).waitFor();

    // Find the reaction button by emoji
    const button = this.locator(`${selectors.reactionPopup} button[data-emoji="${emoji}"]`);
    await button.click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Click next round button (after round ends)
   */
  async clickNextRound(): Promise<void> {
    await this.locator(selectors.nextRoundBtn).click();
    await this.waitForStatus('picking');
  }

  /**
   * Check if round overlay is visible
   */
  async isRoundOverlayVisible(): Promise<boolean> {
    return this.locator(selectors.roundOverlay).isVisible();
  }

  /**
   * Leave the current game
   */
  async leaveGame(): Promise<void> {
    const leaveBtn = this.locator(selectors.leaveGameBtn);
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
    }
    await this.locator(selectors.lobby).waitFor();
  }

  /**
   * Get picking timer remaining seconds
   */
  async getPickingTimerRemaining(): Promise<number | null> {
    const timer = this.locator(selectors.pickingTimer);
    if (!(await timer.isVisible())) return null;

    const remaining = await timer.getAttribute('data-time-remaining');
    return remaining ? parseInt(remaining, 10) : null;
  }
}
