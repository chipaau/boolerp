import { Card, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

/**
 * A placeholder, deliberately: this scaffolds the app, its routing and its place in CI, and nothing
 * is yet decided about what FindCare's public side says or does. Writing marketing copy here would
 * put claims about a product into the repository ahead of anyone agreeing them — the one thing a
 * scaffold should not do. Replace this page; the shell around it is what this change is for.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Bool</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">FindCare</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>
            The Next.js app, its development host and its checks are in place. What this page says is
            still to be decided.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}
