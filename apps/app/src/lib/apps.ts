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

export type AppMenuItem = {
  title: string
  slug: string // empty string = the app home
  icon?: LucideIcon
  /**
   * Shows a live count at the right edge, read from the shell's nav counts under `key`
   * (see features/shell); `tone` colours it (plain by default). The registry never holds numbers.
   */
  badge?: { key: string; tone?: 'risk' | 'warning' }
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
// first eight get a tile; the rest are reachable from the switcher). Sections without a real
// screen in features/screens.ts render the prototype page (src/proto) until one exists.
// Archived apps (Staff Hub, Calendar, Finance) live in src/_archive.
export const APPS: AppDef[] = [
  {
    slug: 'control-centre',
    name: 'Control Centre',
    description: 'Configure your workspace',
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
    // the design's rail: counts on the right, low stock and requests coloured, plus saved views
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
      {
        title: 'My views',
        items: [
          { title: 'Site store · below reorder', slug: 'items', search: { filter: 'Low stock', q: 'Site store' }, badge: { key: 'view:site-store-below-reorder' } },
          { title: 'Issued to my team', slug: 'items', search: { filter: 'Issued' }, badge: { key: 'view:issued-to-my-team' } },
          { title: 'On order', slug: 'items', search: { filter: 'On order' }, badge: { key: 'view:on-order' } },
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
          { title: 'Teams', slug: 'teams', icon: UsersRound },
          { title: 'Departments', slug: 'departments', icon: Building2 },
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

export function findMenuItem(app: AppDef, section: string): AppMenuItem | undefined {
  return app.menu.flatMap((s) => s.items).find((i) => i.slug === section)
}
