import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Network, Plane, Users } from 'lucide-react'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { SidebarNavGroups } from '@workspace/ui/components/workspace-sidebar'
import type { SidebarNavItem } from '@workspace/ui/components/workspace-sidebar'
import type { AppDef } from '@/lib/apps'
import { awayInfo, isOnBooks, unitKids, unitMembers, unitTone } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import type { Unit } from '@/features/org/types'
import { useDirectorySearch } from './directory-search'

/**
 * The Directory's rail: everyone, who is away this week, the org chart, then the unit tree (any
 * depth, coloured, with head-counts). Clicking a unit scopes the list to it; the chevron opens it.
 * Rendered by the shared WorkspaceSidebar rows.
 */
export function DirectoryRail(_: { app: AppDef }) {
  const units = useUnits()
  const people = usePeople()
  const { scope, set } = useDirectorySearch()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({ eng: true })
  const today = new Date()
  const onOrg = pathname.endsWith('/org')
  const onList = !onOrg
  const total = people.filter(isOnBooks).length
  const away = people.filter((p) => isOnBooks(p) && awayInfo(p, today)?.now).length

  function unitRow(u: Unit, depth: number): SidebarNavItem {
    return {
      key: u.id,
      title: u.name,
      icon: <ToneDot tone={unitTone(units, u.id)} shape={depth ? 'round' : 'square'} size={depth ? 5 : 7} className="mx-[4.5px]" />,
      render: <button type="button" onClick={() => set({ scope: { kind: 'group', id: u.id }, id: undefined })} />,
      active: onList && scope.kind === 'group' && scope.id === u.id,
      count: unitMembers(people, units, u.id, true).length,
      items: unitKids(units, u.id).map((k) => unitRow(k, depth + 1)),
      open: !!open[u.id],
      onOpenChange: (o) => setOpen((s) => ({ ...s, [u.id]: o })),
    }
  }

  return (
    <SidebarNavGroups
      groups={[
        {
          items: [
            { key: 'all', title: 'All people', icon: Users, render: <button type="button" onClick={() => set({ scope: { kind: 'all' }, id: undefined })} />, active: onList && scope.kind === 'all', count: total },
            { key: 'away', title: 'Away this week', icon: Plane, render: <button type="button" onClick={() => set({ scope: { kind: 'away' }, id: undefined })} />, active: onList && scope.kind === 'away', count: away > 0 ? away : undefined, countTone: 'warning' },
            { key: 'org', title: 'Org chart', icon: Network, render: <Link to="/$app/$section" params={{ app: 'directory', section: 'org' }} />, active: onOrg },
          ],
        },
        { title: 'Groups', items: unitKids(units, null).map((u) => unitRow(u, 0)) },
      ]}
    />
  )
}
