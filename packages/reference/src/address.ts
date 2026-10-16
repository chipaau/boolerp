// What an address form asks for, from a country's address levels (C215, C217): pure, so the forms
// stay thin. Levels with places listed are picked, one picker under another down to a place with
// nothing under it; levels with none listed anywhere in the country are typed, and required.
import type { Geography, GeographyType } from './schemas'

/** A country's address level as a form shows it: its types (several may share a level) and whether places of it are listed. */
export type AddressLevel = { level: number; types: GeographyType[]; listed: boolean }

/** A country's address levels, from level 1 down. */
export function addressLevels(types: readonly GeographyType[]): AddressLevel[] {
  const byLevel = new Map<number, GeographyType[]>()
  for (const t of types) byLevel.set(t.level, [...(byLevel.get(t.level) ?? []), t])
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, ts]) => ({ level, types: ts, listed: ts.some((t) => t.placeCount > 0) }))
}

/**
 * The typed levels an address with `picked` (its places from level 1 down) asks for: every level
 * below the deepest place picked that lists no places, each under its first type's code, labelled
 * by its types' names.
 */
export function typedLevels(levels: readonly AddressLevel[], picked: readonly Pick<Geography, 'level'>[]) {
  const deepest = picked.at(-1)?.level ?? 0
  return levels
    .filter((l) => !l.listed && l.level > deepest)
    .map((l) => ({ code: [...l.types].sort((a, b) => a.code.localeCompare(b.code))[0].code, label: l.types.map((t) => t.name).join(' or ') }))
}

/** Whether a picker follows the places picked so far: none picked yet in a country that lists places, or the last one has places under it. */
export function needsAnotherPick(levels: readonly AddressLevel[], picked: readonly Pick<Geography, 'hasChildren'>[]) {
  const last = picked.at(-1)
  return last ? last.hasChildren : levels.some((l) => l.listed)
}

/** A picker's label: the names of the types it offers ("Atoll or City", "Island or Resort island"). */
export const pickerLabel = (places: readonly Pick<Geography, 'typeName'>[], fallback: string) =>
  [...new Set(places.map((p) => p.typeName))].join(' or ') || fallback
