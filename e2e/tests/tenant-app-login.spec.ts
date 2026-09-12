import { test, expect } from '@playwright/test'

// Covers apps/app's own login (the tenant-facing ERP app), alongside tenant-lifecycle.spec.ts's
// coverage of apps/admin (the operator console) — same dev-autofill pattern (packages/auth's
// KratosForm), different app and different seeded identity (the malecouncil tenant's owner, not
// the internal-tenant operator).
test('tenant owner signs in to the tenant app', async ({ page }) => {
  await page.goto('http://malecouncil.bool.test/login')
  await page.getByRole('button', { name: 'Sign in with password' }).click()
  await expect(page.getByRole('heading', { name: 'Apps' })).toBeVisible()
})
