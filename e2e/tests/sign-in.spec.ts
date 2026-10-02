import { expect, test } from '@playwright/test'
import { ADMIN, IDENTITY, WORKSPACE, openSignedIn, submitLogin, user } from './helpers'

// Sign-in through each app's backend-for-frontend (C90, C96, C97): the browser holds only an
// HttpOnly cookie, and the API is reached through the BFF with the session's token (C98).

test('the workspace sends a signed-out browser to sign in and back', async ({ page }) => {
  await page.goto(`${WORKSPACE}/control-centre/employees`)
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
  await submitLogin(page)
  await expect(page).toHaveURL(`${WORKSPACE}/control-centre/employees`)
  await expect(page.getByRole('heading', { level: 1, name: 'Employees' })).toBeVisible()
})

test('the workspace API answers as the signed-in user, through the BFF', async ({ page }) => {
  await openSignedIn(page, `${WORKSPACE}/`)
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/auth/me')
    return { status: res.status, body: await res.json(), cookie: document.cookie }
  })
  expect(me.status).toBe(200)
  expect(me.body.user.email).toBe(user().email)
  expect(me.body.clientId).toBe('erp-workspace')
  expect(me.cookie, 'the session cookie is HttpOnly').not.toContain('session')
})

test('a signed-out browser gets 401 from the API', async ({ request }) => {
  const res = await request.get(`${WORKSPACE}/api/auth/me`)
  expect(res.status()).toBe(401)
})

test('the admin console signs in through its own BFF', async ({ page }) => {
  await page.goto(`${ADMIN}/`)
  await expect(page).toHaveURL(new RegExp(`^${IDENTITY}/login`))
  await submitLogin(page)
  await expect(page).toHaveURL(`${ADMIN}/`)
  const client = await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).clientId)
  expect(client).toBe('erp-admin')
})
