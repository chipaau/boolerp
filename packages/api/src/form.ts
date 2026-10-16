import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { ApiError } from './error'

/**
 * The part of a TanStack Form (useForm's form) the server errors need: a field's meta, read and
 * changed by name. Any form satisfies it, whatever its values' type.
 */
export type FormLike = {
  getFieldMeta(field: string): { errorMap: Record<string, unknown> } | undefined
  setFieldMeta(field: string, updater: (meta: any) => any): void // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * The part of a form under `prefix` as a form of its own, for a request that saves only that part:
 * an address at "registered" gets its 422's `line1` on the form's `registered.line1` (C176).
 */
export function formAt(form: FormLike, prefix: string): FormLike {
  return {
    getFieldMeta: (field) => form.getFieldMeta(field ? `${prefix}.${field}` : prefix),
    setFieldMeta: (field, updater) => form.setFieldMeta(field ? `${prefix}.${field}` : prefix, updater),
  }
}

/** What a 422 said that no field of the form can show: for the banner above it (C176). */
export type FormErrors = { messages: string[]; reference?: string }

/**
 * The form field names a field path's error may land on, nearest first: `institutionTypes.1.code`
 * is `institutionTypes[1].code`, then `institutionTypes[1]`, then `institutionTypes` (TanStack
 * Form names array items with brackets).
 */
export function fieldCandidates(path: string): string[] {
  if (path === '') return []
  const segments = path.split('.')
  const names: string[] = []
  for (let n = segments.length; n > 0; n--) {
    names.push(segments.slice(0, n).reduce((name, s) => (/^\d+$/.test(s) ? `${name}[${s}]` : name ? `${name}.${s}` : s), ''))
  }
  return names
}

/**
 * Puts a 422's field errors on the form (C176): each path's messages, as sent, become the
 * `onServer` error of its field, or of the nearest field that exists. It returns the messages
 * no field can show (an unknown field, or the whole body), for the banner.
 */
export function applyServerErrors(form: FormLike, error: ApiError): string[] {
  const unmatched: string[] = []
  for (const [path, messages] of Object.entries(error.fieldErrors)) {
    const field = fieldCandidates(path).find((name) => form.getFieldMeta(name) !== undefined)
    if (field === undefined) {
      unmatched.push(...messages.map((m) => (path ? `${path}: ${m}` : m)))
      continue
    }
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      isTouched: true,
      errorMap: { ...meta.errorMap, onServer: messages.join(' ') },
    }))
  }
  return unmatched
}

/**
 * A mutation that saves a form (C176): on a 422 it puts the errors on the form's fields
 * (`applyServerErrors`), returning what matched no field as `formErrors`, with the request's
 * reference, until the next submit. The one error policy (C185) still toasts every failure; a
 * 422's toast is the form's one message (INVALID_FORM_MESSAGE). Without a form it is useMutation.
 */
export function useApiMutation<TData, TVariables, TContext = unknown>(
  options: UseMutationOptions<TData, Error, TVariables, TContext> & { form?: FormLike },
) {
  const { form, ...mutation } = options
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null)
  const result = useMutation<TData, Error, TVariables, TContext>({
    ...mutation,
    meta: form ? { ...mutation.meta, form: true } : mutation.meta,
    onMutate: (...args) => {
      setFormErrors(null)
      return mutation.onMutate?.(...args) as TContext | Promise<TContext>
    },
    onError: (error, ...rest) => {
      if (form && error instanceof ApiError && error.kind === 'http' && error.status === 422) {
        const unmatched = applyServerErrors(form, error)
        if (unmatched.length) setFormErrors({ messages: unmatched, reference: error.requestId })
      }
      return mutation.onError?.(error, ...rest)
    },
  })
  return { ...result, formErrors }
}
