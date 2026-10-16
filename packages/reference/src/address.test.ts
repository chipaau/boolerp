import { describe, expect, it } from 'vitest'
import { addressLevels, needsAnotherPick, pickerLabel, typedLevels } from './address'

const type = (country: string, code: string, name: string, level: number, placeCount: number) => ({
  id: `0192f6a0-0000-7000-8000-${String(level * 10 + code.length).padStart(12, '0')}`, country, code, name, level, placeCount,
})

// The Maldives: atoll and city at 1, island and resort island at 2, all listed; India: state
// listed, district and city typed.
const mv = addressLevels([
  type('MV', 'island', 'Island', 2, 190), type('MV', 'atoll', 'Atoll', 1, 19), type('MV', 'city', 'City', 1, 5),
  type('MV', 'resort_island', 'Resort island', 2, 189),
])
const india = addressLevels([type('IN', 'state', 'State', 1, 28), type('IN', 'district', 'District', 2, 0), type('IN', 'city', 'City', 3, 0)])

describe('an address form’s levels (C215, C217)', () => {
  it('groups a country’s types by level, from level 1 down, each listed or typed', () => {
    expect(mv.map((l) => [l.level, l.types.map((t) => t.code), l.listed])).toEqual([
      [1, ['atoll', 'city'], true],
      [2, ['island', 'resort_island'], true],
    ])
    expect(india.map((l) => l.listed)).toEqual([true, false, false])
  })

  it('asks for another pick while the last place has places under it', () => {
    expect(needsAnotherPick(mv, []), 'a country that lists places').toBe(true)
    expect(needsAnotherPick(mv, [{ hasChildren: true }])).toBe(true)
    expect(needsAnotherPick(mv, [{ hasChildren: true }, { hasChildren: false }])).toBe(false)
    expect(needsAnotherPick(addressLevels([]), []), 'a country with no levels').toBe(false)
  })

  it('types the levels below the deepest place picked that list none, each under its first type', () => {
    expect(typedLevels(india, [{ level: 1 }])).toEqual([
      { code: 'district', label: 'District' },
      { code: 'city', label: 'City' },
    ])
    expect(typedLevels(mv, [{ level: 1 }, { level: 2 }]), 'every Maldives level is listed').toEqual([])
  })

  it('labels a picker by the types it offers', () => {
    expect(pickerLabel([{ typeName: 'Atoll' }, { typeName: 'City' }, { typeName: 'Atoll' }], 'Place')).toBe('Atoll or City')
    expect(pickerLabel([], 'Place')).toBe('Place')
  })
})
