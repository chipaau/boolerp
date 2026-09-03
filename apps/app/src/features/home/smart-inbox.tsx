import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { SectionTitle } from '@workspace/ui/components/section-title'
import { cn } from '@workspace/ui/lib/utils'
import { AppIcon } from '@/components/app-icon'
import { INBOX, type InboxItem } from './data'

function InboxRow({ item, index }: { item: InboxItem; index: number }) {
  return (
    // hover: the title steps up from slate to ink and the app plate takes a thin amber ring;
    // nothing changes size, so the row never shifts
    <li className="group flex animate-rise items-center gap-6 py-6" style={{ animationDelay: `${200 + index * 50}ms` }}>
      <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-card transition-shadow duration-instant ease-hexa group-hover:shadow-[inset_0_0_0_1px_var(--brand-soft)]">
        <AppIcon slug={item.app} size={30} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="truncate text-base leading-[1.35] text-body transition-colors duration-instant ease-hexa group-hover:font-bold group-hover:text-foreground">
          {item.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant={item.tag.tone} size="sm">
            {item.tag.label}
          </Badge>
          {item.meta.map((m, i) => (
            <span key={i} className="flex items-center gap-3">
              <span aria-hidden="true" className="h-3.5 w-px bg-border" />
              <span className={cn(m.overdue && 'font-bold text-destructive')}>
                {m.overdue && <span aria-hidden="true">• </span>}
                {m.label}
              </span>
            </span>
          ))}
        </div>
      </div>
      {/* one width for every action so the column of buttons lines up */}
      <Button size="sm" className="w-[6.5rem] justify-between">
        {item.action}
        <ButtonArrow />
      </Button>
    </li>
  )
}

// The action inbox: things that need the user's attention across apps.
export function SmartInbox() {
  return (
    <section>
      <SectionTitle
        action={
          <Button variant="link" size="sm" className="text-muted-foreground no-underline hover:underline">
            View All
          </Button>
        }
      >
        Smart Inbox
      </SectionTitle>
      <ul className="mt-1 divide-y divide-border">
        {INBOX.map((item, i) => (
          <InboxRow key={item.id} item={item} index={i} />
        ))}
      </ul>
    </section>
  )
}
