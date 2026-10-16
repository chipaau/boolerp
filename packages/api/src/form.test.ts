import { describe, expect, it } from 'vitest'
import { FieldApi, FormApi } from '@tanstack/react-form'
import { ApiError } from './error'
import { applyServerErrors, fieldCandidates, formAt } from './form'

const values = { slug: '', name: '', institutionTypes: [{ code: 'clinic', primary: true }] }

function formWith(...names: string[]) {
  const form = new FormApi({ defaultValues: values })
  form.mount()
  for (const name of names) new FieldApi({ form, name: name as never }).mount()
  return form
}

const invalid = (fieldErrors: Record<string, string[]>) =>
  new ApiError({ kind: 'http', status: 422, title: 'Unprocessable Content', requestId: 'req-1', fieldErrors })

describe('fieldCandidates', () => {
  it('names an error path as TanStack Form names fields, nearest first', () => {
    expect(fieldCandidates('institutionTypes.1.code')).toEqual(['institutionTypes[1].code', 'institutionTypes[1]', 'institutionTypes'])
    expect(fieldCandidates('slug')).toEqual(['slug'])
    expect(fieldCandidates('')).toEqual([])
  })
})

describe('applyServerErrors', () => {
  it('puts each message on its field as the onServer error, touched so it shows', () => {
    const form = formWith('slug', 'name')
    const unmatched = applyServerErrors(form, invalid({ slug: ['is already used by Malé City Council'] }))
    expect(unmatched).toEqual([])
    expect(form.getFieldMeta('slug')?.errorMap.onServer).toBe('is already used by Malé City Council')
    expect(form.getFieldMeta('slug')?.isTouched).toBe(true)
    expect(form.getFieldMeta('name')?.errorMap.onServer).toBeUndefined()
  })

  it('falls back to the nearest field that exists', () => {
    const form = formWith('institutionTypes')
    applyServerErrors(form, invalid({ 'institutionTypes.1.code': ['is not an institution type in use'] }))
    expect(form.getFieldMeta('institutionTypes')?.errorMap.onServer).toBe('is not an institution type in use')
  })

  it('returns what no field can show, for the banner', () => {
    const form = formWith('slug')
    expect(applyServerErrors(form, invalid({ parentId: ['is not a tenant that can be a parent'], '': ['is invalid'] }))).toEqual([
      'parentId: is not a tenant that can be a parent',
      'is invalid',
    ])
  })
})

describe('formAt', () => {
  it("puts a part's errors on its fields under the prefix", () => {
    const form = new FormApi({ defaultValues: { registered: { line1: '', country: '' }, mailing: { line1: '' } } })
    form.mount()
    for (const name of ['registered.line1', 'registered.country', 'mailing.line1']) new FieldApi({ form, name: name as never }).mount()
    const unmatched = applyServerErrors(formAt(form, 'registered'), invalid({ line1: ['is required'], postalCode: ['is too long'] }))
    expect(form.getFieldMeta('registered.line1')?.errorMap.onServer).toBe('is required')
    expect(form.getFieldMeta('mailing.line1')?.errorMap.onServer).toBeUndefined()
    expect(unmatched).toEqual(['postalCode: is too long'])
  })
})
