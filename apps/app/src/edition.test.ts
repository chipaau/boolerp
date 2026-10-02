import { describe, expect, it } from 'vitest'
import { appPackages } from '../edition'
import { APPS } from './lib/apps'
import { app as controlCentre } from '@workspace/app-control-centre'

// The app packages this edition ships, by slug, and their manifests (C102).
const packaged = [controlCentre]

describe('edition', () => {
  it('mounts the routes of exactly the app packages it lists', () => {
    expect(packaged.map((a) => a.slug).sort()).toEqual([...appPackages].sort())
  })

  it('shows every app package in the workspace', () => {
    for (const app of packaged) expect(APPS).toContain(app)
  })

  it('has no two apps on one path', () => {
    const slugs = APPS.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('declares a permission for every page of an app package (fail closed)', () => {
    for (const app of packaged) {
      for (const item of app.menu.flatMap((s) => s.items)) {
        expect(item.permission, `${app.slug}/${item.slug}`).toMatch(/^[a-z-]+:[a-z-]+:[a-z]+$/)
      }
    }
  })
})
