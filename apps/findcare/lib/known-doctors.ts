// The doctors a patient already knows: the ones they saved, then the ones they've seen (latest first).
// My Care and Find care both offer these to book again, so they share one answer.
import { accountAppointments, db, today } from '@/lib/data'
import type { Account } from '@/lib/data'

export function knownDoctors(account: Account) {
  const s = db()
  const saved = account.saved.filter((id) => id in s.doctors)
  const seen = accountAppointments(account.id)
    .filter((a) => a.status === 'completed' || a.date < today())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => a.doctorId)
  const ids = [...new Set([...saved, ...seen])].filter((id) => s.doctors[id].kind !== 'service')
  return { ids, saved: saved.length > 0, seen: seen.length > 0 }
}
