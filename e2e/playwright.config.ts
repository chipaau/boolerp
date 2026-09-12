import { defineConfig } from '@playwright/test'

// Runs against the real compose stack (docker compose up), not an ephemeral instance — there's no
// self-contained way to spin up Traefik + *.bool.test DNS per test run the way the Go suite spins
// up its own Postgres via Testcontainers. Tests navigate to explicit http://*.bool.test URLs
// rather than a single baseURL, since the golden path crosses both admin.bool.test (operator) and
// a tenant subdomain (the tenant's own login).
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // the tenant-provisioning test is stateful; keep this suite sequential
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
})
