"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDown, XIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A searchable picker: type to narrow the list, arrows and Enter to choose. Built on Base UI's
 * Combobox, with the same parts as shadcn's base combobox, and drawn like our Select (same plate,
 * popup, highlight and check) so a long list and a short one look alike until you type.
 *
 * Use Select for a handful of fixed choices; reach for this when the list is long enough to search
 * (countries, legal forms, institution types). ComboboxField and ComboboxMultiField below cover the
 * common cases in one tag.
 */

const popupClass =
  "z-50 max-h-[min(var(--available-height),20rem)] max-w-(--available-width) min-w-[var(--anchor-width)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-floating outline-none duration-quick ease-bool data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"

const itemClass =
  "relative flex cursor-default items-center gap-2.5 rounded-md py-2 pr-2.5 pl-8 text-ui text-body outline-hidden select-none transition-colors duration-instant ease-bool data-highlighted:bg-accent data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:text-disabled-foreground"

const plateClass =
  "flex min-h-[34px] w-full items-center gap-1.5 rounded-[9px] bg-surface-band pr-1.5 pl-[11px] text-sm text-foreground transition-[box-shadow,background-color] duration-instant ease-bool focus-within:ring-2 focus-within:ring-ring has-aria-invalid:ring-2 has-aria-invalid:ring-destructive has-disabled:cursor-not-allowed has-disabled:opacity-50"

const Combobox = ComboboxPrimitive.Root

/** The typing field with its chevron (and a clear button when `showClear`), on Select's plate. */
function ComboboxInput({
  className,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & { showClear?: boolean }) {
  return (
    <ComboboxPrimitive.InputGroup data-slot="combobox-input-group" className={cn(plateClass, className)}>
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className="h-[34px] min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-placeholder"
        {...props}
      />
      {showClear && (
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          aria-label="Clear"
          className="grid size-6 shrink-0 place-items-center rounded-md text-faint outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3.5" strokeWidth={2} />
        </ComboboxPrimitive.Clear>
      )}
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        aria-label="Show choices"
        className="grid size-6 shrink-0 place-items-center rounded-md text-faint outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </ComboboxPrimitive.Trigger>
    </ComboboxPrimitive.InputGroup>
  )
}

/** The floating panel. Matches the field's width (or `anchor`'s) and flips above when there is no room below. */
function ComboboxContent({
  className,
  sideOffset = 6,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props & Pick<ComboboxPrimitive.Positioner.Props, "anchor" | "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="isolate z-50 outline-none" sideOffset={sideOffset} anchor={anchor}>
        <ComboboxPrimitive.Popup data-slot="combobox-content" className={cn(popupClass, className)} {...props} />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return <ComboboxPrimitive.List data-slot="combobox-list" className={cn("outline-none data-[empty]:hidden", className)} {...props} />
}

/** One choice; the check sits in the left gutter, as in Select. */
function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item data-slot="combobox-item" className={cn(itemClass, className)} {...props}>
      <ComboboxPrimitive.ItemIndicator className="absolute left-2.5 grid place-items-center">
        <CheckIcon className="size-3.5 text-foreground" strokeWidth={2.4} />
      </ComboboxPrimitive.ItemIndicator>
      {children}
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({ ...props }: ComboboxPrimitive.Group.Props) {
  return <ComboboxPrimitive.Group data-slot="combobox-group" {...props} />
}

function ComboboxGroupLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return <ComboboxPrimitive.GroupLabel data-slot="combobox-group-label" className={cn("px-2.5 py-1.5 text-overline text-faint", className)} {...props} />
}

const ComboboxCollection = ComboboxPrimitive.Collection

/** Shown in place of the list when nothing matches what was typed. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return <ComboboxPrimitive.Empty data-slot="combobox-empty" className={cn("px-2.5 py-2 text-compact text-faint empty:hidden", className)} {...props} />
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return <ComboboxPrimitive.Separator data-slot="combobox-separator" className={cn("-mx-1.5 my-1.5 h-px bg-divider", className)} {...props} />
}

/** The multiple-choice field: the chosen items as chips, then the typing field. */
function ComboboxChips({ className, ...props }: ComboboxPrimitive.Chips.Props) {
  return <ComboboxPrimitive.Chips data-slot="combobox-chips" className={cn(plateClass, "flex-wrap py-1", className)} {...props} />
}

function ComboboxChip({ className, children, ...props }: ComboboxPrimitive.Chip.Props) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn("flex h-6 items-center gap-1 rounded-md bg-card pr-1 pl-2 text-caption font-bold text-foreground shadow-[inset_0_0_0_1px_var(--input)]", className)}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ChipRemove aria-label="Remove" className="grid size-4 place-items-center rounded text-faint outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <XIcon className="size-3" strokeWidth={2.2} />
      </ComboboxPrimitive.ChipRemove>
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chips-input"
      className={cn("h-7 min-w-24 flex-1 bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-placeholder", className)}
      {...props}
    />
  )
}

