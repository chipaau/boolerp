import { expect, test } from '@playwright/test'
import { ADMIN, IDENTITY, WORKSPACE, openSignedIn } from './helpers'

// Sign out everywhere (C101): the BFF, Hydra, and the login service's session end, and Hydra's
// back-channel logout signs the same login out of the other app.

test('signing out of the workspace signs out of the admin console too', async ({ page }) => {
  await openSignedIn(page, `${WORKSPACE}/`)
  await openSignedIn(page, `${ADMIN}/`) // the same login, silently through the Kratos session

  await page.goto(`${WORKSPACE}/`)
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()

  // Back at the workspace, which asks for the password again: the Kratos session ended.
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
  await expect(page.locator('input[name="password"]')).toBeVisible()

  // The admin console's session ended through back-channel logout.
  await page.goto(`${ADMIN}/`)
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
})

// A logout no app started (a plain link to Hydra's logout, which any site can make) is asked
// about first (C112); staying signed in keeps the session, confirming ends it.
test('a logout link from elsewhere asks first', async ({ page }) => {
  await openSignedIn(page, `${WORKSPACE}/`)
  const me = `${WORKSPACE}/api/auth/me`

  await page.goto(`${IDENTITY}/oauth2/sessions/logout`)
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/logout/confirm`))
  await page.getByRole('button', { name: 'Stay signed in' }).click()
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/settings`)) // the login service's account page
  expect((await page.request.get(me)).status()).toBe(200)

  await page.goto(`${IDENTITY}/oauth2/sessions/logout`)
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/logout/confirm`))
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
  await expect.poll(async () => (await page.request.get(me)).status()).toBe(401)
})
