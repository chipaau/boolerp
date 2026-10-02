import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

// Creates the account the suite signs in with: a Kratos identity with a verified email and a
// generated password, through Kratos's admin API (internal network only; run.sh joins it). The
// credentials go to .auth/user.json (gitignored) for the tests, and the identity is deleted after.
const admin = process.env.KRATOS_ADMIN_URL ?? 'http://kratos:4434'

export default async function globalSetup() {
  const email = `e2e-${Date.now()}@example.test`
  const password = `${randomBytes(12).toString('hex')}Aa9!`
  const res = await fetch(`${admin}/admin/identities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schema_id: 'registration',
      traits: { email, phone: '+9607770000', name: 'E2E Tester' },
      credentials: { password: { config: { password } } },
      verifiable_addresses: [{ value: email, verified: true, via: 'email', status: 'completed' }],
    }),
  })
  if (!res.ok) throw new Error(`creating the e2e account failed: ${res.status} ${await res.text()}`)
  const { id } = (await res.json()) as { id: string }
  mkdirSync(new URL('../.auth/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../.auth/user.json', import.meta.url), JSON.stringify({ email, password }))

  return async () => {
    await fetch(`${admin}/admin/identities/${id}`, { method: 'DELETE' })
  }
}
