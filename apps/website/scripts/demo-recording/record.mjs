// Records the website hero's product demo: a scripted walk through the running workspace
// (male-city), captured frame by frame from the browser and written as JPEG frames plus their
// timings, which run.sh encodes. Scripted rather than screen-recorded so it is calm, repeatable
// and can be re-recorded whenever the interface changes: a smooth cursor, a beat after every
// action, the same take every time.
//
// Chapters are marked as the script reaches them; their start times go to chapters.json, which the
// hero's captions follow (features/hero/demo.ts).
import { chromium } from '@playwright/test'
import { mkdir, rm, writeFile } from 'node:fs/promises'

const BASE = process.env.DEMO_BASE ?? 'http://male-city.bool.test'
const IDENTITY = process.env.DEMO_IDENTITY ?? 'http://identity.bool.test'
// A development account (seeded by `docker compose run --rm seed`, with the team's public
// development password). Never a production account.
const EMAIL = process.env.DEMO_EMAIL ?? 'mariyam@bool.mv'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'password'
const OUT = process.env.DEMO_OUT ?? '/out'

// 16:10, the hero tablet's screen; 1536×960 CSS pixels captured at 2× (3072×1920) and encoded at
// 2560×1600, so the interface stays crisp when the tablet nearly fills a high-density screen.
const VIEW = { width: 1536, height: 960 }
const SCALE = 2

/** The visible cursor and click ripple (a headless browser draws none), and no development overlays. */
const STAGE = `
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = \`
      button[aria-label="Open TanStack Devtools"], [data-nextjs-toast], nextjs-portal { display: none !important; }
      #demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 22px; height: 22px;
        transform: translate(-100px, -100px); transition: transform 0s; filter: drop-shadow(0 2px 3px rgb(0 0 0 / .25)); }
      #demo-cursor.press svg { transform: scale(.88); }
      #demo-cursor svg { transition: transform .12s ease; transform-origin: 3px 3px; }
      .demo-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 50%; background: rgb(240 130 40 / .28); animation: demo-ripple .5s ease-out forwards; }
      @keyframes demo-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }\`
    document.head.append(style)
    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2.5v15.2l4.2-3.9 2.7 6.1 2.6-1.1-2.7-6h5.9z" fill="#1f1d1a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.append(cursor)
    addEventListener('mousemove', (e) => { cursor.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', (e) => {
      cursor.classList.add('press')
      const r = document.createElement('div'); r.className = 'demo-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
      document.body.append(r); setTimeout(() => r.remove(), 600)
    }, true)
    addEventListener('mouseup', () => cursor.classList.remove('press'), true)
  })
`

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, reducedMotion: 'no-preference' })
const page = await context.newPage()

// Sign in and open every page the demo visits once, so nothing compiles or loads during the take.
// The app loads signed out first, then goes through its BFF and the login service: wait until the
// login page shows (then sign in) or the BFF answers for a session (as e2e/tests/helpers.ts does).
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
for (const path of ['/inventory', '/calendar', '/control-centre', '/']) {
  await page.goto(BASE + path)
  await page.waitForLoadState('networkidle').catch(() => {})
}
await context.addInitScript(STAGE)
await page.goto(`${BASE}/`)
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(1500)
if (process.env.DEMO_DEBUG) await page.screenshot({ path: '/rec/debug.png' })

// ── capture ──────────────────────────────────────────────────────────────────────────────────
const frames = `${OUT}/frames`
await rm(frames, { recursive: true, force: true })
await mkdir(frames, { recursive: true })
const cdp = await context.newCDPSession(page)
const shots = []
let start = 0
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const name = `${String(shots.length).padStart(5, '0')}.jpg`
  shots.push({ name, t: metadata.timestamp })
  await writeFile(`${frames}/${name}`, Buffer.from(data, 'base64'))
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

