export type ListKind = 'doctors' | 'services' | 'clinics'

export type ListFilters = { q?: string; spec?: string; area?: string; when?: string }

export const isListKind = (v: string | null): v is ListKind => v === 'doctors' || v === 'services' || v === 'clinics'
