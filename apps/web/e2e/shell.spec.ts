import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ORIGIN = 'http://localhost:4173';

test.describe('web shell', () => {
  test('renders the heading', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Margwise');
  });

  test('makes no request outside its own origin (04 §8 CSP; 04 §6 consent)', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (req) => {
      if (!req.url().startsWith(ORIGIN)) foreign.push(req.url());
    });
    await page.goto(ORIGIN);
    await page.waitForLoadState('networkidle');
    expect(foreign).toEqual([]);
  });

  test('has no axe violations (WCAG 2.2 AA)', async ({ page }) => {
    await page.goto(ORIGIN);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
