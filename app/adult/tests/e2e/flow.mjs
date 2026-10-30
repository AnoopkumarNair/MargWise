// After "Continue" on the confirm or skills screen the flow is: questions (S2), your job today (S2), roads. Tests that only want the roads skip through.
export async function seeRoads(page, { answer, tolerant } = {}) {
  await page.locator('#see-roads').click();
  // tolerant: a fixture with no usable skill stays on the confirm screen with a message; that is not a failure for the corpus tests
  if (tolerant && !(await page.locator('#skip-constraints').waitFor({ timeout: 4000 }).then(() => true, () => false))) return false;
  await page.locator('#skip-constraints').waitFor();
  if (answer) await answer(page); else await page.locator('#skip-constraints').click();
  await page.locator('#to-roads').click();
  await page.locator('#road-count:has-text("shown")').waitFor();
  return true;
}
