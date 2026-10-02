import { describe, expect, it } from 'vitest'
import type { AppDef } from '@workspace/app-kit'
import pkg from '../package.json'

// Every edition (editions/<name>.ts, C107) and every app package's manifest (C102).
const editions = import.meta.glob<{ default: readonly string[] }>('../editions/*.ts', { eager: true })
// app-kit is the manifest library, not an app
const manifests = import.meta.glob<{ app: AppDef }>(['../../../packages/app-*/src/index.ts', '!../../../packages/app-kit/src/index.ts'], { eager: true })
const appBySlug = new Map(
  Object.entries(manifests).map(([path, mod]) => [path.match(/packages\/app-([^/]+)\//)![1], mod.app])
)

describe.each(Object.entries(editions))('edition %s', (_, { default: slugs }) => {
  it('lists existing app packages, each once, that the shell depends on', () => {
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(appBySlug.has(slug), `packages/app-${slug}`).toBe(true)
      expect(pkg.dependencies, `@workspace/app-${slug} in apps/app/package.json`).toHaveProperty(`@workspace/app-${slug}`)
    }
  })
})

describe('app packages', () => {
  it('are mounted at their own package name', () => {
    for (const [slug, app] of appBySlug) expect(app.slug).toBe(slug)
  })

  it('declare a permission for every page (fail closed)', () => {
    for (const app of appBySlug.values()) {
      for (const item of app.menu.flatMap((s) => s.items)) {
        expect(item.permission, `${app.slug}/${item.slug}`).toMatch(/^[a-z-]+:[a-z-]+:[a-z]+$/)
      }
    }
  })

  it('belong to the full edition', () => {
    const full = editions['../editions/full.ts'].default
    for (const slug of appBySlug.keys()) expect(full).toContain(slug)
  })
})
