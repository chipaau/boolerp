import { existsSync } from 'node:fs'
import { defineConfig, type Project } from '@playwright/test'

// End-to-end tests against the running Compose stack (docker compose up), through Traefik, by
// run.sh. Tests use explicit URLs: the flows cross the workspace (demo.bool.test), the admin
// console (admin.bool.test), and the login service (identity.bool.test). global-setup creates the
// account the suite signs in with, and deletes it afterwards.
//
// Projects: `platform` (this package's tests: sign-in, the BFF, sign-out) and one per app the
// edition ships that has end-to-end specs (packages/app-<slug>/e2e), from the same edition files
// the workspace build reads (apps/workspace/editions/<name>.ts; EDITION, default full, C107).
const edition = process.env.EDITION || 'full'
const editionFile = new URL(`../apps/workspace/editions/${edition}.ts`, import.meta.url)
if (!/^[a-z][a-z0-9-]*$/.test(edition) || !existsSync(editionFile)) {
  throw new Error(`Unknown edition "${edition}": add apps/workspace/editions/${edition}.ts`)
}
const apps: readonly string[] = (await import(editionFile.href)).default

const appProjects: Project[] = apps
  .map((slug) => ({ name: slug, testDir: `../packages/app-${slug}/e2e` }))
  .filter((p) => existsSync(new URL(p.testDir, import.meta.url)))

export default defineConfig({
  projects: [{ name: 'platform', testDir: './tests' }, ...appProjects],
  globalSetup: './tests/global-setup.ts',
  workers: 1, // one account; sign-out ends its sessions
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  // the Compose stack serves the apps with Vite's dev servers, which compile on first request
  expect: { timeout: 15_000 },
  use: {
    trace: 'retain-on-failure',
  },
})
