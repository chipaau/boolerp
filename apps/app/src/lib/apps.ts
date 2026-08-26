import type { LucideIcon } from 'lucide-react'
import {
  SlidersHorizontal,
  Users,
  UserCog,
  ListTodo,
  CalendarDays,
  Landmark,
  Boxes,
  LayoutDashboard,
  Shield,
  Building2,
  MapPin,
  Settings,
  Clock,
  Wallet,
  ClipboardList,
  SquareKanban,
  CalendarClock,
  BookOpen,
  Receipt,
  BarChart3,
  Package,
  Warehouse,
  ArrowLeftRight,
  Megaphone,
} from 'lucide-react'

export type AppMenuItem = { title: string; slug: string; icon?: LucideIcon }
export type AppMenuSection = { title?: string; items: AppMenuItem[] }

export type AppDef = {
  slug: string
  name: string
  description: string
  icon: LucideIcon
  menu: AppMenuSection[]
}

// The apps hosted by the workspace shell, surfaced in the app switcher and the per-app sidebar.
// Sub-pages are placeholders in this slice — the shell + navigation is what's being built.
export const APPS: AppDef[] = [
  {
    slug: 'control-centre',
    name: 'Control Centre',
    description: 'Tenant administration',
    icon: SlidersHorizontal,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'Access',
        items: [
          { title: 'Users', slug: 'users', icon: Users },
          { title: 'Roles', slug: 'roles', icon: Shield },
        ],
      },
      {
        title: 'Organisation',
        items: [
          { title: 'Org Units', slug: 'org-units', icon: Building2 },
          { title: 'Sites', slug: 'sites', icon: MapPin },
        ],
      },
      { items: [{ title: 'Settings', slug: 'settings', icon: Settings }] },
    ],
  },
  {
    slug: 'staff-hub',
    name: 'Staff Hub',
    description: 'Directory & announcements',
    icon: Users,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        items: [
          { title: 'Directory', slug: 'directory', icon: Users },
          { title: 'Announcements', slug: 'announcements', icon: Megaphone },
        ],
      },
    ],
  },
  {
    slug: 'hrms',
    name: 'HRMS',
    description: 'Human resources',
    icon: UserCog,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'People',
        items: [
          { title: 'Employees', slug: 'employees', icon: UserCog },
          { title: 'Attendance', slug: 'attendance', icon: Clock },
        ],
      },
      { items: [{ title: 'Payroll', slug: 'payroll', icon: Wallet }] },
    ],
  },
  {
    slug: 'tasks',
    name: 'Task Management',
    description: 'Tasks & projects',
    icon: ListTodo,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        items: [
          { title: 'My Tasks', slug: 'my-tasks', icon: ClipboardList },
          { title: 'Boards', slug: 'boards', icon: SquareKanban },
        ],
      },
    ],
  },
  {
    slug: 'calendar',
    name: 'Calendar',
    description: 'Schedules & events',
    icon: CalendarDays,
    menu: [
      {
        items: [
          { title: 'Month', slug: '', icon: CalendarDays },
          { title: 'Agenda', slug: 'agenda', icon: CalendarClock },
        ],
      },
    ],
  },
  {
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
        ],
      },
      { items: [{ title: 'Reports', slug: 'reports', icon: BarChart3 }] },
    ],
  },
  {
    slug: 'inventory',
    name: 'Inventory',
    description: 'Stock & assets',
    icon: Boxes,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'Stock',
        items: [
          { title: 'Items', slug: 'items', icon: Package },
          { title: 'Stores', slug: 'stores', icon: Warehouse },
          { title: 'Movements', slug: 'movements', icon: ArrowLeftRight },
        ],
      },
    ],
  },
]

export const DEFAULT_APP = 'staff-hub'

export function getApp(slug: string): AppDef | undefined {
  return APPS.find((a) => a.slug === slug)
}
