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
    { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
    {
      title: 'Workplace',
      items: [
        { title: 'My Apps', slug: 'my-apps', icon: LayoutGrid },
        { title: 'Directory', slug: 'directory', icon: Users },
        { title: 'My Team', slug: 'team', icon: UsersRound },
      ],
    },
    {
      title: 'Updates',
      items: [
        { title: 'Announcements', slug: 'announcements', icon: Megaphone },
        { title: 'Policies', slug: 'policies', icon: FileText },
      ],
    },
    {
      title: 'Me',
      items: [
        { title: 'Requests', slug: 'requests', icon: Inbox },
        { title: 'Reviews', slug: 'reviews', icon: Star },
        { title: 'Profile', slug: 'profile', icon: UserCircle },
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
        { title: 'Calendar', slug: '', icon: CalendarDays },
        { title: 'Agenda', slug: 'agenda', icon: CalendarClock },
        { title: 'Events', slug: 'events', icon: CalendarRange },
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
    { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
    {
      title: 'Ledger',
      items: [
        { title: 'Accounts', slug: 'accounts', icon: BookOpen },
        { title: 'Invoices', slug: 'invoices', icon: Receipt },
        { title: 'Payments', slug: 'payments', icon: CreditCard },
      ],
    },
    { items: [{ title: 'Reports', slug: 'reports', icon: BarChart3 }] },
  ],
}
