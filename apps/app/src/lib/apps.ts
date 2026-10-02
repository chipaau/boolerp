import { Activity, BadgeCheck, Boxes, Briefcase, Building2, CalendarDays, ChartColumn, ClipboardCheck, ClipboardList, FileBarChart, FileSignature, FolderOpen, Layers, LayoutDashboard, ListTodo, NotebookPen, Package, PackageMinus, Receipt, ScanBarcode, ScrollText, Settings, ShoppingCart, Target, Truck, UserCog, Users, Wrench } from 'lucide-react'

export type { AppDef, AppMenuItem, AppMenuSection } from '@workspace/app-kit'
import type { AppDef } from '@workspace/app-kit'
import { useLocation } from '@tanstack/react-router'
import { apps as editionApps } from 'virtual:edition'

// The apps hosted by the workspace shell, in the order they appear on the Home honeycomb (the
// first eight get a tile; the rest are reachable from the switcher): first the edition's app
// packages (editions/<name>.ts, C107), each with its own manifest and routes (C102), then the
// apps that are still prototypes here: sections without a real screen in features/screens.ts
// render the prototype page (src/proto) until one exists.
// Archived apps (Staff Hub, Finance) live in src/_archive.
export const APPS: AppDef[] = [
  ...editionApps,

  {
    slug: 'tasks',
    name: 'Task',
    description: 'Plan & track work',
    icon: ListTodo,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'Work',
        items: [
          { title: 'My Tasks', slug: 'my-tasks', icon: ClipboardList },
          { title: 'All Tasks', slug: 'tasks', icon: ListTodo },
          { title: 'Activities', slug: 'activities', icon: Activity },
        ],
      },
      {
        title: 'Planning',
        items: [
          { title: 'Operation Plans', slug: 'operation-plans', icon: Target },
          { title: 'Service Charter', slug: 'service-charter', icon: ScrollText },
        ],
      },
    ],
  },
  {
    slug: 'inventory',
    name: 'Inventory',
    description: 'Track & manage inventory',
    icon: Boxes,
    // the design's rail: counts on the right, low stock and requests coloured; the user's saved
    // views are appended by the sidebar from features/shell
    menu: [
      {
        title: 'Inventory',
        items: [
          { title: 'Overview', slug: '', icon: LayoutDashboard },
          { title: 'All items', slug: 'items', icon: Package, badge: { key: 'items' } },
          { title: 'Low stock', slug: 'low-stock', icon: PackageMinus, badge: { key: 'low-stock', tone: 'risk' } },
          { title: 'Purchase orders', slug: 'purchase-orders', icon: FileSignature, badge: { key: 'purchase-orders' } },
          { title: 'Suppliers', slug: 'suppliers', icon: Truck },
          { title: 'Requests & approvals', slug: 'requests', icon: ClipboardCheck, badge: { key: 'requests', tone: 'warning' } },
          { title: 'Reports', slug: 'reports', icon: FileBarChart },
          { title: 'Settings & permissions', slug: 'settings', icon: Settings },
        ],
      },
    ],
  },
  {
    slug: 'calendar',
    name: 'Calendar',
    description: 'Meetings & rooms',
    icon: CalendarDays,
    // the rail is the app's own (mini month, awaiting replies, calendars) — see features/rails.ts
    menu: [{ items: [{ title: 'Calendar', slug: '', icon: CalendarDays }] }],
  },
  {
    slug: 'asset',
    name: 'Asset',
    description: 'Register & verify assets',
    icon: ScanBarcode,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'Register',
        items: [
          { title: 'Assets', slug: 'assets', icon: Layers },
          { title: 'Verifications', slug: 'verifications', icon: ClipboardCheck },
          { title: 'Maintenance', slug: 'maintenance', icon: Wrench },
        ],
      },
    ],
  },
  {
    slug: 'notes',
    name: 'Notes',
    description: 'Capture notes & documents',
    icon: NotebookPen,
    menu: [
      {
        items: [
          { title: 'All Notes', slug: '', icon: NotebookPen },
          { title: 'Folders', slug: 'folders', icon: FolderOpen },
        ],
      },
    ],
  },
  {
    slug: 'directory',
    name: 'Directory',
    description: 'People & teams',
    icon: Users,
    menu: [
      {
        items: [
          { title: 'People', slug: '', icon: Users },
          { title: 'Org chart', slug: 'org', icon: Building2 },
        ],
      },
    ],
  },
  {
    slug: 'hrms',
    name: 'HRMS',
    description: 'People & positions',
    icon: UserCog,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'People',
        items: [
          { title: 'Employees', slug: 'employees', icon: Users },
          { title: 'Positions', slug: 'positions', icon: BadgeCheck },
        ],
      },
      {
        title: 'Structure',
        items: [
          { title: 'Jobs', slug: 'jobs', icon: Briefcase },
          { title: 'Job Classifications', slug: 'job-classifications', icon: Layers },
          { title: 'Org Units', slug: 'org-units', icon: Building2 },
        ],
      },
      { items: [{ title: 'Settings', slug: 'settings', icon: Settings }] },
    ],
  },
  {
    slug: 'analytics',
    name: 'Analytics',
    description: 'Reports & insights',
    icon: ChartColumn,
    menu: [
      {
        items: [
          { title: 'Dashboards', slug: '', icon: LayoutDashboard },
          { title: 'Reports', slug: 'reports', icon: FileBarChart },
        ],
      },
    ],
  },
  {
    slug: 'procurement',
    name: 'Procurement',
    description: 'Requests & purchase orders',
    icon: ShoppingCart,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard }] },
      {
        title: 'Purchasing',
        items: [
          { title: 'Goods Requests', slug: 'requests', icon: ClipboardList },
          { title: 'Purchase Orders', slug: 'purchase-orders', icon: FileSignature },
          { title: 'Invoices', slug: 'invoices', icon: Receipt },
        ],
      },
      { items: [{ title: 'Suppliers', slug: 'suppliers', icon: Truck }] },
    ],
  },
]

export function getApp(slug: string): AppDef | undefined {
  return APPS.find((a) => a.slug === slug)
}

export { findMenuItem } from '@workspace/app-kit'

/**
 * The app the browser is in, from the URL's first segment (/<slug>/…), or undefined outside
 * apps (home, notifications). Works for app packages and prototypes alike; the top bar's switcher
 * and the app frame both read it, so the workspace chrome never depends on an app's routes.
 */
export function useCurrentApp(): AppDef | undefined {
  const slug = useLocation({ select: (l) => l.pathname.split('/')[1] ?? '' })
  return getApp(slug)
}
