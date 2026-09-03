"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Avatars are initials on a soft categorical fill; the fill cycles sage → slate → plum by a hash
 * of the name so the same person always gets the same colour. Pass `name` to Avatar (or use
 * `avatarTone(name)` directly) and the fallback picks the tone and the initials.
 */
const TONES = [
  "bg-sage-soft text-sage-soft-foreground",
  "bg-tone-slate-soft text-tone-slate-foreground",
  "bg-tone-plum-soft text-tone-plum-foreground",
] as const

export function avatarTone(name: string | undefined): string {
  let h = 0
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]
}

/** Two-letter initials from a display name. */
export function initialsOf(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "")
  return (first + last).toUpperCase()
}

const AvatarContext = React.createContext<{ name?: string }>({})

function Avatar({
  className,
  size = "default",
  name,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
  /** Display name; drives the fallback tone (and initials when the fallback has no children). */
  name?: string
}) {
  return (
    <AvatarContext.Provider value={{ name }}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        data-size={size}
        className={cn(
          "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, children, ...props }: AvatarPrimitive.Fallback.Props) {
  const { name } = React.useContext(AvatarContext)
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full text-[11px] font-bold group-data-[size=lg]/avatar:text-[13px] group-data-[size=sm]/avatar:text-[9px]",
        avatarTone(name),
        className
      )}
      {...props}
    >
      {children ?? initialsOf(name)}
    </AvatarPrimitive.Fallback>
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-sage text-sage-foreground ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-1.5 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=sm]/avatar-group:text-[9px] [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount }
