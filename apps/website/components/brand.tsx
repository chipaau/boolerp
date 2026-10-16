import Image from 'next/image'
import logo from '@workspace/assets/logos/bool-logo.png'

/** The Bool mark and wordmark (Lato Bold, drawn tight), linking home. */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2.5 font-bold tracking-[-0.03em] text-foreground ${className}`}>
      <Image src={logo} alt="" priority className="h-9 w-auto" />
      Bool
    </a>
  )
}
