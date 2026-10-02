import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getApp } from '@/lib/apps'

// One dynamic route serves every prototype app (apps without their own package yet): an unknown
// slug goes home. The shell's _app layout draws the app's sidebar around it.
export const Route = createFileRoute('/_app/$app')({
  beforeLoad: ({ params }) => {
    if (!getApp(params.app)) {
      throw redirect({ to: '/' })
    }
  },
  component: Outlet,
})
