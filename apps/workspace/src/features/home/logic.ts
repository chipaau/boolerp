import type { DayActivity } from './types'

export const NO_ACTIVITY: DayActivity = { meetings: 0, tasks: 0, approvals: 0 }

/** Heat-map level: 0 light / 1 healthy / 2 at-or-above target. */
export function activityLevel(a: DayActivity): 0 | 1 | 2 {
  const total = a.meetings + a.tasks + a.approvals
  if (total === 0) return 0
  return total >= 4 ? 2 : 1
}
