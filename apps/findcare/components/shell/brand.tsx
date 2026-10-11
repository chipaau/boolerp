import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@workspace/ui/lib/utils'
import mark from '@/app/assets/findcare-mark.png'
import { routes } from '@/lib/routes'

/** The FindCare mark and wordmark. It always leads to Find care, the front door, signed in or not. */
export function Brand({ className }: { className?: string }) {
  return (
    <Link href={routes.find()} aria-label="FindCare, find care" className={cn('wordmark flex items-center gap-2.5 text-ink-900 no-underline', className)}>
      <Image src={mark} alt="" width={34} height={34} priority className="size-[34px]" />
      FindCare
    </Link>
  )
}
