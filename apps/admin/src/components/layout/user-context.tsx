import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/** `photo` is the person's picture from their account, the same in every app (C196). */
export type CurrentUser = { name: string; email: string; photo?: string }

const UserContext = createContext<CurrentUser>({ name: 'Operator', email: '' })

// Provided by the _admin layout (from the Kratos session) and consumed by the header's account menu.
export function UserProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useCurrentUser(): CurrentUser {
  return useContext(UserContext)
}
