import type { LucideIcon } from 'lucide-react'
import {
  SlidersHorizontal,
  Users,
  UsersRound,
  UserCog,
  ListTodo,
  Boxes,
  LayoutDashboard,
  Shield,
  Building2,
  MapPin,
  Settings,
  Briefcase,
  BadgeCheck,
  Layers,
  ClipboardList,
  Activity,
  Target,
  ScrollText,
  Package,
  PackageMinus,
  Truck,
  ScanBarcode,
  ClipboardCheck,
  Wrench,
  NotebookPen,
  FolderOpen,
  ChartColumn,
  FileBarChart,
  ShoppingCart,
  FileSignature,
  Receipt,
} from 'lucide-react'

// A proto page renders one of these looks so placeholders resemble the real screen they will become.
export type ProtoVariant = 'dashboard' | 'table' | 'list' | 'calendar'

export type AppMenuItem = {
  title: string
  slug: string // empty string = the app home
  icon?: LucideIcon
  variant?: ProtoVariant
  /** A count shown at the right edge; `tone` colours it (plain by default). */
  badge?: { value: string | number; tone?: 'risk' | 'warning' }
  /** Search params the link carries (saved views preset a filter / query). */
  search?: Record<string, string>
}
export type AppMenuSection = { title?: string; items: AppMenuItem[] }

export type AppDef = {
  slug: string
  name: string
  description: string
  icon: LucideIcon
  menu: AppMenuSection[]
}

// The apps hosted by the workspace shell, in the order they appear on the Home honeycomb (the
// first eight get a tile; the rest are reachable from the switcher). Pages are prototypes for
// now (see src/proto): replacing one with a real screen is a one-line change in its route.
// Archived apps (Staff Hub, Calendar, Finance) live in src/_archive.
export const APPS: AppDef[] = [
  {
    slug: 'control-centre',
    name: 'Control Centre',
    description: 'Configure your workspace',
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
    slug: 'tasks',
    name: 'Task',
    description: 'Plan & track work',
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
    slug: 'inventory',
    name: 'Inventory',
    description: 'Track & manage inventory',
    icon: Boxes,
    // the design's rail: counts on the right, low stock and requests coloured, plus saved views
    menu: [
      {
        title: 'Inventory',
        items: [
          { title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' },
          { title: 'All items', slug: 'items', icon: Package, variant: 'table', badge: { value: 10 } },
          { title: 'Low stock', slug: 'low-stock', icon: PackageMinus, variant: 'table', badge: { value: 4, tone: 'risk' } },
          { title: 'Purchase orders', slug: 'purchase-orders', icon: FileSignature, variant: 'table', badge: { value: 4 } },
          { title: 'Suppliers', slug: 'suppliers', icon: Truck, variant: 'table' },
          { title: 'Requests & approvals', slug: 'requests', icon: ClipboardCheck, variant: 'table', badge: { value: 5, tone: 'warning' } },
          { title: 'Reports', slug: 'reports', icon: FileBarChart, variant: 'dashboard' },
          { title: 'Settings & permissions', slug: 'settings', icon: Settings, variant: 'dashboard' },
        ],
      },
      {
        title: 'My views',
        items: [
          { title: 'Site store · below reorder', slug: 'items', search: { filter: 'Low stock', q: 'Site store' }, badge: { value: 1 } },
          { title: 'Issued to my team', slug: 'items', search: { filter: 'Issued' }, badge: { value: 8 } },
          { title: 'On order', slug: 'items', search: { filter: 'On order' }, badge: { value: 1 } },
        ],
      },
    ],
  },
  {
    slug: 'asset',
    name: 'Asset',
    description: 'Register & verify assets',
    icon: ScanBarcode,
    menu: [
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'Register',
        items: [
          { title: 'Assets', slug: 'assets', icon: Layers, variant: 'table' },
          { title: 'Verifications', slug: 'verifications', icon: ClipboardCheck, variant: 'list' },
          { title: 'Maintenance', slug: 'maintenance', icon: Wrench, variant: 'table' },
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
          { title: 'All Notes', slug: '', icon: NotebookPen, variant: 'list' },
          { title: 'Folders', slug: 'folders', icon: FolderOpen, variant: 'list' },
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
          { title: 'People', slug: '', icon: Users, variant: 'table' },
          { title: 'Teams', slug: 'teams', icon: UsersRound, variant: 'list' },
          { title: 'Departments', slug: 'departments', icon: Building2, variant: 'list' },
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
    slug: 'analytics',
    name: 'Analytics',
    description: 'Reports & insights',
    icon: ChartColumn,
    menu: [
      {
        items: [
          { title: 'Dashboards', slug: '', icon: LayoutDashboard, variant: 'dashboard' },
          { title: 'Reports', slug: 'reports', icon: FileBarChart, variant: 'table' },
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
      { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, variant: 'dashboard' }] },
      {
        title: 'Purchasing',
        items: [
          { title: 'Goods Requests', slug: 'requests', icon: ClipboardList, variant: 'table' },
          { title: 'Purchase Orders', slug: 'purchase-orders', icon: FileSignature, variant: 'table' },
          { title: 'Invoices', slug: 'invoices', icon: Receipt, variant: 'table' },
        ],
      },
      { items: [{ title: 'Suppliers', slug: 'suppliers', icon: Truck, variant: 'table' }] },
    ],
  },
]

export function getApp(slug: string): AppDef | undefined {
  return APPS.find((a) => a.slug === slug)
}

export function findMenuItem(app: AppDef, section: string): AppMenuItem | undefined {
  return app.menu.flatMap((s) => s.items).find((i) => i.slug === section)
}
