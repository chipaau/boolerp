"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { useToast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

/** A picture the person may choose: `id` is what is saved, `url` what the avatar shows. */
export type PhotoChoice = { id: string; url: string; label: string }

/** What the current picture is when it is none of the choices (such as a Google profile photo). */
const KEEP = "keep"

/**
 * Change the photo behind the account menu's avatar: one of the platform's portraits, or "Just my
 * initials". The photo belongs to the person's account, not to an app, so every app they sign in to
 * shows the same one (C196); each app passes `onSave`, which saves it there.
 *
 * A picture that is none of the choices (a Google profile photo) shows as the first option, chosen,
 * so opening the dialog and saving changes nothing. Uploading your own waits for file storage.
 */
export function PhotoDialog({
  open,
  name,
  current,
  choices,
  onSave,
  onClose,
}: {
  open: boolean
  name: string
  current?: string
  choices: PhotoChoice[]
  onSave: (portrait: string) => Promise<void>
  onClose: () => void
}) {
  const toast = useToast()
  const initial = !current ? "" : (choices.find((c) => c.url === current)?.id ?? KEEP)
  const [pick, setPick] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setPick(initial)
  }, [open, initial])

  const srcFor = (id: string) => (id === KEEP ? current : choices.find((c) => c.id === id)?.url)

  async function save() {
    setSaving(true)
    try {
      await onSave(pick)
      onClose()
      toast(pick ? "Photo updated in every app" : "Back to your initials")
    } catch {
      toast("Your photo could not be saved. Try again shortly.", { ok: false })
    } finally {
      setSaving(false)
    }
  }

  const Option = ({ src, label, selected, onClick }: { src?: string; label: string; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={cn(
        "grid place-items-center rounded-full p-[3px] outline-none transition-[box-shadow,transform] duration-instant hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
        selected && "shadow-[0_0_0_2px_var(--brand-soft)]",
      )}
    >
      <Avatar name={name} className="size-14">
        {src && <AvatarImage src={src} alt="" />}
        <AvatarFallback className="text-sm" />
      </Avatar>
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Your photo</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">
              Shown beside your name in every app you sign in to.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-4 rounded-xl bg-surface-band px-4 py-3.5">
            <Avatar name={name} className="size-16">
              {srcFor(pick) && <AvatarImage src={srcFor(pick)} alt="" />}
              <AvatarFallback className="text-base" />
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-ui-sm font-bold text-foreground">{name}</div>
              <div className="mt-0.5 text-fine text-faint">Uploading your own photo is coming later</div>
            </div>
          </div>

          <div className="mt-5 mb-2.5 text-meta font-bold text-muted-foreground">Pick one of ours</div>
          <div className="flex flex-wrap items-center gap-2.5">
            {initial === KEEP && <Option src={current} label="Your current photo" selected={pick === KEEP} onClick={() => setPick(KEEP)} />}
            {choices.map((c) => (
              <Option key={c.id} src={c.url} label={c.label} selected={pick === c.id} onClick={() => setPick(c.id)} />
            ))}
            <Option label="Just my initials" selected={pick === ""} onClick={() => setPick("")} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-[18px]">
          <span className="text-meta text-muted-foreground">{pick === "" ? "Your initials, in the workspace colours" : "Saved to your account"}</span>
          <div className="flex items-center gap-[9px]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || pick === initial || pick === KEEP}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
