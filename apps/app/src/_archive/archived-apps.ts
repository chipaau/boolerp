// ARCHIVED — not imported anywhere. See README.md in this folder.
// These AppDefs were removed from the live registry (src/lib/apps.ts) when the workspace home
// became the honeycomb overview. Copy an entry back into APPS to restore it.
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CreditCard,
  FileText,
  Inbox,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Receipt,
  Star,
  UserCircle,
  Users,
  UsersRound,
} from 'lucide-react'
import type { AppDef } from '@/lib/apps'

export const STAFF_HUB: AppDef = {
  slug: 'staff-hub',
  name: 'Staff Hub',
  description: 'Your day at work',
  icon: UsersRound,
  menu: [
    { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
    {
      title: 'Workplace',
      items: [
        { title: 'My Apps', slug: 'my-apps', icon: LayoutGrid, variant: 'list' },
        { title: 'Directory', slug: 'directory', icon: Users, variant: 'table' },
        { title: 'My Team', slug: 'team', icon: UsersRound, variant: 'list' },
      ],
    },
    {
      title: 'Updates',
      items: [
        { title: 'Announcements', slug: 'announcements', icon: Megaphone, variant: 'list' },
        { title: 'Policies', slug: 'policies', icon: FileText, variant: 'table' },
      ],
    },
    {
      title: 'Me',
      items: [
        { title: 'Requests', slug: 'requests', icon: Inbox, variant: 'table' },
        { title: 'Reviews', slug: 'reviews', icon: Star, variant: 'table' },
        { title: 'Profile', slug: 'profile', icon: UserCircle, variant: 'dashboard' },
      ],
    },
  ],
}

export const CALENDAR: AppDef = {
  slug: 'calendar',
  name: 'Calendar',
  description: 'Schedules & events',
  icon: CalendarDays,
  menu: [
    {
      items: [
        { title: 'Calendar', slug: '', icon: CalendarDays, variant: 'calendar' },
        { title: 'Agenda', slug: 'agenda', icon: CalendarClock, variant: 'list' },
        { title: 'Events', slug: 'events', icon: CalendarRange, variant: 'table' },
      ],
    },
  ],
}

export const FINANCE: AppDef = {
  slug: 'finance',
  name: 'Finance Management',
  description: 'Accounts & invoices',
  icon: Landmark,
  menu: [
    { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
    {
      title: 'Ledger',
      items: [
        { title: 'Accounts', slug: 'accounts', icon: BookOpen, variant: 'table' },
        { title: 'Invoices', slug: 'invoices', icon: Receipt, variant: 'table' },
        { title: 'Payments', slug: 'payments', icon: CreditCard, variant: 'table' },
      ],
    },
    { items: [{ title: 'Reports', slug: 'reports', icon: BarChart3, variant: 'dashboard' }] },
  ],
}
