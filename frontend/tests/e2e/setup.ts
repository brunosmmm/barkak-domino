/**
 * E2E Test Setup
 *
 * Common test utilities and fixtures for Playwright tests.
 */

import { test as base, expect, Page } from '@playwright/test';
import { GamePage } from './pages/GamePage';

/**
 * Generate a random player name
 */
export function randomPlayerName(): string {
  const adjectives = ['Swift', 'Bold', 'Lucky', 'Wise', 'Quick', 'Brave'];
  const nouns = ['Tiger', 'Eagle', 'Wolf', 'Bear', 'Hawk', 'Lion'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

/**
 * Extended test fixture with GamePage and player name
 */
export const test = base.extend<{
  gamePage: GamePage;
  playerName: string;
}>({
  gamePage: async ({ page }, use) => {
    const gamePage = new GamePage(page);
    await use(gamePage);
  },
  playerName: async ({}, use) => {
    await use(randomPlayerName());
  },
});

export { expect };
export type { Page };
