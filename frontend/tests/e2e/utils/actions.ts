/**
 * Common Test Action Utilities
 *
 * Higher-level actions for game interactions.
 */

import { Page, expect } from '@playwright/test';
import { GamePage, Domino, selectors } from '../pages/GamePage';
import { config } from '../config';

/**
 * Create a game and fill it with CPU players
 */
export async function createGameWithCpus(
  page: Page,
  playerName: string,
  cpuCount: number = 3
): Promise<{ gamePage: GamePage; gameId: string }> {
  const gamePage = new GamePage(page);
  await gamePage.gotoLobby();

  const gameId = await gamePage.createGame(playerName, {
    maxPlayers: cpuCount + 1,
    cpuPlayers: cpuCount,
  });

  return { gamePage, gameId };
}

/**
 * Create a game and start it with CPU players
 */
export async function createAndStartGame(
  page: Page,
  playerName: string,
  cpuCount: number = 3
): Promise<GamePage> {
  const { gamePage } = await createGameWithCpus(page, playerName, cpuCount);

  // With all slots filled, game may auto-start to picking phase
  const status = await gamePage.getGameStatus();
  if (status === 'waiting') {
    // Start the game manually if not auto-started
    await gamePage.startGame();
  } else {
    // Already in picking or later phase
    await gamePage.waitForStatus('picking');
  }

  return gamePage;
}

/**
 * Complete the picking phase by claiming 6 tiles
 */
export async function completePicking(gamePage: GamePage): Promise<Domino[]> {
  await gamePage.claimAllTiles();

  // Wait for picking to complete (either manually or by timeout)
  try {
    await gamePage.waitForStatus('playing', 120000); // 2 min max for picking
  } catch {
    // If not transitioned yet, tiles may still be auto-assigned
    const status = await gamePage.getGameStatus();
    if (status !== 'playing') {
      throw new Error(`Game stuck in status: ${status}`);
    }
  }

  return gamePage.getHandTiles();
}

/**
 * Play a turn if it's your turn
 * Returns true if a move was made
 */
export async function playTurnIfPossible(gamePage: GamePage): Promise<boolean> {
  const isYourTurn = await gamePage.isYourTurn();
  if (!isYourTurn) return false;

  // Get playable tiles
  const playable = await gamePage.getPlayableTiles();

  if (playable.length > 0) {
    // Play the first playable tile
    await gamePage.playTile(playable[0].index);
    return true;
  }

  // Check if we can pass
  const canPass = await gamePage.canPass();
  if (canPass) {
    await gamePage.passTurn();
    return true;
  }

  return false;
}

/**
 * Play all turns until game ends or times out
 */
export async function playUntilGameEnd(
  gamePage: GamePage,
  maxTurns: number = 100
): Promise<'finished' | 'timeout'> {
  let turnCount = 0;

  while (turnCount < maxTurns) {
    const status = await gamePage.getGameStatus();
    if (status === 'finished') return 'finished';

    // Wait for your turn or check if game ended
    try {
      await gamePage.waitForYourTurn(5000);
    } catch {
      // Check if game ended
      const currentStatus = await gamePage.getGameStatus();
      if (currentStatus === 'finished') return 'finished';
      continue; // Not our turn yet
    }

    // Play our turn
    const played = await playTurnIfPossible(gamePage);
    if (played) {
      turnCount++;
      await gamePage.page.waitForTimeout(500); // Wait for state update
    }
  }

  return 'timeout';
}

/**
 * Wait for the game board to have at least N tiles
 */
export async function waitForBoardTiles(
  gamePage: GamePage,
  minTiles: number,
  timeout: number = config.gameStateTimeout
): Promise<void> {
  await expect(async () => {
    const count = await gamePage.getBoardTileCount();
    expect(count).toBeGreaterThanOrEqual(minTiles);
  }).toPass({ timeout });
}

/**
 * Check if a domino can be played on either end
 */
export function canDominoPlay(
  domino: Domino,
  ends: { left: number | null; right: number | null }
): { canPlayLeft: boolean; canPlayRight: boolean } {
  if (ends.left === null || ends.right === null) {
    return { canPlayLeft: true, canPlayRight: true };
  }

  const canPlayLeft = domino.left === ends.left || domino.right === ends.left;
  const canPlayRight = domino.left === ends.right || domino.right === ends.right;

  return { canPlayLeft, canPlayRight };
}

/**
 * Find the best tile to play based on current board state
 */
export function findBestMove(
  hand: Domino[],
  ends: { left: number | null; right: number | null }
): { index: number; side: 'left' | 'right' } | null {
  for (let i = 0; i < hand.length; i++) {
    const domino = hand[i];
    const { canPlayLeft, canPlayRight } = canDominoPlay(domino, ends);

    if (canPlayLeft) {
      return { index: i, side: 'left' };
    }
    if (canPlayRight) {
      return { index: i, side: 'right' };
    }
  }

  return null;
}

// Re-export the page for access
export { GamePage };
