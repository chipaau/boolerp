// Captures still screens of the running workspace (male-city) for the website's app grid
// (features/apps): one PNG per real screen, at the same size, clock and time zone as the hero's demo
// recording (record.mjs), so they match it and the hero's dashboard. run.sh `screens` converts them.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.DEMO_BASE ?? 'http://male-city.bool.test'
const IDENTITY = process.env.DEMO_IDENTITY ?? 'http://identity.bool.test'
// a development account (seeded), never a production one; see record.mjs
const EMAIL = process.env.DEMO_EMAIL ?? 'mariyam@bool.mv'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'password'
const OUT = process.env.DEMO_OUT ?? '/out'
const TIME = process.env.DEMO_TIME ?? '2026-07-23T09:12:00+05:00'
const ZONE = process.env.DEMO_ZONE ?? 'Indian/Maldives'

/** The screens that exist today (apps/workspace/src/features/screens.ts and the shell's home and Control Centre). */
const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'inventory', path: '/inventory' },
  { name: 'calendar', path: '/calendar' },
  { name: 'directory', path: '/directory' },
  { name: 'control-centre', path: '/control-centre' },
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 2, timezoneId: ZONE })
const page = await context.newPage()

// sign in (as record.mjs does): the app loads signed out, then goes through its BFF and the login service
await page.goto(`${BASE}/`)
const onLogin = () => page.url().startsWith(`${IDENTITY}/login`)
for (let tries = 0; tries < 60 && !onLogin(); tries++) {
  if ((await page.request.get(`${BASE}/api/auth/me`)).status() === 200) break
  await page.waitForTimeout(500)
}
if (onLogin()) {
  const password = page.locator('input[name="password"]')
  await password.waitFor()
  const identifier = page.locator('input[name="identifier"]')
  if (await identifier.isVisible()) await identifier.fill(EMAIL)
  await password.fill(PASSWORD)
  await password.press('Enter')
  await page.waitForURL((u) => u.href.startsWith(BASE), { timeout: 30_000 })
}

// no development overlays, no pointer
await context.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = 'button[aria-label="Open TanStack Devtools"], [data-nextjs-toast], nextjs-portal { display: none !important; }'
    document.head.append(style)
  })
})
await context.clock.setFixedTime(new Date(TIME))
await mkdir(OUT, { recursive: true })
for (const { name, path } of SCREENS) {
  await page.goto(BASE + path)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500) // fonts, images and entrance animations settle
  await page.mouse.move(-10, -10)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('captured', name)
}
await browser.close()
