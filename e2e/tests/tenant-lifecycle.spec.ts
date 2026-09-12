import { test, expect } from '@playwright/test'

// Covers the golden path Phase H actually built and wired to a real backend: operator login,
// provisioning a tenant, and its full status lifecycle. Does NOT test "the suspended tenant's own
// login fails" — that would require apps/app's own backend integration and the tenant-resolution
// middleware (internal/tenancy.Middleware.RequireTenant) mounted on a real route, neither of which
// exists yet (apps/app is still mock-data only). Suspension already updates real DB state and is
// unit/integration-tested at the Go level (internal/tenancy's SuspendTenant tests) — this suite's
// job is the operator-facing UI flow around it.
test('operator provisions a tenant and drives it through suspend / reactivate / archive', async ({ page }) => {
  const suffix = Date.now()
  const slug = `e2e-${suffix}`
  const name = `E2E Test Co ${suffix}`

  await test.step('operator signs in', async () => {
    await page.goto('http://admin.bool.test/login')
    await page.getByRole('button', { name: 'Sign in with password' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  await test.step('navigate to tenants via the sidebar', async () => {
    await page.getByRole('link', { name: 'Tenants' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
  })

  await test.step('provision a new tenant', async () => {
    await page.getByRole('button', { name: 'New tenant' }).click()
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('Slug', { exact: true }).fill(slug)
    await page.getByLabel('Code', { exact: true }).fill(`E2E${suffix}`.slice(0, 12))
    await page.getByLabel('Owner email', { exact: true }).fill(`owner@${slug}.test`)
    await page.getByLabel('Owner name', { exact: true }).fill('E2E Owner')
    await page.getByRole('button', { name: 'Provision' }).click()
    await expect(page.getByText(`${name} provisioned`)).toBeVisible()
  })

  const row = page.getByRole('row', { name: new RegExp(name) })

  await test.step('the new tenant appears active', async () => {
    await expect(row).toBeVisible()
    await expect(row.getByText('active', { exact: true })).toBeVisible()
  })

  await test.step('suspend it', async () => {
    await row.getByRole('button', { name: 'Suspend' }).click()
    await page.getByRole('button', { name: 'Suspend', exact: true }).last().click()
    await expect(page.getByText(`${name} suspended`)).toBeVisible()
    await expect(row.getByText('suspended', { exact: true })).toBeVisible()
  })

  await test.step('reactivate it', async () => {
    await row.getByRole('button', { name: 'Reactivate' }).click()
    await page.getByRole('button', { name: 'Reactivate', exact: true }).last().click()
    await expect(page.getByText(`${name} reactivated`)).toBeVisible()
    await expect(row.getByText('active', { exact: true })).toBeVisible()
  })

  await test.step('archive it — irreversible in this pass, no further actions offered', async () => {
    await row.getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive', exact: true }).last().click()
    await expect(page.getByText(`${name} archived`)).toBeVisible()
    await expect(row.getByText('archived', { exact: true })).toBeVisible()
    await expect(row.getByRole('button')).toHaveCount(0)
  })
})
