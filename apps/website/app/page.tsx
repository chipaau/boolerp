import { Button } from '@workspace/ui/components/button'

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Bool ERP</h1>
      <p className="text-muted-foreground">apps/website · marketing (Next.js)</p>
      <Button>Get started</Button>
    </main>
  )
}
