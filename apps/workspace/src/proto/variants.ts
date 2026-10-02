// PROTOTYPE UI — which placeholder look each unbuilt section gets, keyed "app/section" ('' = the
// app home). Lives here, not in the app registry, so deleting src/proto leaves no trace there.
// Defaults: an app home looks like a dashboard, every other section like a table.

export type ProtoVariant = 'dashboard' | 'table' | 'list' | 'calendar'

const EXCEPTIONS: Record<string, ProtoVariant> = {
  'control-centre/org-units': 'list',
  'control-centre/settings': 'dashboard',
  'tasks/my-tasks': 'list',
  'tasks/activities': 'list',
  'tasks/service-charter': 'list',
  'inventory/reports': 'dashboard',
  'inventory/settings': 'dashboard',
  'asset/verifications': 'list',
  'notes/': 'list',
  'notes/folders': 'list',
  'directory/': 'table',
  'directory/teams': 'list',
  'directory/departments': 'list',
  'hrms/job-classifications': 'list',
  'hrms/org-units': 'list',
  'hrms/settings': 'dashboard',
}

export function variantFor(app: string, section: string): ProtoVariant {
  return EXCEPTIONS[`${app}/${section}`] ?? (section === '' ? 'dashboard' : 'table')
}
