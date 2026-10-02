import { createContext, useContext  } from 'react'
import type {ReactNode} from 'react';

export type CurrentUser = { name: string; email: string }

const UserContext = createContext<CurrentUser>({ name: 'User', email: '' })

// Provided by the _app layout (from the Kratos session) and consumed by the header + sidebar user menu.
export function UserProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useCurrentUser(): CurrentUser {
  return useContext(UserContext)
}
