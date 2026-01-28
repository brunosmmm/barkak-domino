/**
 * State Extraction Module
 *
 * DOM parsing to read current game state without access to Zustand store.
 * Enables Claude to query game state during test debugging.
 */

import { Page } from '@playwright/test';
import { GameStatus, Domino, selectors } from '../pages/GamePage';

export interface ExtractedPlayer {
  name: string;
  tileCount: number;
  isCurrentTurn: boolean;
  isYou: boolean;
}

export interface ExtractedGameState {
  /** Current game status */
  status: GameStatus;
  /** Current turn player name (null if not playing) */
  currentTurn: string | null;
  /** Tiles in your hand */
  myHand: Domino[];
  /** Number of tiles on the board */
  boardTileCount: number;
  /** Board end values */
  ends: { left: number | null; right: number | null };
  /** All players info */
  players: ExtractedPlayer[];
  /** Picking timer remaining (null if not in picking) */
  pickingTimerRemaining: number | null;
  /** Whether it's your turn */
  isYourTurn: boolean;
  /** Whether pass button is available */
  canPass: boolean;
  /** Game ID if visible */
  gameId: string | null;
}

/**
 * Extract the complete game state from the DOM
 */
export async function extractGameState(page: Page): Promise<ExtractedGameState> {
  return page.evaluate(() => {
    // Helper to safely get attribute
    const getAttr = (selector: string, attr: string): string | null => {
      const el = document.querySelector(selector);
      return el?.getAttribute(attr) ?? null;
    };

    // Helper to safely get text content
    const getText = (selector: string): string | null => {
      const el = document.querySelector(selector);
      return el?.textContent?.trim() ?? null;
    };

    // Get game status
    const statusAttr = getAttr('[data-testid="game-container"]', 'data-game-status');
    const status = (statusAttr as 'waiting' | 'picking' | 'playing' | 'finished') || 'waiting';

    // Get hand tiles (check both regular hand and picking phase preview)
    const myHand: { left: number; right: number }[] = [];

    // During playing phase: hand-tiles container
    const handElements = document.querySelectorAll('[data-testid="hand-tiles"] > div[data-domino]');
    handElements.forEach((el) => {
      const domino = el.getAttribute('data-domino');
      if (domino) {
        const [left, right] = domino.split('-').map(Number);
        myHand.push({ left, right });
      }
    });

    // During picking phase: picked-tiles-container
    if (myHand.length === 0) {
      const pickedElements = document.querySelectorAll('[data-testid="picked-tiles-container"] > div[data-domino]');
      pickedElements.forEach((el) => {
        const domino = el.getAttribute('data-domino');
        if (domino) {
          const [left, right] = domino.split('-').map(Number);
          myHand.push({ left, right });
        }
      });
    }

    // Get board tile count
    const boardTilesAttr = getAttr('[data-testid="game-board"]', 'data-board-tiles');
    const boardTileCount = boardTilesAttr ? parseInt(boardTilesAttr, 10) : 0;

    // Get board ends
    const leftEndAttr = getAttr('[data-testid="play-left-btn"]', 'data-end-value');
    const rightEndAttr = getAttr('[data-testid="play-right-btn"]', 'data-end-value');
    const ends = {
      left: leftEndAttr ? parseInt(leftEndAttr, 10) : null,
      right: rightEndAttr ? parseInt(rightEndAttr, 10) : null,
    };

    // Get picking timer
    const timerAttr = getAttr('[data-testid="picking-timer"]', 'data-time-remaining');
    const pickingTimerRemaining = timerAttr ? parseInt(timerAttr, 10) : null;

    // Determine if it's your turn
    const statusText = getText('[data-testid="game-status"]') || '';
    const isYourTurn = statusText.includes('Your Turn') || statusText.includes('GO!');

    // Check if pass is available
    const passBtn = document.querySelector('[data-testid="pass-btn"]');
    const canPass = passBtn !== null;

    // Get game ID
    const gameId = getText('[data-testid="game-id"]');

    // Get current turn player name
    let currentTurn: string | null = null;
    if (statusText.includes('Waiting for')) {
      const match = statusText.match(/Waiting for (.+?)\.\.\./);
      if (match) {
        currentTurn = match[1];
      }
    } else if (isYourTurn) {
      currentTurn = 'You';
    }

    // Get player info from progress indicators or player list
    const players: ExtractedPlayer[] = [];
    const progressElements = document.querySelectorAll('[data-testid^="player-progress-"]');
    progressElements.forEach((el) => {
      const tileCountAttr = el.getAttribute('data-tile-count');
      const nameEl = el.querySelector('span');
      const name = nameEl?.textContent?.trim() || '';
      players.push({
        name,
        tileCount: tileCountAttr ? parseInt(tileCountAttr, 10) : 0,
        isCurrentTurn: false, // Can't easily determine from picking phase
        isYou: name === 'YOU',
      });
    });

    return {
      status,
      currentTurn,
      myHand,
      boardTileCount,
      ends,
      players,
      pickingTimerRemaining,
      isYourTurn,
      canPass,
      gameId,
    };
  });
}

/**
 * Print game state in a human-readable format
 */
export function formatGameState(state: ExtractedGameState): string {
  const lines: string[] = [];

  lines.push(`=== Game State ===`);
  lines.push(`Status: ${state.status}`);
  if (state.gameId) {
    lines.push(`Game ID: ${state.gameId}`);
  }

  lines.push('');
  lines.push(`Current Turn: ${state.currentTurn || 'N/A'}`);
  lines.push(`Is Your Turn: ${state.isYourTurn}`);
  lines.push(`Can Pass: ${state.canPass}`);

  if (state.pickingTimerRemaining !== null) {
    lines.push(`Picking Timer: ${state.pickingTimerRemaining}s`);
  }

  lines.push('');
  lines.push(`Your Hand (${state.myHand.length} tiles):`);
  state.myHand.forEach((d, i) => {
    lines.push(`  [${i}] ${d.left}|${d.right}`);
  });

  lines.push('');
  lines.push(`Board: ${state.boardTileCount} tiles`);
  if (state.ends.left !== null || state.ends.right !== null) {
    lines.push(`  Left end: ${state.ends.left ?? 'N/A'}`);
    lines.push(`  Right end: ${state.ends.right ?? 'N/A'}`);
  }

  if (state.players.length > 0) {
    lines.push('');
    lines.push('Players:');
    state.players.forEach((p) => {
      lines.push(`  ${p.isYou ? '* ' : '  '}${p.name}: ${p.tileCount} tiles`);
    });
  }

  return lines.join('\n');
}

/**
 * Quick state summary for debugging
 */
export async function logGameState(page: Page): Promise<void> {
  const state = await extractGameState(page);
  console.log(formatGameState(state));
}
