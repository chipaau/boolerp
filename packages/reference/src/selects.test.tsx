import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CountrySelect } from './country-select'
import { InstitutionTypesField } from './institution-types-field'
import type { InstitutionTypesValue } from './institution-types-field'
import { LegalFormSelect } from './legal-form-select'
import { TimezoneSelect } from './timezone-select'

const page = (items: unknown[]) => ({ items, page: 1, pageSize: items.length || 1, total: items.length })

const RESPONSES: Record<string, unknown> = {
  '/api/v1/countries?pageSize=300': page([
    { code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960', geographyCount: 407 },
    { code: 'LK', alpha3: 'LKA', name: 'Sri Lanka', phonePrefix: '+94', geographyCount: 34 },
  ]),
  '/api/v1/legal-forms?country=MV&pageSize=100': page([
    { id: '0192f6a0-0000-7000-8000-000000000001', code: 'private_company', name: 'Private company', category: 'private', identityDocument: 'Company registration number' },
    { id: '0192f6a0-0000-7000-8000-000000000002', code: 'ministry', name: 'Ministry', category: 'government', identityDocument: null },
  ]),
  '/api/v1/institution-types?pageSize=100': page([
    { code: 'clinic', name: 'Clinic', sector: { code: 'health', name: 'Health' } },
    { code: 'hospital', name: 'Hospital', sector: { code: 'health', name: 'Health' } },
    { code: 'school', name: 'School', sector: { code: 'education', name: 'Education' } },
  ]),
}

const fetchMock = vi.fn(async (url: string) =>
  url in RESPONSES
    ? new Response(JSON.stringify(RESPONSES[url]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    : new Response('{}', { status: 404, headers: { 'Content-Type': 'application/problem+json' } })
)

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => (vi.unstubAllGlobals(), fetchMock.mockClear()))

function withQueries(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CountrySelect', () => {
  it('loads the countries and finds one by its alpha-3 code', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    withQueries(<CountrySelect aria-label="Country" value={null} onValueChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Country' })
    expect(input).toHaveAttribute('placeholder', 'Loading countries…')

    await vi.waitFor(() => expect(input).toHaveAttribute('placeholder', 'Search countries'))
    await user.type(input, 'lka')
    await user.click(await screen.findByRole('option', { name: /Sri Lanka/ }))
    expect(onChange).toHaveBeenCalledWith('LK')
  })
})

describe('LegalFormSelect', () => {
  it('waits for a country, then offers its forms and returns the chosen one with its document', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = withQueries(<LegalFormSelect aria-label="Legal form" country={null} value={null} onValueChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Legal form' })
    expect(input).toHaveAttribute('placeholder', 'Pick the country first')
    expect(input).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <LegalFormSelect aria-label="Legal form" country="MV" value={null} onValueChange={onChange} />
      </QueryClientProvider>
    )
    const loaded = screen.getByRole('combobox', { name: 'Legal form' })
    await vi.waitFor(() => expect(loaded).toBeEnabled())
    await user.type(loaded, 'private')
    await user.click(await screen.findByRole('option', { name: /Private company/ }))
    expect(onChange).toHaveBeenCalledWith('0192f6a0-0000-7000-8000-000000000001', expect.objectContaining({ identityDocument: 'Company registration number' }))
  })
})

function Types({ onChange }: { onChange: (v: InstitutionTypesValue) => void }) {
  const [value, setValue] = useState<InstitutionTypesValue>({ codes: [], primary: null })
  return <InstitutionTypesField aria-label="Institution types" value={value} onValueChange={(v) => (setValue(v), onChange(v))} />
}

describe('InstitutionTypesField', () => {
  it('makes the first type primary, asks which is primary once there are two, and keeps the choice', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    withQueries(<Types onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Institution types' })
    await vi.waitFor(() => expect(input).toBeEnabled())

    await user.type(input, 'clinic')
    await user.click(await screen.findByRole('option', { name: 'Clinic' }))
    expect(onChange).toHaveBeenLastCalledWith({ codes: ['clinic'], primary: 'clinic' })
    expect(screen.queryByRole('radiogroup', { name: 'Primary institution type' })).not.toBeInTheDocument()

    await user.type(input, 'hosp')
    await user.click(await screen.findByRole('option', { name: 'Hospital' }))
    expect(onChange).toHaveBeenLastCalledWith({ codes: ['clinic', 'hospital'], primary: 'clinic' })

    await user.click(screen.getByRole('radio', { name: 'Hospital' }))
    expect(onChange).toHaveBeenLastCalledWith({ codes: ['clinic', 'hospital'], primary: 'hospital' })
    expect(screen.getByRole('radio', { name: 'Hospital' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('TimezoneSelect', () => {
  it('finds a zone by its city', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    withQueries(<TimezoneSelect aria-label="Time zone" value={null} onValueChange={onChange} />)
    await user.type(screen.getByRole('combobox', { name: 'Time zone' }), 'maldives')
    await user.click(await screen.findByRole('option', { name: /Indian \/ Maldives/ }))
    expect(onChange).toHaveBeenCalledWith('Indian/Maldives')
  })
})