/** The element a chips field's panel lines up with: pass the ref to ComboboxChips and ComboboxContent's `anchor`. */
function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

/**
 * One choice in the one-tag fields: its value, the label shown and searched, extra words the search
 * also matches (a country's codes), an optional group heading, and a quieter detail line.
 */
export type ComboboxOption = { value: string; label: string; keywords?: string; group?: string; detail?: string; disabled?: boolean }

type Grouped = { label: string; items: ComboboxOption[] }

/** Options in their order, under their group headings in first-seen order; null when none has a group. */
function groupOptions(options: readonly ComboboxOption[]): Grouped[] | null {
  if (!options.some((o) => o.group)) return null
  const groups = new Map<string, ComboboxOption[]>()
  for (const o of options) {
    const key = o.group ?? ""
    groups.set(key, [...(groups.get(key) ?? []), o])
  }
  return [...groups].map(([label, items]) => ({ label, items }))
}

/** Matches the label or the keywords, ignoring case and accents. */
function useOptionFilter() {
  const filter = ComboboxPrimitive.useFilter({ sensitivity: "base" })
  return React.useCallback(
    (o: ComboboxOption, query: string) => filter.contains(o.label, query) || (!!o.keywords && filter.contains(o.keywords, query)),
    [filter]
  )
}

function OptionItem({ option }: { option: ComboboxOption }) {
  return (
    <ComboboxItem value={option} disabled={option.disabled}>
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.detail && <span className="shrink-0 text-caption text-faint">{option.detail}</span>}
    </ComboboxItem>
  )
}

function OptionList({ options, emptyText }: { options: readonly ComboboxOption[]; emptyText: React.ReactNode }) {
  const grouped = groupOptions(options)
  return (
    <>
      <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      <ComboboxList>
        {grouped
          ? (group: Grouped) => (
              <ComboboxGroup key={group.label} items={group.items}>
                {group.label && <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel>}
                <ComboboxCollection>{(o: ComboboxOption) => <OptionItem key={o.value} option={o} />}</ComboboxCollection>
              </ComboboxGroup>
            )
          : (o: ComboboxOption) => <OptionItem key={o.value} option={o} />}
      </ComboboxList>
    </>
  )
}

type FieldProps = {
  options: readonly ComboboxOption[]
  placeholder?: string
  /** Shown when nothing matches what was typed. */
  emptyText?: React.ReactNode
  className?: string
  contentClassName?: string
  disabled?: boolean
  id?: string
  name?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/**
 * The whole searchable picker in one tag, for one choice by value:
 *
 *   <ComboboxField aria-label="Country" value={code} onValueChange={setCode} options={countries} />
 *
 * Options carry an optional `group` (shown under headings), `keywords` (searched too), and `detail`.
 */
function ComboboxField({
  value,
  onValueChange,
  options,
  placeholder,
  emptyText = "No matches.",
  className,
  contentClassName,
  disabled,
  id,
  name,
  ...aria
}: FieldProps & { value: string | null; onValueChange: (value: string | null) => void }) {
  const filter = useOptionFilter()
  const grouped = groupOptions(options)
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <Combobox<ComboboxOption>
      items={grouped ?? options}
      value={selected}
      onValueChange={(o) => onValueChange(o?.value ?? null)}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.value}
      filter={filter}
      disabled={disabled}
      name={name}
      autoHighlight
    >
      <ComboboxInput id={id} placeholder={placeholder} className={className} {...aria} />
      <ComboboxContent className={contentClassName}>
        <OptionList options={options} emptyText={emptyText} />
      </ComboboxContent>
    </Combobox>
  )
}

/** The several-choices picker in one tag: the chosen values as chips, in the order they were picked. */
function ComboboxMultiField({
  value,
  onValueChange,
  options,
  placeholder,
  emptyText = "No matches.",
  className,
  contentClassName,
  disabled,
  id,
  name,
  ...aria
}: FieldProps & { value: readonly string[]; onValueChange: (value: string[]) => void }) {
  const filter = useOptionFilter()
  const anchor = useComboboxAnchor()
  const grouped = groupOptions(options)
  const selected = value.map((v) => options.find((o) => o.value === v)).filter((o): o is ComboboxOption => !!o)
  return (
    <Combobox<ComboboxOption, true>
      multiple
      items={grouped ?? options}
      value={selected}
      onValueChange={(os) => onValueChange(os.map((o) => o.value))}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.value}
      filter={filter}
      disabled={disabled}
      name={name}
      autoHighlight
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxPrimitive.Value>
          {(chosen: ComboboxOption[]) => chosen.map((o) => <ComboboxChip key={o.value}>{o.label}</ComboboxChip>)}
        </ComboboxPrimitive.Value>
        <ComboboxChipsInput id={id} placeholder={selected.length ? undefined : placeholder} {...aria} />
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className={contentClassName}>
        <OptionList options={options} emptyText={emptyText} />
      </ComboboxContent>
    </Combobox>
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  useComboboxAnchor,
  ComboboxField,
  ComboboxMultiField,
}
