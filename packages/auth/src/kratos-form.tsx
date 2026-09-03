import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { Input } from '@workspace/ui/components/input'
import { cn } from '@workspace/ui/lib/utils'
import { initialValues, nodeLabel, sameOrigin, type Flow, type UiNode, type UiText } from './kratos'

// KratosForm renders a flow's ui.nodes generically (inputs, hidden csrf, submit buttons) and posts
// the collected values to the flow's action. Kratos drives which fields appear, so the same
// component serves login, recovery, settings, and verification — and future MFA/passkey steps.
// Styling follows the Hexa Login design: overline labels, 52px cream pill fields, one amber CTA
// with the circle arrow, further methods as cream secondary pills.
export function KratosForm({
  flow,
  onSubmit,
  submitting = false,
  groups,
}: {
  flow: Flow
  onSubmit: (body: Record<string, string>) => void
  submitting?: boolean
  groups?: string[] // restrict to these node groups (+ 'default' for csrf); omit to render all
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(flow))

  const nodes = flow.ui.nodes.filter((n) => n.group === 'default' || !groups || groups.includes(n.group))
  const scripts = nodes.filter((n) => n.type === 'script')
  const fields = nodes.filter((n) => n.type !== 'script' && !isSubmit(n))
  const submits = nodes.filter(isSubmit)

  // WebAuthn / passkey steps ship a helper script node; load it once (on this origin) so the trigger
  // buttons' onclick handlers have `window.__oryWebAuthn*` available.
  useEffect(() => {
    for (const node of scripts) {
      const a = node.attributes
      if (!a.src) continue
      const src = sameOrigin(a.src)
      if (document.querySelector(`script[src="${src}"]`)) continue
      const el = document.createElement('script')
      el.src = src
      el.async = a.async ?? true
      if (a.id) el.id = a.id
      if (a.nonce) el.nonce = a.nonce
      if (a.crossorigin) el.crossOrigin = a.crossorigin
      if (a.integrity) el.integrity = a.integrity
      if (a.referrerpolicy) el.referrerPolicy = a.referrerpolicy
      document.body.appendChild(el)
    }
  }, [scripts])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body: Record<string, string> = { ...values }
    // The clicked submit button carries the method (e.g. name="method" value="password").
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.name) body[submitter.name] = submitter.value
    onSubmit(body)
  }

  // action/method are set so a native submit (the WebAuthn helper calls form.submit()) still reaches
  // Kratos on this origin; the normal path is the fetch in handleSubmit.
  return (
    <form action={sameOrigin(flow.ui.action)} method={flow.ui.method || 'POST'} onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
      {fields.map((node, i) => (
        <Field
          key={node.attributes.name ?? `${node.type}-${i}`}
          node={node}
          value={values[node.attributes.name ?? ''] ?? ''}
          onChange={(v) => {
            const name = node.attributes.name
            if (name) setValues((s) => ({ ...s, [name]: v }))
          }}
          submitting={submitting}
        />
      ))}
      {flow.ui.messages?.map((m) => (
        <FlowMessage key={m.id} message={m} />
      ))}
      {submits.map((node, i) => (
        <SubmitButton key={node.attributes.name ?? `submit-${i}`} node={node} primary={i === 0} submitting={submitting} />
      ))}
    </form>
  )
}

function isSubmit(node: UiNode) {
  return node.type === 'input' && (node.attributes.type === 'submit' || node.attributes.type === 'button')
}

/** Runs the inline handler Kratos attaches to WebAuthn / passkey trigger buttons. */
function runNodeScript(code: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(code)()
}

/** A flow-level message: errors shake in as a rose pill; info stays quiet. */
function FlowMessage({ message }: { message: UiText }) {
  if (message.type === 'error') {
    return (
      <div role="alert" className="flex animate-shake items-center gap-2.5 rounded-full bg-destructive-soft px-[18px] py-3">
        <HexGlyph size={11} className="text-destructive" />
        <span className="text-ui-sm text-destructive">{message.text}</span>
      </div>
    )
  }
  return <p className="text-ui-sm text-muted-foreground">{message.text}</p>
}

function SubmitButton({ node, primary, submitting }: { node: UiNode; primary: boolean; submitting: boolean }) {
  const a = node.attributes
  const label = nodeLabel(node) || 'Continue'
  if (a.type === 'button' && a.onclick) {
    const code = a.onclick
    return (
      <Button
        type="button"
        name={a.name}
        disabled={a.disabled || submitting}
        variant="secondary"
        className="h-[52px] w-full bg-card text-ui hover:bg-surface-soft"
        onClick={() => runNodeScript(code)}
      >
        {label}
      </Button>
    )
  }
  if (primary) {
    return (
      <Button
        type="submit"
        name={a.name}
        value={String(a.value ?? '')}
        disabled={a.disabled || submitting}
        variant="brand"
        size="xl"
        className="mt-[13px] w-full justify-between"
      >
        {submitting ? 'Checking…' : label}
        <ButtonArrow>
          {submitting ? (
            <span className="size-3.5 animate-spin-fast rounded-full border-2 border-brand-soft/30 border-t-brand-cta-hover" />
          ) : undefined}
        </ButtonArrow>
      </Button>
    )
  }
  return (
    <Button
      type="submit"
      name={a.name}
      value={String(a.value ?? '')}
      disabled={a.disabled || submitting}
      variant="secondary"
      className="h-[52px] w-full bg-card text-ui hover:bg-surface-soft"
    >
      {label}
    </Button>
  )
}

function Field({
  node,
  value,
  onChange,
  submitting,
}: {
  node: UiNode
  value: string
  onChange: (v: string) => void
  submitting: boolean
}): ReactNode {
  const a = node.attributes
  const [reveal, setReveal] = useState(false)

  if (node.type === 'text') {
    return node.meta?.label?.text ? (
      <p className="text-ui-lg leading-[1.55] text-muted-foreground">{node.meta.label.text}</p>
    ) : null
  }
  if (node.type !== 'input') return null

  const type = a.type ?? 'text'
  if (type === 'hidden') return <input type="hidden" name={a.name} value={value} readOnly />

  const isPassword = type === 'password'
  const hasError = node.messages?.some((m) => m.type === 'error')

  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between">
        <span className="text-fine font-bold tracking-[0.12em] text-faint uppercase">{nodeLabel(node)}</span>
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="text-xs text-link hover:underline hover:underline-offset-[3px]"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      <Input
        id={a.name}
        name={a.name}
        type={isPassword && reveal ? 'text' : type}
        required={a.required}
        autoComplete={a.autocomplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={a.disabled || submitting}
        aria-invalid={hasError || undefined}
        className={cn(
          'h-[52px] rounded-full bg-card px-[21px] hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:ring-inset focus-visible:ring-ring-warm',
          hasError && 'ring-2 ring-destructive ring-inset'
        )}
      />
      {node.messages?.map((m) => (
        <span
          key={m.id}
          className={cn(
            'mt-2 block text-xs',
            m.type === 'error' ? 'font-bold text-destructive' : 'text-muted-foreground'
          )}
        >
          {m.text}
        </span>
      ))}
    </label>
  )
}
