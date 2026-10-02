import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

// App packages' specs (packages/app-<slug>/e2e) import test and expect from here, so every spec
// runs on the harness's one Playwright.
export { expect, test } from '@playwright/test'

export const WORKSPACE = 'http://demo.bool.test'
export const ADMIN = 'http://admin.bool.test'
export const IDENTITY = 'http://identity.bool.test'

/** The account global-setup created. */
export const user = (): { email: string; password: string } =>
  JSON.parse(readFileSync(new URL('../.auth/user.json', import.meta.url), 'utf8'))

/** Fills the login service's password form and submits it. */
export async function submitLogin(page: Page) {
  const { email, password } = user()
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
  const identifier = page.locator('input[name="identifier"]')
  if (await identifier.isVisible()) await identifier.fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="password"]').press('Enter')
}

const onLoginPage = (page: Page) => page.url().startsWith(`${IDENTITY}/login`)

/**
 * Opens url signed in. A signed-out page first loads, then the app sends the browser through its
 * BFF and Hydra: to the login page, or straight back when the login service still has a session.
 * So wait until either the login page shows (then sign in) or the BFF answers for a session.
 */
export async function openSignedIn(page: Page, url: string) {
  await page.goto(url)
  const me = `${new URL(url).origin}/api/auth/me`
  await expect
    .poll(async () => onLoginPage(page) || (await page.request.get(me)).status() === 200, { timeout: 20_000 })
    .toBe(true)
  if (onLoginPage(page)) await submitLogin(page)
  await expect(page).toHaveURL(url)
}
