/**
 * E2E Test Configuration
 *
 * Centralized configuration for Playwright-based E2E tests.
 */

export interface TestConfig {
  /** Frontend dev server URL */
  frontendUrl: string;
  /** Backend API URL */
  backendUrl: string;
  /** Timeout for waiting for game state changes (ms) */
  gameStateTimeout: number;
}

export const config: TestConfig = {
  frontendUrl: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.E2E_BACKEND_URL || 'http://localhost:5000',
  gameStateTimeout: 15000,
};
