// The Calendar data seam. Components read only through these hooks; the query functions are the
// single place that changes at integration (fixture → generated API client). Mutations update the
// cache in place and return an undo, so the toasts can offer one; later they PATCH then invalidate.
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import * as mock from './mock'
import type { CalendarDef, CalendarKey, Meeting, Room, Tone } from './types'

const key = (...parts: string[]) => ['calendar', ...parts] as const

export const calendarsQuery = () => queryOptions({ queryKey: key('calendars'), queryFn: async () => mock.CALENDARS })
export const roomsQuery = () => queryOptions({ queryKey: key('rooms'), queryFn: async () => mock.ROOMS })
export const peopleQuery = () => queryOptions({ queryKey: key('people'), queryFn: async () => mock.PEOPLE })
export const meetingsQuery = () => queryOptions({ queryKey: key('meetings'), queryFn: async () => mock.MEETINGS })
export const meQuery = () => queryOptions({ queryKey: key('me'), queryFn: async () => ({ key: mock.ME, nowMinutes: mock.NOW_MINUTES }) })

export const useCalendars = () => useSuspenseQuery(calendarsQuery()).data
export const useRooms = () => useSuspenseQuery(roomsQuery()).data
export const usePeople = () => useSuspenseQuery(peopleQuery()).data
export const useMeetings = () => useSuspenseQuery(meetingsQuery()).data
/** The signed-in person as the calendar knows them, plus the fixture's "now" for the time line. */
export const useMe = () => useSuspenseQuery(meQuery()).data

type Undo = () => void

export function useMeetingActions() {
  const qc = useQueryClient()
  const update = useCallback(
    (fn: (list: Meeting[]) => Meeting[]) => qc.setQueryData<Meeting[]>(key('meetings'), (list) => fn(list ?? [])),
    [qc]
  )
  const patch = useCallback(
    (id: string, changes: Partial<Meeting>): Undo => {
      let before: Meeting | undefined
      update((list) => list.map((m) => (m.id === id ? ((before = m), { ...m, ...changes }) : m)))
      return () => update((list) => list.map((m) => (m.id === id && before ? before : m)))
    },
    [update]
  )
  return {
    /** Sets the signed-in person's reply. */
    setRsvp: (id: string, me: string, rsvp: Meeting['attendees'][number]['rsvp']): Undo => {
      let before: Meeting | undefined
      update((list) =>
        list.map((m) => {
          if (m.id !== id) return m
          before = m
          const has = m.attendees.some((a) => a.person === me)
          const attendees = has ? m.attendees.map((a) => (a.person === me ? { ...a, rsvp } : a)) : [...m.attendees, { person: me, rsvp }]
          return { ...m, attendees }
        })
      )
      return () => update((list) => list.map((m) => (m.id === id && before ? before : m)))
    },
    setCancelled: (id: string, cancelled: boolean) => patch(id, { cancelled }),
    /** Moves to a new day and start, keeping the length. */
    move: (id: string, date: string, start: string, end: string) => patch(id, { date, start, end, moved: true }),
    create: (meeting: Meeting): Undo => {
      update((list) => [...list, meeting])
      return () => update((list) => list.filter((m) => m.id !== meeting.id))
    },
  }
}

export function useCalendarActions() {
  const qc = useQueryClient()
  const update = (fn: (c: CalendarDef) => CalendarDef, k: CalendarKey) =>
    qc.setQueryData<CalendarDef[]>(key('calendars'), (list) => (list ?? []).map((c) => (c.key === k ? fn(c) : c)))
  return {
    rename: (k: CalendarKey, label: string) => update((c) => ({ ...c, label: label || c.label }), k),
    recolor: (k: CalendarKey, tone: Tone) => update((c) => ({ ...c, tone }), k),
  }
}

/** Admins keep the room list. Meetings name rooms, so a rename follows through to them. */
export function useRoomActions() {
  const qc = useQueryClient()
  const set = (fn: (list: Room[]) => Room[]) => qc.setQueryData<Room[]>(key('rooms'), (list) => fn(list ?? []))
  return {
    add: (room: Room) => set((list) => [...list, room]),
    update: (name: string, changes: Partial<Room>) => {
      set((list) => list.map((r) => (r.name === name ? { ...r, ...changes } : r)))
      if (changes.name && changes.name !== name) {
        qc.setQueryData<Meeting[]>(key('meetings'), (list) => (list ?? []).map((m) => (m.room === name ? { ...m, room: changes.name ?? m.room } : m)))
      }
    },
    remove: (name: string): Undo => {
      let before: Room[] = []
      set((list) => ((before = list), list.filter((r) => r.name !== name)))
      return () => set(() => before)
    },
  }
}

export { SWATCHES } from './mock'
