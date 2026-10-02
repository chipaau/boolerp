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
  // Wait for the form before looking for the email field: isVisible() does not wait, so on a
  // page still rendering (the first test on a fresh stack) it found no email field and the form
  // went out without one. The field is absent only in flows where Kratos already knows the
  // account (re-authentication), and the password field is always there.
  const passwordField = page.locator('input[name="password"]')
  await expect(passwordField).toBeVisible()
  const identifier = page.locator('input[name="identifier"]')
  if (await identifier.isVisible()) await identifier.fill(email)
  await passwordField.fill(password)
  await passwordField.press('Enter')
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
