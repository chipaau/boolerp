import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

/**
 * A short yes/no sheet for one irreversible-feeling action: title, a sentence or two of
 * consequence, Cancel, and the action in terracotta when it removes something.
 */
function ConfirmDialog({
  open,
  title,
  description,
  action,
  danger = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  action: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader className="px-6 pt-[22px] pb-2 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1.5 text-compact leading-[1.55] text-pretty text-body">{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="px-6 pb-2">{children}</div>}
        <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm}>
            {action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
