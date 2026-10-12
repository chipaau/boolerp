import type { ComponentType } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { AppleMark, FacebookMark, GoogleMark } from './brand-marks'

export type Provider = 'Google' | 'Apple' | 'Facebook'

const LIGHT = 'bg-white text-ink-900 shadow-[inset_0_0_0_1px_var(--line-3),var(--shadow-soft)] hover:shadow-[var(--ring-outline-hover),var(--shadow-soft-hover)]'

const PROVIDERS: { id: Provider; Mark: ComponentType; tone: string }[] = [
  { id: 'Google', Mark: GoogleMark, tone: LIGHT },
  { id: 'Apple', Mark: AppleMark, tone: 'bg-ink-900 text-white hover:bg-black' },
  { id: 'Facebook', Mark: FacebookMark, tone: LIGHT },
]

/**
 * The first step's three choices. A linked provider signs straight in; otherwise the flow asks for
 * the mobile number next. Each label is centred as a block, with the marks in a fixed column so
 * the three icons, and the three labels, line up.
 */
export function ProviderButtons({ onProvider }: { onProvider: (p: Provider) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {PROVIDERS.map(({ id, Mark, tone }) => (
        <button
          key={id}
          type="button"
          onClick={() => onProvider(id)}
          className={cn(
            'flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full text-[14px] font-medium transition-[background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
            tone,
          )}
        >
          <span className="grid w-[204px] grid-cols-[18px_1fr] items-center gap-3 text-left whitespace-nowrap">
            <span className="flex justify-center">
              <Mark />
            </span>
            Continue with {id}
          </span>
        </button>
      ))}
    </div>
  )
}
