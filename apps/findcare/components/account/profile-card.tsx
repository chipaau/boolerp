import { initialsOf } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/status-pill'
import { updateAccount } from '@/lib/data'
import type { Account, Patient } from '@/lib/data'
import { cn } from '@workspace/ui/lib/utils'
import { ACCOUNT_CARD, EditButton } from './parts'

/** The account holder: name and how they signed in, the verified mobile, and text reminders on or off. */
export function ProfileCard({ account, holder, onEdit }: { account: Account; holder: Patient; onEdit: () => void }) {
  const sms = account.notifSms
  return (
    <section className={cn(ACCOUNT_CARD, 'flex flex-col gap-[18px] p-[22px]')}>
      <div className="flex items-center gap-3.5">
        <div aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-indigo-900 text-[16px] font-semibold text-white">
          {initialsOf(holder.name || 'Me')}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold">{holder.name || 'Your account'}</h2>
          <div className="mt-[3px] text-[12.5px] text-ink-600">Signed in with {account.via ?? 'mobile number'}</div>
        </div>
        <EditButton onClick={onEdit} aria-label="Edit your details" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2.5">
        <div className="rounded-[14px] bg-wash-1 px-3.5 py-3">
          <TileLabel>Mobile</TileLabel>
          <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold tabular-nums">
            {account.phone}
            <StatusPill tone="confirmed" className="h-5 px-2 text-[10.5px]">
              Verified
            </StatusPill>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sms}
          aria-label="Text reminders"
          onClick={() => updateAccount(account.id, { notifSms: !sms })}
          className="flex cursor-pointer items-center justify-between gap-2.5 rounded-[14px] bg-wash-1 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span>
            <TileLabel>Text reminders</TileLabel>
            <span className="mt-1 block text-[14px] font-semibold text-ink-900">{sms ? 'On' : 'Off'}</span>
          </span>
          <span aria-hidden className={cn('relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200', sms ? 'bg-indigo-900' : 'bg-[rgba(30,10,24,.15)]')}>
            <span
              className={cn(
                'absolute top-[3px] size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200',
                sms ? 'left-[19px]' : 'left-[3px]',
              )}
            />
          </span>
        </button>
      </div>
    </section>
  )
}

function TileLabel({ children }: { children: string }) {
  return <span className="block text-[9.5px] font-medium tracking-[0.2em] text-ink-500 uppercase">{children}</span>
}