// ── the take ─────────────────────────────────────────────────────────────────────────────────
let mouse = { x: VIEW.width * 0.62, y: VIEW.height * 0.55 }
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
const pause = (ms) => page.waitForTimeout(ms)

/** Moves the cursor to a point (or the middle of an element) in a smooth, eased arc. */
async function glide(target, ms = 700) {
  const box = typeof target.boundingBox === 'function' ? await target.boundingBox() : null
  const to = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : target
  const from = { ...mouse }
  const lift = Math.min(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.08)
  const steps = Math.max(8, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps)
    await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * lift)
    await pause(16)
  }
  mouse = to
}
async function click(target, ms) {
  await glide(target, ms)
  await pause(140)
  await page.mouse.down()
  await pause(90)
  await page.mouse.up()
}
async function type(text) {
  for (const ch of text) {
    await page.keyboard.type(ch)
    await pause(55 + Math.random() * 45)
  }
}

const chapters = []
const chapter = (id) => chapters.push({ id, at: Date.now() })

// The camera: where the hero's tablet should gently zoom while this plays, and the part of the
// screen its spotlight picks out (features/hero/story.ts). Each shot is the element's box (fractions
// of the screen) and a scale; null is the whole screen, no spotlight.
const shots_ = []
async function camera(target, scale = 1.18) {
  if (!target) return void shots_.push({ at: Date.now(), x: 0.5, y: 0.5, scale: 1, box: null })
  const b = await target.boundingBox()
  if (!b) return
  const box = [b.x / VIEW.width, b.y / VIEW.height, b.width / VIEW.width, b.height / VIEW.height]
  shots_.push({ at: Date.now(), x: box[0] + box[2] / 2, y: box[1] + box[3] / 2, scale, box })
}

// Opening an app from the search reloads the page; the blank moment while it loads is cut from the
// recording, so it goes straight from the search to the app (the cut's frames are dropped).
const cuts = []
async function cutTo(go, ready) {
  const from = Date.now()
  await go()
  await ready.waitFor()
  await page.waitForLoadState('networkidle').catch(() => {})
  await pause(300)
  await page.mouse.move(mouse.x, mouse.y) // the reloaded page draws its cursor where the pointer is
  await pause(80)
  cuts.push({ from, to: Date.now() })
}

await page.mouse.move(mouse.x, mouse.y)
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE, everyNthFrame: 1 })
start = Date.now()

// 1 · Home: the day at a glance, and what needs you
chapter('home')
await camera(null)
await pause(900)
// today's hexagon in the month's honeycomb, which opens the day's card
const todayLabel = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { dateStyle: 'full' }))
const todayHex = page.locator(`[aria-label="${todayLabel}"]`)
await glide(todayHex.first(), 900)
await pause(700)
await camera(page.getByText('Smart Inbox', { exact: true }).locator('xpath=ancestor::section[1]'), 1.22)
await glide(page.getByText('Printer toner is below reorder level'), 800)
await pause(900)
await glide(page.getByText('Goods request awaiting approval'), 500)
await pause(700)

// 2 · Inventory: stock that flags itself (each chapter starts as its app opens)
await camera(null)
await glide(page.locator('a[href="/inventory"]').last(), 900)
chapter('inventory')
await click(page.locator('a[href="/inventory"]').last(), 120)
await page.getByText('Inventory overview').waitFor()
await pause(900)
const chart = page.getByText('Stock in vs out').locator('xpath=ancestor::*[contains(@class,"rounded")][1]')
const chartBox = await chart.boundingBox()
if (chartBox) {
  await camera(chart, 1.25)
  await glide({ x: chartBox.x + chartBox.width * 0.3, y: chartBox.y + chartBox.height * 0.62 }, 700)
  await glide({ x: chartBox.x + chartBox.width * 0.78, y: chartBox.y + chartBox.height * 0.6 }, 1400)
}
await pause(500)
await camera(null)
await click(page.getByRole('link', { name: 'Low stock' }).first(), 800)
await pause(1500)

