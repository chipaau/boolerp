import { Button } from '@workspace/ui/components/button'

// Asks before a logout that no app started (see ../route.ts): a link to Hydra's logout can
// come from any site. The answer is posted back to /logout, which only this site can do.
export default async function Page({ searchParams }: { searchParams: Promise<{ logout_challenge?: string }> }) {
  const { logout_challenge: challenge } = await searchParams
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <form method="post" action="/logout" className="flex w-full max-w-[408px] flex-col gap-[13px]">
        <h1 className="text-2xl font-bold text-foreground">Sign out of Bool?</h1>
        <p className="text-ui-sm text-muted-foreground">You will be signed out of every Bool service in this browser.</p>
        <input type="hidden" name="logout_challenge" value={challenge ?? ''} />
        <Button type="submit" name="action" value="logout" className="h-[52px] w-full text-ui">
          Sign out
        </Button>
        <Button type="submit" name="action" value="cancel" variant="secondary" className="h-[52px] w-full bg-card text-ui">
          Stay signed in
        </Button>
      </form>
    </div>
  )
}
