"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Our own single-choice picker, replacing the browser's <select>. NativeSelect only ever styled the
 * closed plate — opening one dropped you into the OS menu, which is why a form could look like ours
 * until the moment you used it. This draws the list too: same popover surface, highlight and check
 * as DropdownMenu, so every menu in the product agrees.
 *
 * The closed trigger keeps NativeSelect's look (Soft Cream plate, bold value, small chevron) so the
 * swap is invisible until the list opens.
 */

const popupClass =
  "z-50 max-h-(--available-height) min-w-[var(--anchor-width)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-floating outline-none duration-quick ease-bool data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"

const itemClass =
  "relative flex cursor-default items-center gap-2.5 rounded-md py-2 pr-2.5 pl-8 text-ui text-body outline-hidden select-none transition-colors duration-instant ease-bool data-highlighted:bg-accent data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:text-disabled-foreground"

function Select<T>({ ...props }: SelectPrimitive.Root.Props<T>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

/** The closed plate: bold current value, chevron at the right. */
function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-[34px] w-full items-center justify-between gap-2 rounded-[9px] bg-surface-band pr-2.5 pl-[11px] text-left text-sm font-bold tabular-nums text-foreground outline-none transition-[box-shadow,background-color] duration-instant ease-bool focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-popup-open:ring-2 data-popup-open:ring-ring",
        className
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      <SelectPrimitive.Icon
        render={<ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-faint" strokeWidth={2} />}
      />
    </SelectPrimitive.Trigger>
  )
}

/** Renders the selected item's text, or `placeholder` while nothing is chosen. */
function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

/** The floating list. Matches the trigger's width and flips above when there is no room below. */
function SelectContent({ className, children, sideOffset = 6, ...props }: SelectPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="isolate z-50 outline-none" sideOffset={sideOffset} alignItemWithTrigger={false}>
        <SelectPrimitive.Popup data-slot="select-content" className={cn(popupClass, className)} {...props}>
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

/** One choice. The check sits in the left gutter so labels stay aligned whether or not they are set. */
function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn(itemClass, className)} {...props}>
      <SelectPrimitive.ItemIndicator className="absolute left-2.5 grid place-items-center">
        <CheckIcon className="size-3.5 text-foreground" strokeWidth={2.4} />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="min-w-0 truncate">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

/** Groups items under a heading — the replacement for <optgroup>. */
function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return <SelectPrimitive.GroupLabel data-slot="select-group-label" className={cn("px-2.5 py-1.5 text-overline text-faint", className)} {...props} />
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("-mx-1.5 my-1.5 h-px bg-divider", className)} {...props} />
}

export type SelectOption = string | { value: string; label: React.ReactNode; disabled?: boolean }

const optionValue = (o: SelectOption) => (typeof o === "string" ? o : o.value)
const optionLabel = (o: SelectOption) => (typeof o === "string" ? o : o.label)

/**
 * The whole picker in one tag, for the common case: a flat list of choices.
 *
 *   <SelectField aria-label="Period" value={period} onValueChange={setPeriod} options={PERIODS} />
 *
 * Options are plain strings, or `{ value, label }` when the two differ. Reach for the parts above
 * when the list needs groups or separators.
 */
function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  contentClassName,
  disabled,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  value: string
  onValueChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: React.ReactNode
  className?: string
  contentClassName?: string
  disabled?: boolean
  id?: string
  name?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(String(v ?? ""))} disabled={disabled} name={name}>
      <SelectTrigger id={id} aria-label={ariaLabel} aria-invalid={ariaInvalid} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <SelectItem key={optionValue(o)} value={optionValue(o)} disabled={typeof o === "string" ? undefined : o.disabled}>
            {optionLabel(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectGroupLabel, SelectSeparator, SelectField }
