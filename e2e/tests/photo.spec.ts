import { expect, type Page } from '@playwright/test'
import { ADMIN, WORKSPACE, openSignedIn, test } from './helpers'

// C196: a person's photo is saved on their account, so the one chosen in the workspace is the one
// the admin console shows, and the other way round. The avatar draws its <img> only once the
// picture has loaded, so these checks also prove the portraits are served and allowed to load.

const avatar = (page: Page) => page.getByRole('button', { name: /Account menu$/ }).locator('img')

/** Picks `label` ("Portrait 3", "Just my initials") in the photo dialog and saves it. */
async function choosePhoto(page: Page, label: string) {
  await page.getByRole('button', { name: /Account menu$/ }).click()
  await page.getByRole('menuitem', { name: 'Change photo…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your photo' })
  await dialog.getByTitle(label, { exact: true }).click()
  const save = dialog.getByRole('button', { name: 'Save' })
  // Already the account's photo (left by an earlier run): nothing to save.
  if (await save.isEnabled()) await save.click()
  else await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
}

test('a photo chosen in one app is the photo in the other', async ({ page, context }) => {
  await openSignedIn(page, `${WORKSPACE}/`)
  await choosePhoto(page, 'Just my initials')
  await expect(avatar(page)).toHaveCount(0)

  // Chosen in the workspace: shown there at once, without a reload.
  await choosePhoto(page, 'Portrait 3')
  await expect(avatar(page)).toHaveAttribute('src', /\/portraits\/portrait-3\./)

  // The admin console, signed in by the same login, shows the same photo.
  const admin = await context.newPage()
  await openSignedIn(admin, `${ADMIN}/`)
  await expect(avatar(admin)).toHaveAttribute('src', /\/portraits\/portrait-3\./)

  // Cleared in the console: the workspace drops it when its tab is in front again.
  await choosePhoto(admin, 'Just my initials')
  await expect(avatar(admin)).toHaveCount(0)
  await page.bringToFront()
  // A headless tab never stops being visible, so announce the return the way a browser would.
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(avatar(page)).toHaveCount(0)
})
