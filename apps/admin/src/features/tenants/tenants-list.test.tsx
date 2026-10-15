import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The tenants list (F2e) on the real route tree against a faked API (MSW, C175).

const tenant = (n: number, over: Record<string, unknown> = {}) => ({
  id: `0192f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  slug: `tenant-${n}`,
  code: `T${n}`,
  name: `Tenant ${n}`,
  status: 'active',
  country: 'MV',
  parentId: null,
  parentName: null,
  workspaceHost: `tenant-${n}.bool.test`,
  createdAt: '2026-10-01T09:00:00Z',
  ...over,
})

/** Answers the list from `items`, keeping every request's query. */
function listApi(items: unknown[], total = items.length) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/tenants', ({ request }) => {
      const q = new URL(request.url).searchParams
      seen.push(q)
      return HttpResponse.json({ items, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total })
    })
  )
  return seen
}

/** Answers the reference lists the create form picks from (C199). */
function referenceApi() {
  const page = (items: unknown[]) => HttpResponse.json({ items, page: 1, pageSize: 100, total: items.length })
  server.use(
    http.get('/api/v1/countries', () => page([{ code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960' }])),
    http.get('/api/v1/legal-forms', ({ request }) =>
      page(
        new URL(request.url).searchParams.get('country') === 'MV'
          ? [
              { id: '0192f6a0-0000-7000-8000-0000000000f1', code: 'ministry', name: 'Government ministry', category: 'government', identityDocument: null },
              { id: '0192f6a0-0000-7000-8000-0000000000f2', code: 'private_company', name: 'Private company', category: 'private', identityDocument: 'Company registration number' },
            ]
          : []
      )
    ),
    http.get('/api/v1/institution-types', () =>
      page([
        { code: 'ministry', name: 'Ministry', sector: { code: 'government', name: 'Government' } },
        { code: 'hospital', name: 'Hospital', sector: { code: 'health', name: 'Health' } },
      ])
    )
  )
}

/** Chooses `option` in the searchable picker labelled `label`, typing `query` to find it. */
async function pick(form: HTMLElement, label: string, query: string, option: RegExp | string) {
  const input = within(form).getByLabelText(label)
  await waitFor(() => expect(input).toBeEnabled())
  await userEvent.type(input, query)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

const search = () => screen.getByLabelText('Filter by name, code, or slug')

describe('the tenants list', () => {
  it('shows the API tenants, with the lifecycle actions disabled', async () => {
    listApi([tenant(1), tenant(2, { status: 'suspended', parentId: tenant(1).id, parentName: 'Tenant 1', workspaceHost: null })])
    renderRoute('/tenants')

    expect(await screen.findByText('T1 · tenant-1')).toBeInTheDocument()
    expect(screen.getByText('tenant-1.bool.test')).toBeInTheDocument()
    const row2 = screen.getByText('T2 · tenant-2').closest('tr') as HTMLElement
    expect(within(row2).getByText('suspended')).toBeInTheDocument()
    expect(within(row2).getByText('Tenant 1')).toBeInTheDocument() // its parent, named by the API (C188)
    expect(within(row2).getByRole('button', { name: 'Reactivate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'New tenant' })).toBeEnabled()
    expect(screen.getByText('2 of 2 tenants')).toBeInTheDocument()
  })

  it('reads its state from the URL and sends it as the API parameters', async () => {
    const seen = listApi([tenant(1)])
    renderRoute('/tenants?page=2&pageSize=50&q=cyryx&status=suspended&sort=-createdAt')
    await screen.findByText('T1 · tenant-1')
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ page: '2', pageSize: '50', q: 'cyryx', status: 'suspended', sort: '-createdAt' })
    expect(search()).toHaveValue('cyryx')
    expect(screen.getByRole('button', { name: 'Suspended' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to defaults for values the URL cannot hold', async () => {
    const seen = listApi([tenant(1)])
    renderRoute('/tenants?page=0&pageSize=500&status=pending&sort=slug')
    await screen.findByText('T1 · tenant-1')
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ page: '1', pageSize: '25' })
  })

  it('searches, filters, and sorts on the API, going back to page 1', async () => {
    const seen = listApi([tenant(1)], 60)
    const { router } = renderRoute('/tenants?page=2')
    await screen.findByText('T1 · tenant-1')

    await userEvent.type(search(), 'cy')
    await waitFor(() => expect(seen.at(-1)!.get('q')).toBe('cy'))
    expect(seen.at(-1)!.get('page')).toBe('1')
    expect(router.state.location.search).toMatchObject({ q: 'cy', page: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Archived' }))
    await waitFor(() => expect(seen.at(-1)!.get('status')).toBe('archived'))

    await userEvent.click(screen.getByText('Tenant', { selector: 'th' }))
    await waitFor(() => expect(seen.at(-1)!.get('sort')).toBe('name'))
    await userEvent.click(screen.getByText('Tenant', { selector: 'th' }))
    await waitFor(() => expect(seen.at(-1)!.get('sort')).toBe('-name'))

    await userEvent.click(screen.getAllByText('Clear filters', { selector: 'button' })[0])
    await waitFor(() => expect(seen.at(-1)!.has('q')).toBe(false))
    expect(seen.at(-1)!.has('status')).toBe(false)
  })

  it('pages through the API', async () => {
    const seen = listApi([tenant(1)], 60)
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText('3'))
    await waitFor(() => expect(seen.at(-1)!.get('page')).toBe('3'))
  })

  it('tells an empty registry from no matches', async () => {
    listApi([])
    renderRoute('/tenants')
    expect(await screen.findByText('No tenants yet')).toBeInTheDocument()
  })

  it('shows no match with a way to clear the filters', async () => {
    listApi([])
    renderRoute('/tenants?status=archived')
    expect(await screen.findByText('No tenants match these filters')).toBeInTheDocument()
  })

  it('shows a 403 as a forbidden state', async () => {
    server.use(http.get('/api/v1/tenants', () => HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403 })))
    renderRoute('/tenants')
    expect(await screen.findByText("You don't have access to this")).toBeInTheDocument()
  })

  it('shows a failure with the request reference and retries', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/tenants', () => {
        calls++
        return HttpResponse.json({ title: 'Service Unavailable', status: 503, detail: 'The service is unavailable right now.' }, { status: 503, headers: { 'X-Request-Id': 'req-503' } })
      })
    )
    renderRoute('/tenants')
    expect(await screen.findByText('Reference: req-503')).toBeInTheDocument()
    const before = calls
    await userEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })

  it('creates a tenant through the API from step 1 of the form', async () => {
    const seen = listApi([tenant(1)])
    referenceApi()
    let body: unknown
    server.use(
      http.post('/api/v1/tenants', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(tenant(2, { name: 'Test Clinic', slug: 'test-clinic', code: 'TCLN', status: 'provisioning', workspaceHost: null }), {
          status: 201,
          headers: { Location: '/api/v1/tenants/0192f6a0-0000-7000-8000-000000000002' },
        })
      })
    )
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')

    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }))
    const form = await screen.findByRole('dialog')
    expect(within(form).getByText('Who they are')).toBeInTheDocument()
    await userEvent.type(within(form).getByLabelText('Name'), 'Test Clinic')
    expect(within(form).getByLabelText('Slug')).toHaveValue('test-clinic')
    await userEvent.type(within(form).getByLabelText('Code'), 'TCLN')
    expect(within(form).queryByRole('button', { name: 'Create tenant' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Save as draft' })).not.toBeInTheDocument()
    // Required fields are marked (*), optional ones are not (C202).
    for (const label of ['Name', 'Slug', 'Code', 'Country', 'Legal form', 'Time zone', 'Institution types'])
      expect(within(form).getByText(label, { selector: 'label' })).toHaveAttribute('data-required', 'true')
    for (const label of ['Registered on', 'Tax number', 'E-mail address', 'Phone'])
      expect(within(form).getByText(label, { selector: 'label' })).not.toHaveAttribute('data-required')

    // Step 1 is the creating request (C197): its lists come from the API through the pickers (C199).
    expect(within(form).getByLabelText('Legal form')).toHaveAttribute('placeholder', 'Pick the country first')
    await pick(form, 'Country', 'mdv', /Maldives/)
    await pick(form, 'Legal form', 'private', /Private company/)
    await userEvent.type(within(form).getByLabelText('Company registration number'), 'C-0001/2026')
    await pick(form, 'Time zone', 'maldives', /Indian \/ Maldives/)
    await pick(form, 'Institution types', 'hosp', 'Hospital')
    // A parent is an API tenant: found by its code, shown by its name.
    await userEvent.click(within(form).getByRole('radio', { name: /Child of another tenant/ }))
    await pick(form, 'Parent tenant', 't1', /Tenant 1/)
    expect(within(form).getByLabelText('Parent tenant')).toHaveValue('Tenant 1')
    await userEvent.type(within(form).getByLabelText('Phone'), '+960 332 4568')

    const lists = seen.length
    await userEvent.click(within(form).getByRole('button', { name: 'Create tenant' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({
      name: 'Test Clinic', slug: 'test-clinic', code: 'TCLN', country: 'MV',
      legalFormId: '0192f6a0-0000-7000-8000-0000000000f2', timezone: 'Indian/Maldives',
      institutionTypes: [{ code: 'hospital', primary: true }], parentId: tenant(1).id,
      identityNumber: 'C-0001/2026', phone: '+9603324568',
    })
    expect(await screen.findByText('Test Clinic created')).toBeInTheDocument()
    await waitFor(() => expect(seen.length).toBeGreaterThan(lists), { timeout: 3000 })
  })

  it('shows the API’s refusal on its fields with a toast, and what no field can show in a banner', async () => {
    listApi([tenant(1)])
    referenceApi()
    server.use(
      http.post('/api/v1/tenants', () =>
        HttpResponse.json(
          {
            type: 'https://bool.mv/problems/validation-error', title: 'Unprocessable Content', status: 422,
            detail: 'The request has 2 invalid fields.',
            instance: 'urn:uuid:0192f6a0-0000-7000-8000-0000000000aa',
            errors: [
              { pointer: '#/slug', code: 'unique', detail: 'is already used by Tenant 1' },
              { pointer: '#/registrationAuthority', code: 'unknown', detail: 'is not taken here' },
            ],
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    )
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')
    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }))
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Name'), 'Tenant One')
    await userEvent.type(within(form).getByLabelText('Code'), 'TONE')
    await pick(form, 'Country', 'mdv', /Maldives/)
    await pick(form, 'Legal form', 'ministry', /Government ministry/)
    await pick(form, 'Time zone', 'maldives', /Indian \/ Maldives/)
    await pick(form, 'Institution types', 'minis', 'Ministry')

    await userEvent.click(within(form).getByRole('button', { name: 'Create tenant' }))
    expect(await within(form).findByText('is already used by Tenant 1')).toBeInTheDocument()
    expect(within(form).getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true')
    const banner = within(form).getByText('It could not be saved').closest('[role="alert"]') as HTMLElement
    expect(banner).toHaveTextContent('registrationAuthority: is not taken here')
    expect(banner).toHaveTextContent('Reference 0192f6a0-0000-7000-8000-0000000000aa')
    expect(await screen.findByText(/^The request has 2 invalid fields./)).toBeInTheDocument() // the toast (C185)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Editing the field clears the API's error on it (C176).
    await userEvent.type(within(form).getByLabelText('Slug'), '-2')
    expect(within(form).queryByText('is already used by Tenant 1')).not.toBeInTheDocument()
  })

  it('shows invalid values on their fields with a toast, and sends nothing', async () => {
    listApi([tenant(1)])
    referenceApi()
    let sent = false
    server.use(http.post('/api/v1/tenants', () => ((sent = true), HttpResponse.json({}, { status: 500 }))))
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')
    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }))
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Name'), 'Tenant One')
    await userEvent.type(within(form).getByLabelText('Phone'), '12ab')

    await userEvent.click(within(form).getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/^Tenant details still needs a valid code, the country/)).toBeInTheDocument()
    // Every field the toast names shows its error, touched or not.
    for (const label of ['Code', 'Country', 'Legal form', 'Time zone', 'Institution types', 'Phone'])
      await waitFor(() => expect(within(form).getByLabelText(label)).toHaveAttribute('aria-invalid', 'true'))
    expect(within(form).getAllByText('is required')).toHaveLength(3)
    expect(within(form).getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    expect(sent).toBe(false)
  })

  it('says so when the caller may not create tenants', async () => {
    listApi([tenant(1)])
    referenceApi()
    server.use(
      http.post('/api/v1/tenants', () =>
        HttpResponse.json({ type: 'about:blank', title: 'Forbidden', status: 403, detail: 'You are not allowed to do this.' }, {
          status: 403, headers: { 'Content-Type': 'application/problem+json' },
        })
      )
    )
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')
    await userEvent.click(screen.getByRole('button', { name: 'New tenant' }))
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Name'), 'Tenant One')
    await userEvent.type(within(form).getByLabelText('Code'), 'TONE')
    await pick(form, 'Country', 'mdv', /Maldives/)
    await pick(form, 'Legal form', 'ministry', /Government ministry/)
    await pick(form, 'Time zone', 'maldives', /Indian \/ Maldives/)
    await pick(form, 'Institution types', 'minis', 'Ministry')
    await userEvent.click(within(form).getByRole('button', { name: 'Create tenant' }))
    expect(await screen.findByText(/You don’t have permission to do this|You don't have permission to do this/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps the design prototype at /tenants-prototype until this list is accepted', async () => {
    renderRoute('/tenants-prototype')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New tenant' })).toBeEnabled()
  })
})
