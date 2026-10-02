// Control Centre's end-to-end journeys, run by the e2e harness (e2e/playwright.config.ts) when an
// edition ships this app. test and expect come through the harness's helpers, so the suite uses
// the harness's Playwright.
import { WORKSPACE, expect, openSignedIn, test } from '../../../e2e/tests/helpers'

// Control Centre, the first app package (C102): its own routes under /control-centre, its rail,
// and the organisation data in @workspace/org (C106).

test.beforeEach(async ({ page }) => {
  await openSignedIn(page, `${WORKSPACE}/control-centre`)
})

test('the overview renders with Control Centre’s rail', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Approval chains/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Billing & plan/ })).toBeVisible()
})

test('employees list and a record deep link', async ({ page }) => {
  await page.goto(`${WORKSPACE}/control-centre/employees`)
  await expect(page.getByRole('heading', { level: 1, name: 'Employees' })).toBeVisible()
  await expect(page.locator('table tbody tr').first()).toBeVisible()
  await page.goto(`${WORKSPACE}/control-centre/employees?id=EMP-001`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada Whitfield')
})

test('a filter in the URL narrows the sites list', async ({ page }) => {
  await page.goto(`${WORKSPACE}/control-centre/sites`)
  await expect(page.locator('table tbody tr').first()).toBeVisible()
  const all = await page.locator('table tbody tr').count()
  await page.goto(`${WORKSPACE}/control-centre/sites?filter=Paused`)
  await expect(page.getByRole('heading', { level: 1, name: 'Sites' })).toBeVisible()
  await expect(page.locator('table tbody tr').first()).toBeVisible()
  const paused = await page.locator('table tbody tr').count()
  expect(paused).toBeLessThan(all)
})

test('the top bar is the workspace’s and stays when switching apps', async ({ page }) => {
  // mark the top bar once the page has finished its first render
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  const topBar = page.locator('header').first()
  await topBar.evaluate((el) => (el.dataset.e2e = 'same'))
  await page.getByRole('button', { name: 'Switch app' }).click()
  await page.locator('a[href="/inventory"]').click()
  await expect(page).toHaveURL(`${WORKSPACE}/inventory`)
  await expect(page.locator('header').first()).toHaveAttribute('data-e2e', 'same')
})