// 3 · Calendar: a meeting in a few keystrokes
await page.keyboard.press('ControlOrMeta+k')
await pause(500)
await type('Calendar')
await pause(500)
await cutTo(() => page.keyboard.press('Enter'), page.locator('button[data-slot=button]', { hasText: 'New meeting' }))
chapter('calendar')
await pause(900)
await click(page.locator('button[data-slot=button]', { hasText: 'New meeting' }), 900)
const purpose = page.getByPlaceholder('What is this meeting for?')
await purpose.waitFor()
await camera(page.getByRole('dialog').first(), 1.28)
await pause(500)
await purpose.click()
await page.keyboard.press('ControlOrMeta+a')
await type('Stock review, Hithadhoo')
await pause(700)
await click(page.getByRole('button', { name: 'Send invites' }), 900)
await camera(null)
await pause(1500)

// 4 · Control Centre: set up once, used everywhere
await page.keyboard.press('ControlOrMeta+k')
await pause(500)
await type('Control')
await pause(500)
await cutTo(() => page.keyboard.press('Enter'), page.getByText('Needs attention', { exact: false }).first())
chapter('control-centre')
await camera(null)
await pause(700)
await camera(page.getByText('Paused sites').locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), 1.22)
await pause(300)
await glide(page.getByText('Paused sites'), 800)
await pause(600)
await glide(page.getByText('Exited people still holding access'), 700)
await pause(800)
await camera(null)
await click(page.getByRole('link', { name: 'Employees' }).first(), 900)
await page.getByRole('heading', { name: 'Employees' }).first().waitFor().catch(() => {})
await page.waitForLoadState('networkidle').catch(() => {})
await pause(2500)

await cdp.send('Page.stopScreencast')
await pause(300)
await browser.close()

// ── timings ──────────────────────────────────────────────────────────────────────────────────
// Frames arrive only when the page repaints, so each is held until the next one; the concat list
// gives each its duration and run.sh resamples to a steady frame rate. Frames inside a cut are
// dropped and everything after it moves earlier by the cut's length.
const cutBefore = (ms) => cuts.reduce((sum, c) => sum + Math.max(0, Math.min(ms, c.to) - c.from), 0)
const inCut = (ms) => cuts.some((c) => ms > c.from && ms < c.to)
const kept = shots.filter((s) => !inCut(s.t * 1000)).map((s) => ({ ...s, at: s.t * 1000 - cutBefore(s.t * 1000) }))
const t0 = kept[0].at
const lines = ['ffconcat version 1.0']
kept.forEach((s, i) => {
  const next = i + 1 < kept.length ? kept[i + 1].at : s.at + 500
  lines.push(`file 'frames/${s.name}'`, `duration ${((next - s.at) / 1000).toFixed(4)}`)
})
lines.push(`file 'frames/${kept[kept.length - 1].name}'`)
await writeFile(`${OUT}/frames.ffconcat`, lines.join('\n') + '\n')
// chapter times on the recording's clock (its first frame is 0)
const marks = chapters.map((c) => ({ id: c.id, start: Math.max(0, +((c.at - cutBefore(c.at) - t0) / 1000).toFixed(2)) }))
// the encoded length: the last frame is held for half a second
const duration = +((kept[kept.length - 1].at - t0 + 500) / 1000).toFixed(2)
const camera_ = shots_.map((c) => ({
  t: Math.max(0, +((c.at - cutBefore(c.at) - t0) / 1000).toFixed(2)),
  x: +c.x.toFixed(4),
  y: +c.y.toFixed(4),
  scale: c.scale,
  box: c.box && c.box.map((v) => +v.toFixed(4)),
}))
await writeFile(`${OUT}/chapters.json`, JSON.stringify({ duration, chapters: marks, camera: camera_ }, null, 2) + '\n')
console.log(`captured ${shots.length} frames, kept ${kept.length}; chapters`, marks)
