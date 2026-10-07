import { z } from 'zod'

/** A page of a list (C68): `{items, page, pageSize, total}`, each item parsed with `item`. */
export function listOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  })
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

/** An id the API generates (UUIDv7). */
export const id = z.uuid()

/** A timestamp as the API writes it (RFC 3339); kept as a string, formatted where shown. */
export const timestamp = z.iso.datetime({ offset: true })

/**
 * The list parameters every list route validates in its search (C174): page and pageSize within
 * the API's limits, an optional search, and a sort among `sorts` (each optionally descending,
 * comma-separated). Invalid values fall back to the defaults instead of failing the route.
 */
export function listSearch<const S extends string>(opts: { sorts: readonly S[]; defaultPageSize?: number }) {
  const size = opts.defaultPageSize ?? 25
  const sort = z
    .string()
    .refine((v) => v.split(',').every((p) => (opts.sorts as readonly string[]).includes(p.replace(/^-/, ''))))
  return z.object({
    page: z.coerce.number().int().min(1).catch(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(size).default(size),
    q: z.string().trim().min(1).max(100).optional().catch(undefined),
    sort: sort.optional().catch(undefined),
  })
}
