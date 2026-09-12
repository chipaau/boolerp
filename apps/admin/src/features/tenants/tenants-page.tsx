import { useState   } from 'react'
import type {ChangeEvent, ReactNode} from 'react';
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { PageTitle } from '@/components/layout/page'
import { useCreateTenant, useReactivateTenant, useSuspendTenant, useArchiveTenant, useTenants } from './queries'
import type { CreateTenantInput, Tenant, TenantStatus } from './types'

// Seeded codes (apps/api/internal/db/migrations/00007_seed_reference.sql) — organisation-class
// party types only (tenants must be organisation-class, app-enforced) and every institution type.
// Hardcoded rather than fetched: a small, fixed classification list, not worth a reference-data
// endpoint for this pass.
const PARTY_TYPES = [
  { code: 'government', label: 'Government' },
  { code: 'ngo', label: 'NGO' },
  { code: 'sole-proprietor', label: 'Sole Proprietor' },
  { code: 'public-company', label: 'Public Company' },
  { code: 'private-company', label: 'Private Company' },
  { code: 'partnership', label: 'Partnership' },
] as const

const INSTITUTION_TYPES = [
  { code: 'business', label: 'Business' },
  { code: 'hospital', label: 'Hospital' },
  { code: 'clinic', label: 'Clinic' },
  { code: 'health-centre', label: 'Health Centre' },
  { code: 'school', label: 'School' },
  { code: 'university', label: 'University' },
  { code: 'ministry', label: 'Ministry' },
  { code: 'ngo-office', label: 'NGO Office' },
  { code: 'council', label: 'Council (Maldives only)' },
] as const

const STATUS_VARIANT: Record<TenantStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  archived: 'danger',
  provisioning: 'neutral',
}

type PendingTransition = { tenant: Tenant; action: 'suspend' | 'reactivate' | 'archive' }

const TRANSITION_COPY: Record<PendingTransition['action'], { verb: string; pastTense: string; description: string; danger?: boolean }> = {
  suspend: { verb: 'Suspend', pastTense: 'suspended', description: 'The tenant loses access immediately — this can be reversed with Reactivate.' },
  reactivate: { verb: 'Reactivate', pastTense: 'reactivated', description: 'The tenant regains access immediately.' },
  archive: { verb: 'Archive', pastTense: 'archived', description: 'This cannot be undone in this version — the tenant is permanently marked as ceased.', danger: true },
}

export function TenantsPage() {
  const { data: tenants, isLoading, isError } = useTenants()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<PendingTransition | null>(null)

  const suspend = useSuspendTenant()
  const reactivate = useReactivateTenant()
  const archive = useArchiveTenant()

  const runTransition = () => {
    if (!pending) return
    const mutation = pending.action === 'suspend' ? suspend : pending.action === 'reactivate' ? reactivate : archive
    mutation.mutate(pending.tenant.id, {
      onSuccess: () => {
        toast(`${pending.tenant.name} ${TRANSITION_COPY[pending.action].pastTense}`)
        setPending(null)
      },
      onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong', { ok: false }),
    })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle
          overline="Operator Console"
          title="Tenants"
          meta="Every tenant on the platform — provision new ones, suspend or archive existing ones."
          actions={<Button onClick={() => setCreating(true)}>New tenant</Button>}
        />

        <Card className="gap-0 overflow-clip py-0">
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-tone-risk-foreground">
                    Could not load tenants.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && tenants?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No tenants yet.
                  </TableCell>
                </TableRow>
              )}
              {tenants?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-bold text-foreground">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{t.code}</TableCell>
                  <TableCell>{t.country}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[t.status]} size="sm">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-2">
                      {t.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => setPending({ tenant: t, action: 'suspend' })}>
                          Suspend
                        </Button>
                      )}
                      {t.status === 'suspended' && (
                        <Button variant="outline" size="sm" onClick={() => setPending({ tenant: t, action: 'reactivate' })}>
                          Reactivate
                        </Button>
                      )}
                      {t.status !== 'archived' && (
                        <Button variant="outline" size="sm" className="text-tone-risk-foreground" onClick={() => setPending({ tenant: t, action: 'archive' })}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreateTenantDialog open={creating} onClose={() => setCreating(false)} />

      <ConfirmDialog
        open={!!pending}
        title={pending ? `${TRANSITION_COPY[pending.action].verb} ${pending.tenant.name}?` : ''}
        description={pending ? TRANSITION_COPY[pending.action].description : ''}
        action={pending ? TRANSITION_COPY[pending.action].verb : ''}
        danger={pending ? TRANSITION_COPY[pending.action].danger : false}
        onClose={() => setPending(null)}
        onConfirm={runTransition}
      />
    </div>
  )
}

const EMPTY_FORM: CreateTenantInput = {
  slug: '',
  code: '',
  name: '',
  country: 'MV',
  party_type_code: PARTY_TYPES[0].code,
  institution_type_code: INSTITUTION_TYPES[0].code,
  owner_email: '',
  owner_name: '',
}

function CreateTenantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTenant()
  const toast = useToast()
  const [form, setForm] = useState<CreateTenantInput>(EMPTY_FORM)

  const set = (k: keyof CreateTenantInput) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = () => {
    if (!form.slug || !form.code || !form.name || !form.owner_email || !form.owner_name) {
      toast('Fill in every field', { ok: false })
      return
    }
    create.mutate(form, {
      onSuccess: (res) => {
        toast(`${res.tenant.name} provisioned`)
        setForm(EMPTY_FORM)
        onClose()
      },
      onError: (e) => toast(e instanceof Error ? e.message : 'Could not provision tenant', { ok: false }),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New tenant</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <Field label="Name" htmlFor="tenant-name">
            <Input id="tenant-name" value={form.name} onChange={set('name')} placeholder="Malé City Council" />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Slug" htmlFor="tenant-slug">
              <Input id="tenant-slug" value={form.slug} onChange={set('slug')} placeholder="malecouncil" />
            </Field>
            <Field label="Code" htmlFor="tenant-code">
              <Input id="tenant-code" value={form.code} onChange={set('code')} placeholder="MCC" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Party type" htmlFor="tenant-party-type">
              <NativeSelect id="tenant-party-type" value={form.party_type_code} onChange={set('party_type_code')}>
                {PARTY_TYPES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Institution type" htmlFor="tenant-institution-type">
              <NativeSelect id="tenant-institution-type" value={form.institution_type_code} onChange={set('institution_type_code')}>
                {INSTITUTION_TYPES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Owner email" htmlFor="tenant-owner-email">
            <Input id="tenant-owner-email" type="email" value={form.owner_email} onChange={set('owner_email')} placeholder="owner@example.mv" />
          </Field>
          <Field label="Owner name" htmlFor="tenant-owner-name">
            <Input id="tenant-owner-name" value={form.owner_name} onChange={set('owner_name')} placeholder="Dev Owner" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Provisioning…' : 'Provision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
