import { cn } from "@workspace/ui/lib/utils"

/**
 * The maker's mark, the product's "made with love" line: a small amber hexagon and "Built by Bool"
 * in the overline style. Sits at the foot of the rail and under the sign-in card. Pass `href` to
 * make it a link.
 */
function MadeBy({ by = "Bool", href, className }: { by?: string; href?: string; className?: string }) {
  const Tag = href ? "a" : "span"
  return (
    <Tag
      data-slot="made-by"
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      className={cn("inline-flex items-center gap-2 text-micro font-bold tracking-[0.12em] text-faint uppercase transition-colors duration-instant", href && "hover:text-foreground", className)}
    >
      <span aria-hidden="true" className="block h-[10px] w-[9px] bg-brand-soft [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]" />
      Built by {by}
    </Tag>
  )
}

export { MadeBy }
