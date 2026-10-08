import { Outlet, createRootRoute } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-svh bg-background text-foreground antialiased">
      <Outlet />
    </div>
  ),
})
