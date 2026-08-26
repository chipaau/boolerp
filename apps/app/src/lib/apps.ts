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
  LayoutGrid,
  UsersRound,
  Megaphone,
  FileText,
  Inbox,
  Star,
  UserCircle,
  Briefcase,
  BadgeCheck,
  Layers,
  ClipboardList,
  Activity,
  Target,
  ScrollText,
  CalendarClock,
  CalendarRange,
  BookOpen,
  Receipt,
  CreditCard,
  BarChart3,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
} from 'lucide-react'

// A proto page renders one of these looks so placeholders resemble the real screen they'll become.
export type ProtoVariant = 'dashboard' | 'table' | 'list' | 'calendar'

export type AppMenuItem = {
  title: string
  slug: string // '' = the app's home
  icon?: LucideIcon
  variant?: ProtoVariant
}
export type AppMenuSection = { title?: string; items: AppMenuItem[] }

export type AppDef = {
  slug: string
  name: string
  description: string
  icon: LucideIcon
  menu: AppMenuSection[]
}

// The apps hosted by the workspace shell. Features are adapted from the sentinel reference; the
// per-app accent colour lives in app-themes.css keyed by `theme-<slug>`. Pages are prototypes for
// now (see src/proto) — replacing one with a real screen is a one-line change in its route.
export const APPS: AppDef[] = [
  {
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
  },
  {
    slug: 'control-centre',
    name: 'Control Centre',
    description: 'Tenant administration',
    icon: SlidersHorizontal,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'Access',
        items: [
          { title: 'Users', slug: 'users', icon: Users, variant: 'table' },
          { title: 'Roles', slug: 'roles', icon: Shield, variant: 'table' },
        ],
      },
      {
        title: 'Organisation',
        items: [
          { title: 'Org Units', slug: 'org-units', icon: Building2, variant: 'list' },
          { title: 'Sites', slug: 'sites', icon: MapPin, variant: 'table' },
        ],
      },
      { items: [{ title: 'Settings', slug: 'settings', icon: Settings, variant: 'dashboard' }] },
    ],
  },
  {
    slug: 'hrms',
    name: 'HRMS',
    description: 'Human resources',
    icon: UserCog,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'People',
        items: [
          { title: 'Employees', slug: 'employees', icon: Users, variant: 'table' },
          { title: 'Positions', slug: 'positions', icon: BadgeCheck, variant: 'table' },
        ],
      },
      {
        title: 'Structure',
        items: [
          { title: 'Jobs', slug: 'jobs', icon: Briefcase, variant: 'table' },
          { title: 'Job Classifications', slug: 'job-classifications', icon: Layers, variant: 'list' },
          { title: 'Org Units', slug: 'org-units', icon: Building2, variant: 'list' },
        ],
      },
      { items: [{ title: 'Settings', slug: 'settings', icon: Settings, variant: 'dashboard' }] },
    ],
  },
  {
    slug: 'tasks',
    name: 'Task Management',
    description: 'Tasks & operations',
    icon: ListTodo,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'Work',
        items: [
          { title: 'My Tasks', slug: 'my-tasks', icon: ClipboardList, variant: 'list' },
          { title: 'All Tasks', slug: 'tasks', icon: ListTodo, variant: 'table' },
          { title: 'Activities', slug: 'activities', icon: Activity, variant: 'list' },
        ],
      },
      {
        title: 'Planning',
        items: [
          { title: 'Operation Plans', slug: 'operation-plans', icon: Target, variant: 'table' },
          { title: 'Service Charter', slug: 'service-charter', icon: ScrollText, variant: 'list' },
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
          { title: 'Calendar', slug: '', icon: CalendarDays, variant: 'calendar' },
          { title: 'Agenda', slug: 'agenda', icon: CalendarClock, variant: 'list' },
          { title: 'Events', slug: 'events', icon: CalendarRange, variant: 'table' },
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
  },
  {
    slug: 'inventory',
    name: 'Inventory',
    description: 'Stock & assets',
    icon: Boxes,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'Stock',
        items: [
          { title: 'Items', slug: 'items', icon: Package, variant: 'table' },
          { title: 'Stores', slug: 'stores', icon: Warehouse, variant: 'list' },
          { title: 'Movements', slug: 'movements', icon: ArrowLeftRight, variant: 'table' },
        ],
      },
      { items: [{ title: 'Suppliers', slug: 'suppliers', icon: Truck, variant: 'table' }] },
    ],
  },
]

export const DEFAULT_APP = 'staff-hub'

export function getApp(slug: string): AppDef | undefined {
  return APPS.find((a) => a.slug === slug)
}

/** The CSS class that themes an app's accent colour (see app-themes.css). */
export function appThemeClass(slug: string): string {
  return `theme-${slug}`
}

export function findMenuItem(app: AppDef, section: string): AppMenuItem | undefined {
  return app.menu.flatMap((s) => s.items).find((i) => i.slug === section)
}
