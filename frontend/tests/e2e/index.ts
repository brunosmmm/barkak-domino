/**
 * E2E Test Module Exports
 *
 * Main entry point for importing E2E test utilities.
 */

// Configuration
export { config, type TestConfig } from './config';

// Setup and utilities
export { test, expect, randomPlayerName, type Page } from './setup';

// Page Object Model
export {
  GamePage,
  selectors,
  type GameStatus,
  type Domino,
  type PlayedDomino,
  type PlayerInfo,
  type GameOptions,
} from './pages/GamePage';

// Action utilities
export {
  createGameWithCpus,
  createAndStartGame,
  completePicking,
  playTurnIfPossible,
  playUntilGameEnd,
  waitForBoardTiles,
  canDominoPlay,
  findBestMove,
} from './utils/actions';

// State extraction
export {
  extractGameState,
  formatGameState,
  logGameState,
  type ExtractedPlayer,
  type ExtractedGameState,
} from './utils/stateExtractor';

// Multi-player harness
export {
  MultiPlayerHarness,
  withMultiPlayerHarness,
  type PlayerContext,
} from './harness/MultiPlayerHarness';
