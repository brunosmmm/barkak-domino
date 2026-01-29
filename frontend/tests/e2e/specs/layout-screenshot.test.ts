/**
 * Simple Layout Screenshot Test
 *
 * Opens test mode page and captures layout screenshots.
 */
import { test, expect } from '@playwright/test';

test('capture layout screenshots', async ({ page }) => {
  // Test mode provides a pre-set game state
  await page.goto('http://localhost:5173?test=layout');

  // Wait for game container
  await page.waitForSelector('[data-testid="game-container"]', { timeout: 10000 });

  // Wait for board to render
  await page.waitForTimeout(1000);

  // Take screenshot at different viewports
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1280, height: 800, name: 'desktop' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `test-results/layout-${vp.name}.png`,
      fullPage: false
    });
    console.log(`Screenshot: layout-${vp.name}.png`);
  }

  expect(true).toBe(true);
});

test('layout with many tiles', async ({ page }) => {
  // Test mode with more tiles
  await page.goto('http://localhost:5173?test=layout&tiles=12');

  await page.waitForSelector('[data-testid="game-container"]', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Narrow viewport to force turns
  await page.setViewportSize({ width: 400, height: 600 });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'test-results/layout-many-tiles.png',
    fullPage: false
  });

  // Check for board tiles
  const tiles = await page.locator('[data-testid^="board-tile-"]').count();
  console.log(`Board has ${tiles} tiles`);

  expect(tiles).toBeGreaterThan(0);
});
