import { expect, test } from '@playwright/test'
import { ADMIN, openSignedIn } from './helpers'

// F2g: the admin console's tenants list (C174, C179), end to end against the sample tenants seeded
// in development (apps/api/internal/platform/tenancy/seeds/sample_tenants.csv). The e2e account is a
// member of the operator tenant with Viewer (C177), which is the standing this surface requires.
//
// The assertions name seeded tenants rather than counts wherever a count would break the moment
// someone adds a sample. The few that do use a count read it from the page's own summary line.

const list = (page: import('@playwright/test').Page) => page.getByRole('table')
const rowNames = async (page: import('@playwright/test').Page) =>
  (await list(page).getByRole('row').allInnerTexts()).slice(1) // drop the header row

test('an operator reaches the tenants list from the console', async ({ page }) => {
  await openSignedIn(page, `${ADMIN}/`)
  await page.getByRole('link', { name: 'Tenants' }).click()
  await expect(page).toHaveURL(/\/tenants\?/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tenants' })).toBeVisible()
  // A seeded tenant and the operator tenant itself.
  await expect(page.getByText('Malé City Council')).toBeVisible()
  await expect(page.getByText('MOH · moh')).toBeVisible()
})

test('searching asks the API and puts the term in the URL', async ({ page }) => {
  await openSignedIn(page, `${ADMIN}/`)
  await page.getByRole('link', { name: 'Tenants' }).click()

  await page.getByPlaceholder('Filter by name, code, or slug').fill('council')
  await expect(page).toHaveURL(/[?&]q=council/)

  // The three councils, and nothing else: q matches the name, code or slug. Asserted on each row's
  // "CODE · slug" line rather than the name, because a name is not unique on this page — the Parent
  // column names parents too (C188), so "Haa Alif Atoll Council" appears both as its own row and as
  // Dhidhdhoo Council's parent.
  await expect(page.getByText('3 tenants match')).toBeVisible()
  for (const row of ['MCC · male-city', 'HAC · haa-alif-council', 'DDC · dhidhdhoo-council']) {
    await expect(page.getByText(row, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('MOH · moh', { exact: true })).toBeHidden()
})

test('a status filter narrows the list, and combines with the search', async ({ page }) => {
  await openSignedIn(page, `${ADMIN}/tenants?page=1&pageSize=25`)

  // New Island Clinic is the one sample seeded without a legal form or types, so it is still
  // provisioning; every other sample is active.
  await page.getByRole('button', { name: 'Provisioning', exact: true }).click()
  await expect(page).toHaveURL(/[?&]status=provisioning/)
  await expect(page.getByText('New Island Clinic', { exact: true })).toBeVisible()
  await expect(page.getByText('Malé City Council', { exact: true })).toBeHidden()

  // A filter that can match nothing says so, rather than looking like an empty directory.
  await page.getByPlaceholder('Filter by name, code, or slug').fill('council')
  await expect(page.getByText('No tenants match these filters')).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(page.getByText('Malé City Council', { exact: true })).toBeVisible()
})

test('sorting is done by the API, both ways', async ({ page }) => {
  await openSignedIn(page, `${ADMIN}/tenants?page=1&pageSize=25`)
  const code = page.getByRole('columnheader', { name: 'Code' })

  await code.click()
  await expect(page).toHaveURL(/[?&]sort=code(&|$)/)
  // BFIS is the lowest code among the samples, BOOL (the operator tenant) the next.
  expect((await rowNames(page))[0]).toContain('Bright Future International School')

  await code.click()
  await expect(page).toHaveURL(/[?&]sort=-code/)
  // SRS, the highest.
  expect((await rowNames(page))[0]).toContain('Sunrise School')
})

test('paging asks the API for the next page', async ({ page }) => {
  await openSignedIn(page, `${ADMIN}/tenants?page=1&pageSize=25`)

  // Ten rows a page, so the seeded tenants need two.
  await page.getByRole('combobox', { name: 'Rows to show' }).click()
  await page.getByRole('option', { name: '10', exact: true }).click()
  await expect(page).toHaveURL(/[?&]pageSize=10/)
  const first = await rowNames(page)
  expect(first).toHaveLength(10)

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  const second = await rowNames(page)
  expect(second.length).toBeGreaterThan(0)
  expect(second[0]).not.toEqual(first[0])
})
