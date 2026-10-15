// Time zones come from the browser (Intl), not the API: the canonical IANA names, kept current by
// the browser. The API still checks the one chosen (time.LoadLocation), so a zone the server does
// not know comes back as a field error.
import type { ComboboxOption } from '@workspace/ui/components/combobox'

/** The browser's IANA zones, or `fallback` where Intl cannot list them. */
export function timezones(fallback: readonly string[] = ['Etc/UTC']): string[] {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return list.length ? [...list] : [...fallback]
}

/** The zone's current offset from UTC, such as "UTC+05:00", at `at`. */
export function utcOffset(zone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value
  return !part || part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
}

/** A zone by its name with spaces ("Indian/Maldives" → "Indian / Maldives"), grouped by region, its offset beside it. */
export const timezoneOptions = (zones: readonly string[], at: Date = new Date()): ComboboxOption[] =>
  zones.map((z) => {
    const [region] = z.split('/')
    return { value: z, label: z.replaceAll('_', ' ').replaceAll('/', ' / '), keywords: z, group: z.includes('/') ? region : 'Other', detail: utcOffset(z, at) }
  })
