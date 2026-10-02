import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useAvatarChoices, useSetAvatar } from './queries'

/**
 * Change the photo behind the topbar avatar: upload your own (read locally, shown at once) or
 * pick one of the workspace's portraits; "Just my initials" clears it.
 *
 * Save updates this tab only. The photo is held in the query cache, not on the identity, so it does
 * not reach another tab or the operator console and does not survive a reload — the copy below says
 * so rather than promising otherwise. It becomes a real claim once the picture lives on the Kratos
 * identity beside the name and e-mail, which is the only place both apps can read it from.
 */
export function AvatarDialog({ open, name, current, onClose }: { open: boolean; name: string; current?: string; onClose: () => void }) {
  const choices = useAvatarChoices()
  const setAvatar = useSetAvatar()
  const toast = useToast()
  const [pick, setPick] = useState<string | undefined>(current)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPick(current)
      setUploaded(null)
    }
  }, [open, current])

  function onFile(f: File | undefined) {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast('That file is not an image', { ok: false })
      return
    }
    if (f.size > 4 * 1024 * 1024) {
      toast('Keep it under 4 MB', { ok: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      setUploaded(src)
      setPick(src)
    }
    reader.readAsDataURL(f)
  }

  async function save() {
    await setAvatar.mutateAsync(pick)
    onClose()
    toast(pick ? 'Photo updated' : 'Back to your initials')
  }

  const Option = ({ src, label, selected, onClick }: { src?: string; label: string; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={cn('grid place-items-center rounded-full p-[3px] outline-none transition-[box-shadow,transform] duration-instant hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring', selected && 'shadow-[0_0_0_2px_var(--brand-soft)]')}
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
            <DialogDescription className="mt-1 text-compact text-muted-foreground">Shown beside your name in the topbar.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-4 rounded-xl bg-surface-band px-4 py-3.5">
            <Avatar name={name} className="size-16">
              {pick && <AvatarImage src={pick} alt="" />}
              <AvatarFallback className="text-base" />
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-ui-sm font-bold text-foreground">Upload your own</div>
              <div className="mt-0.5 text-fine text-faint">Square works best · JPG, PNG or WebP · under 4 MB</div>
            </div>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
              <Upload className="size-3.5" strokeWidth={1.75} />
              Choose file
            </Button>
          </div>

          <div className="mt-5 mb-2.5 text-meta font-bold text-muted-foreground">Or pick one of ours</div>
          <div className="flex flex-wrap items-center gap-2.5">
            {uploaded && <Option src={uploaded} label="Your upload" selected={pick === uploaded} onClick={() => setPick(uploaded)} />}
            {choices.map((c) => (
              <Option key={c.id} src={c.src} label={c.label} selected={pick === c.src} onClick={() => setPick(c.src)} />
            ))}
            <Option label="Just my initials" selected={pick === undefined} onClick={() => setPick(undefined)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-[18px]">
          <span className="text-meta text-muted-foreground">{pick === undefined ? 'Your initials, in the workspace colours' : 'Applies here now · not saved to your account yet, so it resets when you reload'}</span>
          <div className="flex items-center gap-[9px]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={setAvatar.isPending}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
