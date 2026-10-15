"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Label } from "@workspace/ui/components/label"

/**
 * Form fields bound to a TanStack Form field (C176): the label (with the required mark, C202),
 * the control, then the field's errors once it is touched (zod's, and the API's `onServer`
 * error) or else its hint. Typed by the part of the field they use, so this package needs no
 * form dependency: pass the `field` that `form.Field`'s children receive.
 */
export type BoundField<T> = {
  name: string
  state: {
    value: T
    meta: { errors: readonly unknown[]; isTouched: boolean; errorMap?: Record<string, unknown> }
  }
  handleChange: (value: T) => void
  handleBlur: () => void
  setMeta: (updater: (meta: any) => any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** The messages of a field's errors, once it is touched: zod's issues and the API's strings. */
export function fieldErrors(field: BoundField<unknown>): string[] {
  const { meta } = field.state
  if (!meta.isTouched) return []
  const messages = meta.errors.flatMap((e) => {
    if (typeof e === "string") return [e]
    if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return [e.message]
    return []
  })
  return [...new Set(messages)]
}

/** What a FormField's control is given: its id, value, and change and blur handlers. */
export type FieldControl<T> = {
  id: string
  value: T
  /** Changes the value, clearing the API's error on the field first (C176). */
  onChange: (value: T) => void
  onBlur: () => void
  invalid: boolean
  describedBy?: string
}

const fieldId = (name: string) => "field-" + name.replace(/[^\w-]/g, "-")

/**
 * One labelled field of a form, for any control: the control is the children function's result.
 *
 *   <form.Field name="country">{(field) => (
 *     <FormField field={field} label="Country" required>
 *       {(c) => <CountrySelect id={c.id} value={c.value} onValueChange={c.onChange} aria-invalid={c.invalid} />}
 *     </FormField>
 *   )}</form.Field>
 */
function FormField<T>({
  field,
  label,
  required,
  hint,
  className,
  children,
}: {
  field: BoundField<T>
  label: string
  required?: boolean
  hint?: React.ReactNode
  className?: string
  children: (control: FieldControl<T>) => React.ReactNode
}) {
  const id = fieldId(field.name)
  const errors = fieldErrors(field as BoundField<unknown>)
  const noteId = errors.length || hint ? id + "-note" : undefined
  const control: FieldControl<T> = {
    id,
    value: field.state.value,
    onChange: (value) => {
      if (field.state.meta.errorMap?.onServer !== undefined) {
        field.setMeta((meta: { errorMap: Record<string, unknown> }) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }))
      }
      field.handleChange(value)
    },
    onBlur: field.handleBlur,
    invalid: errors.length > 0,
    describedBy: noteId,
  }
  return (
    <div data-slot="form-field" className={cn("min-w-0", className)}>
      <Label htmlFor={id} required={required} className="mb-1.5 text-meta font-bold text-muted-foreground">
        {label}
      </Label>
      {children(control)}
      {errors.length > 0 ? (
        <div id={noteId} role="alert" className="mt-1.5 text-caption leading-[1.45] text-destructive">
          {errors.join(" ")}
        </div>
      ) : (
        hint && (
          <div id={noteId} className="mt-1.5 text-caption leading-[1.45] text-faint">
            {hint}
          </div>
        )
      )}
    </div>
  )
}

/** The filled text-field look of forms. */
const inputClass =
  "h-10 w-full rounded-[10px] bg-surface-band px-[13px] text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-2 aria-invalid:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"

/** A labelled text input bound to a form field. */
function TextField({
  field,
  label,
  required,
  hint,
  className,
  inputClassName,
  ...input
}: {
  field: BoundField<string>
  label: string
  required?: boolean
  hint?: React.ReactNode
  className?: string
  inputClassName?: string
} & Pick<React.ComponentProps<"input">, "placeholder" | "type" | "inputMode" | "autoFocus" | "autoComplete">) {
  return (
    <FormField field={field} label={label} required={required} hint={hint} className={className}>
      {(c) => (
        <input
          id={c.id}
          name={field.name}
          value={c.value}
          onChange={(e) => c.onChange(e.target.value)}
          onBlur={c.onBlur}
          required={required}
          aria-invalid={c.invalid || undefined}
          aria-describedby={c.describedBy}
          className={cn(inputClass, inputClassName)}
          {...input}
        />
      )}
    </FormField>
  )
}

/**
 * The banner above a form for what the API said that no field can show (C176), with the
 * request's reference for support; nothing when there is nothing to say.
 */
function FormErrorBanner({ errors, className }: { errors: { messages: string[]; reference?: string } | null; className?: string }) {
  if (!errors || errors.messages.length === 0) return null
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>It could not be saved</AlertTitle>
      <AlertDescription>
        {errors.messages.map((m) => (
          <p key={m}>{m}</p>
        ))}
        {errors.reference && <p className="text-caption">Reference {errors.reference}</p>}
      </AlertDescription>
    </Alert>
  )
}

export { FormField, TextField, FormErrorBanner, inputClass }
