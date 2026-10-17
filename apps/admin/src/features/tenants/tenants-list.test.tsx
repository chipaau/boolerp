import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { INVALID_FORM_MESSAGE } from '@workspace/api'
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
    http.get('/api/v1/countries', () => page([{ code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960', geographyCount: 407 }])),
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
    http.get('/api/v1/geography-types', () =>
      page([
        { id: '0192f6a0-0000-7000-8000-0000000000c1', country: 'MV', code: 'atoll', name: 'Atoll', level: 1, placeCount: 1 },
        { id: '0192f6a0-0000-7000-8000-0000000000c2', country: 'MV', code: 'island', name: 'Island', level: 2, placeCount: 1 },
        { id: '0192f6a0-0000-7000-8000-0000000000c3', country: 'MV', code: 'street', name: 'Street', level: 3, placeCount: 0 },
      ])
    ),
    http.get('/api/v1/geographies', ({ request }) => {
      const parent = new URL(request.url).searchParams.get('parent')
      const place = (id: string, over: Record<string, unknown>) => ({
        id, country: 'MV', code: null, shortName: null, parentId: null, parentName: null, latitude: null, longitude: null,
        childCount: 0, hasChildren: false, ...over,
      })
      return page(
        parent === 'none'
          ? [place(KAAFU, { type: 'atoll', typeName: 'Atoll', level: 1, name: 'Kaafu', shortName: 'K.', childCount: 1, hasChildren: true })]
          : parent === KAAFU
            ? [place(MAAFUSHI, { type: 'island', typeName: 'Island', level: 2, name: 'Maafushi', parentId: KAAFU, parentName: 'Kaafu' })]
            : []
      )
    }),
    http.get('/api/v1/institution-types', () =>
      page([
        { code: 'ministry', name: 'Ministry', sector: { code: 'government', name: 'Government' } },
        { code: 'hospital', name: 'Hospital', sector: { code: 'health', name: 'Health' } },
      ])
    )
  )
}

const KAAFU = '0192f6a0-0000-7000-8000-0000000000d1'
const MAAFUSHI = '0192f6a0-0000-7000-8000-0000000000d2'

/** Chooses `option` in the searchable picker labelled `label`, typing `query` to find it. */
async function pick(form: HTMLElement, label: string, query: string, option: RegExp | string) {
  const input = within(form).getByLabelText(label)
  await waitFor(() => expect(input).toBeEnabled())
  await userEvent.type(input, query)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

const search = () => screen.getByLabelText('Filter by name, code, or slug')

/** Finds text in a toast, not in the copy Base UI keeps for screen readers (C214). */
const inToast = { selector: '[data-slot="toast"] *' }

/** Opens the wizard, creates a tenant in MV, and lands on step 2; returns the address PUTs and the app switches seen. */
async function createdTenant(addressAnswer?: () => Response) {
  listApi([tenant(1)])
  referenceApi()
  const puts: { kind: string; body: unknown }[] = []
  const apps = [
    { key: 'calendar', name: 'Calendar', kind: 'workspace', description: 'A tenant’s shared calendar', isDefault: true, isAvailable: true, on: true, activeFrom: '2026-10-16T09:00:00Z' },
    { key: 'control-centre', name: 'Control Centre', kind: 'workspace', description: null, isDefault: true, isAvailable: true, on: true, activeFrom: '2026-10-16T09:00:00Z' },
    { key: 'hrms', name: 'HRMS', kind: 'workspace', description: 'Employee records', isDefault: false, isAvailable: true, on: false, activeFrom: null as string | null },
    { key: 'analytics', name: 'Analytics', kind: 'workspace', description: null, isDefault: false, isAvailable: false, on: false, activeFrom: null as string | null },
  ]
  const switched: string[] = []
  const switchApp = (key: string, on: boolean) => {
    switched.push(`${on ? 'on' : 'off'} ${key}`)
    const app = apps.find((a) => a.key === key)!
    Object.assign(app, { on, activeFrom: on ? '2026-10-16T10:00:00Z' : null })
    return app
  }
  server.use(
    http.get('/api/v1/tenants/:id/addresses', () => {
      const items = puts.map((p) => ({
        ...(p.body as object), kind: p.kind, places: [], geographyId: null, line2: null, postalCode: null,
        latitude: null, longitude: null, updatedAt: '2026-10-16T09:00:00Z',
      }))
      return HttpResponse.json({ items, page: 1, pageSize: 25, total: items.length })
    }),
    http.get('/api/v1/tenants/:id/apps', () => HttpResponse.json({ items: apps, page: 1, pageSize: 100, total: apps.length })),
    http.put('/api/v1/tenants/:id/apps/:key', ({ params }) => HttpResponse.json(switchApp(String(params.key), true), { status: 201 })),
    http.delete('/api/v1/tenants/:id/apps/:key', ({ params }) => {
      switchApp(String(params.key), false)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('/api/v1/tenants', () =>
      HttpResponse.json(tenant(2, { name: 'Tenant One', slug: 'tenant-one', code: 'TONE', status: 'provisioning', workspaceHost: null }), {
        status: 201, headers: { Location: '/api/v1/tenants/' + tenant(2).id },
      })
    ),
    http.put('/api/v1/tenants/:id/addresses/:kind', async ({ request, params }) => {
      const body = await request.json()
      puts.push({ kind: String(params.kind), body })
      if (addressAnswer) return addressAnswer()
      return HttpResponse.json({
        kind: params.kind, country: 'MV', geographyId: MAAFUSHI, places: [], typedPlaces: { street: 'Sosun Magu' },
        line1: 'H. Sosun Villa', line2: null, postalCode: null, latitude: null, longitude: null, updatedAt: '2026-10-16T09:00:00Z',
      }, { status: 201 })
    })
  )
  renderRoute('/tenants')
  await screen.findByText('T1 · tenant-1')
  await userEvent.click(screen.getByRole('button', { name: 'New tenant' }))
  const form = await screen.findByRole('dialog')
  expect(within(form).queryByRole('button', { name: 'Continue' }), 'nothing to go on to before creating').not.toBeInTheDocument()
  await userEvent.type(within(form).getByLabelText('Name'), 'Tenant One')
  await userEvent.type(within(form).getByLabelText('Code'), 'TONE')
  await pick(form, 'Country', 'mdv', /Maldives/)
  await pick(form, 'Legal form', 'ministry', /Government ministry/)
  await pick(form, 'Time zone', 'maldives', /Indian \/ Maldives/)
  await pick(form, 'Institution types', 'minis', 'Ministry')
  await userEvent.click(within(form).getByRole('button', { name: 'Create tenant' }))
  await within(form).findByRole('heading', { name: 'Where they are' })
  return { form, puts, switched }
}

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
    // Step 1's only way on is creating (C223): offered from the start, it checks the form when pressed.
    expect(within(form).getByRole('button', { name: 'Create tenant' })).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
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
    // Created: the wizard stays open on its address (C223).
    expect(await within(form).findByRole('heading', { name: 'Where they are' })).toBeInTheDocument()
    expect(body).toEqual({
      name: 'Test Clinic', slug: 'test-clinic', code: 'TCLN', country: 'MV',
      legalFormId: '0192f6a0-0000-7000-8000-0000000000f2', timezone: 'Indian/Maldives',
      institutionTypes: [{ code: 'hospital', primary: true }], parentId: tenant(1).id,
      identityNumber: 'C-0001/2026', phone: '+9603324568',
    })
    expect(await screen.findByText('Test Clinic created', inToast)).toBeInTheDocument()
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
    expect(await screen.findByText(INVALID_FORM_MESSAGE, inToast)).toBeInTheDocument() // the toast: the form's one message (C185)
    expect(form).toBeInTheDocument()

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

    await userEvent.click(within(form).getByRole('button', { name: 'Create tenant' }))
    expect(await screen.findByText(INVALID_FORM_MESSAGE, inToast)).toBeInTheDocument() // the same toast as the API's 422
    // Every field the toast names shows its error, touched or not.
    for (const label of ['Code', 'Country', 'Legal form', 'Time zone', 'Institution types', 'Phone'])
      await waitFor(() => expect(within(form).getByLabelText(label)).toHaveAttribute('aria-invalid', 'true'))
    expect(within(form).getAllByText('is required')).toHaveLength(3)
    expect(within(form).getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    expect(sent).toBe(false)
  })

  describe('step 2, the new tenant’s address (C223)', () => {

    it('picks the places level by level, types the level with none listed, and saves it', async () => {
      const { form, puts } = await createdTenant()
      expect(within(form).getByLabelText('Registered address country')).toHaveValue('Maldives')
      await pick(form, 'Registered address atoll', 'kaa', /Kaafu/)
      await pick(form, 'Registered address island', 'maa', 'Maafushi')
      await userEvent.type(within(form).getByLabelText('Street'), ' Sosun Magu ')
      await userEvent.type(within(form).getByLabelText('Address'), 'H. Sosun Villa')
      await userEvent.click(within(form).getByRole('button', { name: 'Save and continue' }))

      await waitFor(() => expect(puts).toHaveLength(1))
      expect(puts[0]).toEqual({
        kind: 'registered',
        body: { country: 'MV', geographyId: MAAFUSHI, typedPlaces: { street: 'Sosun Magu' }, line1: 'H. Sosun Villa' },
      })
      expect(await within(form).findByRole('heading', { name: 'What they can open' })).toBeInTheDocument()
      expect(within(form).queryByRole('button', { name: 'Create tenant' }), 'never created twice').not.toBeInTheDocument()
    })

    it('saves a different mailing address too', async () => {
      const { form, puts } = await createdTenant()
      await pick(form, 'Registered address atoll', 'kaa', /Kaafu/)
      await pick(form, 'Registered address island', 'maa', 'Maafushi')
      await userEvent.type(within(form).getByLabelText('Street'), 'Sosun Magu')
      await userEvent.type(within(form).getAllByLabelText('Address')[0], 'H. Sosun Villa')
      await userEvent.click(within(form).getByRole('checkbox', { name: /Mailing address is the same/ }))
      await pick(form, 'Mailing address atoll', 'kaa', /Kaafu/)
      await pick(form, 'Mailing address island', 'maa', 'Maafushi')
      await userEvent.type(within(form).getAllByLabelText('Street')[1], 'Majeedhee Magu')
      await userEvent.type(within(form).getAllByLabelText('Address')[1], 'PO Box 7')
      await userEvent.click(within(form).getByRole('button', { name: 'Save and continue' }))

      await waitFor(() => expect(puts.map((p) => p.kind)).toEqual(['registered', 'mailing']))
      expect(puts[1].body).toMatchObject({ line1: 'PO Box 7', typedPlaces: { street: 'Majeedhee Magu' } })
    })

    it('cannot be passed without saving, and shows what is missing on its fields', async () => {
      const { form, puts } = await createdTenant()
      await userEvent.click(within(form).getByRole('button', { name: 'Save and continue' }))
      expect(await screen.findByText(INVALID_FORM_MESSAGE, inToast)).toBeInTheDocument()
      expect(within(form).getByLabelText('Address')).toHaveAttribute('aria-invalid', 'true')
      expect(puts).toHaveLength(0)
      expect(within(form).getByRole('heading', { name: 'Where they are' })).toBeInTheDocument()
      expect(within(form).queryByRole('button', { name: 'Back' }), 'step 1 is done').not.toBeInTheDocument()
    })

    it('shows the API’s refusal on the address’s fields', async () => {
      const { form, puts } = await createdTenant(() =>
        HttpResponse.json(
          {
            type: 'https://bool.mv/problems/validation-error', title: 'Unprocessable Content', status: 422,
            detail: 'The request has 1 invalid field.',
            errors: [{ pointer: '#/typedPlaces/street', code: 'required', detail: 'is required: Street is typed' }],
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
      await pick(form, 'Registered address atoll', 'kaa', /Kaafu/)
      await pick(form, 'Registered address island', 'maa', 'Maafushi')
      await userEvent.type(within(form).getByLabelText('Street'), 'x')
      await userEvent.type(within(form).getByLabelText('Address'), 'H. Sosun Villa')
      await userEvent.click(within(form).getByRole('button', { name: 'Save and continue' }))
      await waitFor(() => expect(puts).toHaveLength(1))
      expect(await within(form).findByText('is required: Street is typed')).toBeInTheDocument()
      expect(within(form).getByRole('heading', { name: 'Where they are' }), 'still on the address').toBeInTheDocument()
    })
  })

  describe('step 3, the new tenant’s apps (C224)', () => {
    /** Saves a registered address in Kaafu, Maafushi, landing on step 3. */
    async function toApps(form: HTMLElement) {
      await pick(form, 'Registered address atoll', 'kaa', /Kaafu/)
      await pick(form, 'Registered address island', 'maa', 'Maafushi')
      await userEvent.type(within(form).getByLabelText('Street'), 'Sosun Magu')
      await userEvent.type(within(form).getByLabelText('Address'), 'H. Sosun Villa')
      await userEvent.click(within(form).getByRole('button', { name: 'Save and continue' }))
      await within(form).findByRole('heading', { name: 'What they can open' })
    }

    it('shows the default apps as included and saves each other app as it is switched', async () => {
      const { form, switched } = await createdTenant()
      await toApps(form)

      expect(await within(form).findByText('Calendar')).toBeInTheDocument()
      expect(within(form).getAllByText('Included')).toHaveLength(2)
      expect(within(form).queryByRole('checkbox', { name: 'Calendar' }), 'a default app is not switched here').not.toBeInTheDocument()
      const hrms = within(form).getByRole('checkbox', { name: 'HRMS' })
      expect(hrms).not.toBeChecked()
      expect(within(form).getByRole('checkbox', { name: 'Analytics' }), 'coming soon (C225)').toHaveAttribute('aria-disabled', 'true')
      expect(within(form).getByText('Coming soon')).toBeInTheDocument()

      await userEvent.click(hrms)
      await waitFor(() => expect(within(form).getByRole('checkbox', { name: 'HRMS' })).toBeChecked())
      expect(switched).toEqual(['on hrms'])
      await userEvent.click(within(form).getByRole('checkbox', { name: 'HRMS' }))
      await waitFor(() => expect(within(form).getByRole('checkbox', { name: 'HRMS' })).not.toBeChecked())
      expect(switched).toEqual(['on hrms', 'off hrms'])

      await userEvent.click(within(form).getByRole('checkbox', { name: 'HRMS' }))
      await waitFor(() => expect(switched).toHaveLength(3))
      await userEvent.click(within(form).getByRole('button', { name: 'Continue' }))
      await userEvent.click(await within(form).findByRole('button', { name: 'Review' }))
      // The review lists the apps the tenant has on, from the API.
      const card = (await within(form).findByRole('button', { name: 'Edit Apps' })).parentElement!.parentElement!
      expect(within(card).getByText('HRMS')).toBeInTheDocument()
      expect(within(card).getAllByText('Included')).toHaveLength(2)
      // And the address saved on step 2, not the prototype's.
      const address = within(form).getByRole('button', { name: 'Edit Address' }).parentElement!.parentElement!
      expect(within(address).getByText('H. Sosun Villa, Sosun Magu, Maldives')).toBeInTheDocument()
      expect(within(address).getByText('Same as the registered address')).toBeInTheDocument()
    })
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
    expect(await screen.findByText(/You don’t have permission to do this|You don't have permission to do this/, inToast)).toBeInTheDocument()
    expect(form).toBeInTheDocument()
  })

  it('keeps the design prototype at /tenants-prototype until this list is accepted', async () => {
    renderRoute('/tenants-prototype')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New tenant' })).toBeEnabled()
  })
})
