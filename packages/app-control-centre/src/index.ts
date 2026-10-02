import { Activity, Bell, Building2, CalendarDays, GitBranch, LayoutDashboard, MapPin, Receipt, Settings, Shield, SlidersHorizontal, Users } from 'lucide-react'
import { defineApp } from '@workspace/app-kit'
import { ControlRail } from './rail'

// The Control Centre app (C102): the organisation record every app reads. The shell lists,
// navigates, and guards it from this manifest; its pages are the file routes in src/routes,
// mounted under /control-centre. The data itself is @workspace/org, shared with the other apps.
export const app = defineApp({
  slug: 'control-centre',
  name: 'Control Centre',
  description: 'The record every app reads',
  icon: SlidersHorizontal,
  rail: ControlRail,
  menu: [
    { items: [{ title: 'Overview', slug: '', icon: LayoutDashboard, permission: 'control-centre:overview:view' }] },
    {
      title: 'Organisation',
      items: [
        { title: 'Admin units', slug: 'units', icon: Building2, permission: 'control-centre:unit:view' },
        { title: 'Employees', slug: 'employees', icon: Users, permission: 'control-centre:employee:view' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { title: 'Site types', slug: 'site-types', icon: Shield, permission: 'control-centre:site-type:view' },
        { title: 'Sites', slug: 'sites', icon: MapPin, permission: 'control-centre:site:view' },
      ],
    },
    {
      title: 'System',
      items: [
        { title: 'Approval chains', slug: 'approvals', icon: GitBranch, permission: 'control-centre:approval-chain:view' },
        { title: 'Codes & numbering', slug: 'codes', icon: Settings, permission: 'control-centre:numbering:view' },
        { title: 'Regions', slug: 'regions', icon: MapPin, permission: 'control-centre:region:view' },
        { title: 'Public holidays', slug: 'holidays', icon: CalendarDays, permission: 'control-centre:holiday:view' },
        { title: 'Notifications', slug: 'notifications', icon: Bell, permission: 'control-centre:notification-rule:view' },
        { title: 'Activity log', slug: 'activity', icon: Activity, permission: 'control-centre:activity:view' },
      ],
    },
    {
      title: 'Account',
      items: [{ title: 'Billing & plan', slug: 'billing', icon: Receipt, permission: 'control-centre:billing:view' }],
    },
  ],
})
