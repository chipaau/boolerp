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
