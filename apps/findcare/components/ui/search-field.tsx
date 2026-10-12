import { Search } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/** The white search pill: an icon, the field, and an optional trailing control. */
export function SearchField({ trailing, className, placeholder = 'Doctor name or specialty', ...props }: Omit<ComponentProps<'input'>, 'type'> & { trailing?: ReactNode }) {
  return (
    <label
      className={cn(
        'flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white pr-2 pl-[18px] shadow-soft focus-within:ring-2 focus-within:ring-indigo-500/40',
        className,
      )}
    >
      <Search aria-hidden className="size-[15px] shrink-0 text-indigo-500" strokeWidth={1.8} />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {trailing}
    </label>
  )
}
