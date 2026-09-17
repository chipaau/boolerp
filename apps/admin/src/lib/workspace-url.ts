// Where the tenant workspace (apps/app) lives, derived from the console's own origin:
// admin.bool.test → bool.test. The operator has no tenant subdomain of their own, so this lands on
// the workspace root, which routes them through its own sign-in and tenant picker.
export function workspaceUrl(path = '/'): string {
  const { protocol, hostname, port } = window.location
  const host = hostname.replace(/^admin\./, '')
  return `${protocol}//${host}${port ? `:${port}` : ''}${path}`
}
