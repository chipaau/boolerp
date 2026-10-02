import { useState } from 'react'
import { Link, useLocation, useSearch } from '@tanstack/react-router'
import { LifeBuoy, MessageSquarePlus } from 'lucide-react'
import { WorkspaceSidebar } from '@workspace/ui/components/workspace-sidebar'
import type { SidebarNavGroup } from '@workspace/ui/components/workspace-sidebar'
import { AppIcon } from '@/components/app-icon'
import { getRail } from '@/features/rails'
import { FeedbackDialog } from '@/features/shell/feedback-dialog'
import { useNavCounts, useSavedViews } from '@/features/shell/queries'
import { SupportDialog } from '@/features/shell/support-dialog'
import type { AppDef, AppMenuItem, AppMenuSection } from '@/lib/apps'

/**
 * The app's rail, a thin adapter over the shared WorkspaceSidebar: identity from the registry,
 * the registry's menu groups (plus saved views, which carry their filter as search params) with
 * live counts, or the app's own rail sections when it registers one. Support, feedback and the
 * maker's mark sit at the foot. The account and the way back to Home live in the topbar.
 */
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const search: Record<string, string | undefined> = useSearch({ strict: false })
  const base = `/${app.slug}`
  const Rail = getRail(app)
  const counts = useNavCounts(app.slug)
  const views = useSavedViews(app.slug)
  const [support, setSupport] = useState(false)
  const [feedback, setFeedback] = useState(false)

  // the registry's groups, then the user's saved views as one more group (same row shape)
  const sections: AppMenuSection[] = views.length
    ? [...app.menu, { title: 'My views', items: views.map((v) => ({ title: v.title, slug: v.section, search: v.search, badge: v.badgeKey ? { key: v.badgeKey } : undefined })) }]
    : app.menu

  function isActive(item: AppMenuItem) {
    const to = item.slug ? `${base}/${item.slug}` : base
    if (pathname !== to) return false
    const want = item.search ?? {}
    // a plain link is active only when no preset filter is applied; a view when its preset matches
    return ['filter', 'q'].every((k) => (search[k] ?? undefined) === (want[k] ?? undefined))
  }

  const groups: SidebarNavGroup[] = sections.map((section) => ({
    // the header already names the app, so a group titled after it stays unlabelled
    title: section.title === app.name ? undefined : section.title,
    items: section.items.map((item) => {
      const count = item.badge ? counts[item.badge.key] : undefined
      return {
        key: `${item.slug}:${item.title}`,
        title: item.title,
        icon: item.icon,
        render: item.slug ? <Link to="/$app/$section" params={{ app: app.slug, section: item.slug }} search={item.search} /> : <Link to="/$app" params={{ app: app.slug }} />,
        active: isActive(item),
        count,
        countTone: item.badge?.tone,
      }
    }),
  }))

  return (
    <>
      <WorkspaceSidebar
        identity={{ glyph: <AppIcon slug={app.slug} size={26} />, name: app.name, description: app.description }}
        groups={Rail ? [] : groups}
        footer={{
          actions: [
            { label: 'Support', icon: LifeBuoy, onClick: () => setSupport(true) },
            { label: 'Send feedback', icon: MessageSquarePlus, onClick: () => setFeedback(true) },
          ],
          madeBy: { href: 'https://bool.mv' },
        }}
      >
        {Rail && <Rail app={app} />}
      </WorkspaceSidebar>
      <SupportDialog open={support} onClose={() => setSupport(false)} onFeedback={() => { setSupport(false); setFeedback(true) }} />
      <FeedbackDialog open={feedback} page={pathname} onClose={() => setFeedback(false)} />
    </>
  )
}
