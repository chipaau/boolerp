import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">go-erp · Operator Console</h1>
      <p className="text-muted-foreground">apps/admin · admin.bool.test</p>
      <Button>Operator action</Button>
    </div>
  )
}
