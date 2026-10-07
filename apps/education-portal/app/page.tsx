import { headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

/**
 * A placeholder, deliberately: this scaffolds the app, its theme and its place in CI, and nothing is
 * yet decided about what the education portal shows. Writing course listings or a sign-in here would
 * put a product in the repository ahead of anyone agreeing it.
 *
 * It does show the one thing that makes a portal different from FindCare: the page is per tenant.
 * One codebase serves every institution (C132), and which institution a request belongs to comes
 * from its host through the domain lookup (C131), never from anything the browser claims. That
 * lookup is not wired yet, so the host is shown raw and labelled as unresolved — a tenant name here
 * that was not resolved through the lookup would be exactly the lie this page must not tell.
 */
export default async function Home() {
  const host = (await headers()).get('host') ?? 'unknown'

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Bool</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Education portal</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>
            The Next.js app, its theme and its checks are in place. What this portal shows, and who
            signs in to it, is still to be decided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Reached on</dt>
            <dd className="font-mono">{host}</dd>
            <dt className="text-muted-foreground">Tenant</dt>
            <dd>not resolved — the host lookup is not wired yet</dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  )
}
