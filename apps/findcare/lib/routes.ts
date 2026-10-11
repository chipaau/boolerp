// Every path the app links to, in one place.

const query = (params: Record<string, string | undefined | null>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const routes = {
  /** Find care; with a list (doctors, services, clinics), the advanced list with its filters. */
  find: (all?: 'doctors' | 'services' | 'clinics', f: { q?: string; spec?: string; area?: string; when?: string } = {}) =>
    `/${query({ all, spec: f.spec, area: f.area === 'all' ? undefined : f.area, when: f.when === 'any' ? undefined : f.when, q: f.q?.trim() })}`,
  /** A doctor's page; `from` sets its back link (the clinic, a full list, My Care). */
  doctor: (id: string, o: { branch?: string; date?: string; reschedule?: string; from?: 'clinic' | 'doctors' | 'services' | 'mycare' } = {}) =>
    `/doctors/${id}${query({ b: o.branch, date: o.date, resched: o.reschedule, from: o.from })}`,
  clinic: (id: string) => `/clinics/${id}`,
  myCare: () => '/my-care',
  appointments: (o: { appt?: string; pay?: string; offer?: string; waitlist?: string; tab?: 'upcoming' | 'past' | 'waitlists' } = {}) =>
    `/appointments${query({ appt: o.appt, pay: o.pay, offer: o.offer, waitlist: o.waitlist, tab: o.tab })}`,
  notifications: () => '/notifications',
  account: () => '/account',
  signIn: (next?: string) => `/sign-in${query({ next })}`,
}

/** Only a same-site path may be a sign-in's destination. */
export const safeNext = (next: string | null | undefined) => (next && next.startsWith('/') && !next.startsWith('//') ? next : routes.myCare())
