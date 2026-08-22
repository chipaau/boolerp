import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { initialValues, nodeLabel, type Flow, type UiNode } from '@/lib/kratos'

// KratosForm renders a flow's ui.nodes generically (inputs, hidden csrf, submit buttons) and posts
// the collected values to the flow's action. Kratos drives which fields appear, so the same
// component serves login, recovery, settings, and verification — and future MFA/passkey steps.
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

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body: Record<string, string> = { ...values }
    // The clicked submit button carries the method (e.g. name="method" value="password").
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.name) body[submitter.name] = submitter.value
    onSubmit(body)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {flow.ui.messages?.map((m) => (
        <Alert key={m.id} variant={m.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{m.text}</AlertDescription>
        </Alert>
      ))}
      {nodes.map((node, i) => (
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
    </form>
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

  if (node.type === 'text') {
    return node.meta?.label?.text ? (
      <p className="text-sm text-muted-foreground">{node.meta.label.text}</p>
    ) : null
  }
  if (node.type !== 'input') return null

  const type = a.type ?? 'text'
  if (type === 'hidden') return null // value is carried in form state (incl. csrf_token)

  if (type === 'submit' || type === 'button') {
    return (
      <Button
        type="submit"
        name={a.name}
        value={String(a.value ?? '')}
        disabled={a.disabled || submitting}
        className="w-full"
      >
        {nodeLabel(node) || 'Continue'}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={a.name}>{nodeLabel(node)}</Label>
      <Input
        id={a.name}
        name={a.name}
        type={type}
        required={a.required}
        autoComplete={a.autocomplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={a.disabled || submitting}
      />
      {node.messages?.map((m) => (
        <p
          key={m.id}
          className={m.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
        >
          {m.text}
        </p>
      ))}
    </div>
  )
}
