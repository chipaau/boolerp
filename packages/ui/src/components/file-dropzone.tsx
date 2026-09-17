"use client"

import * as React from "react"
import { CloudUpload, FileText, Paperclip, X } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** "812 B", "48 KB", "2.4 MB". */
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`
}

/**
 * Whether `file` matches an `accept` list: `.ext` entries match the name, `type/sub` entries the
 * MIME type, and `type/*` a whole family. An empty list accepts anything.
 */
function fileAccepted(file: Pick<File, "name" | "type">, accept: string[]) {
  if (!accept.length) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return accept.some((a) => {
    const rule = a.trim().toLowerCase()
    if (rule.startsWith(".")) return name.endsWith(rule)
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/** "JPG, PNG or PDF" from the `.ext` entries of an accept list. */
function acceptLabel(accept: string[]) {
  const exts = [...new Set(accept.filter((a) => a.startsWith(".")).map((a) => a.slice(1).toUpperCase()))]
  if (exts.length < 2) return exts[0] ?? ""
  return `${exts.slice(0, -1).join(", ")} or ${exts.at(-1)}`
}

type FileChipProps = Omit<React.ComponentProps<"div">, "children"> & {
  name: string
  mimeType: string
  sizeBytes: number
  /** Where the file can be seen (object URL or signed link). Images show a thumbnail; the name links to it. */
  url?: string
  /** Shows a remove button. */
  onRemove?: () => void
}

/** A chosen or stored file: thumbnail for JPG/PNG, a PDF chip for PDFs, a paperclip otherwise. */
function FileChip({ name, mimeType, sizeBytes, url, onRemove, className, ...props }: FileChipProps) {
  const image = /^image\/(jpeg|png)$/.test(mimeType)
  const pdf = mimeType === "application/pdf"
  return (
    <div data-slot="file-chip" className={cn("flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5", className)} {...props}>
      {image && url ? (
        <img src={url} alt="" className="size-11 shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <span aria-hidden="true" className={cn("grid size-11 shrink-0 place-items-center rounded-lg text-fine font-bold", pdf ? "bg-tone-risk-soft text-tone-risk-foreground" : "bg-surface-band text-faint")}>
          {pdf ? (
            <span className="flex flex-col items-center gap-0.5">
              <FileText className="size-4" strokeWidth={1.8} />
              PDF
            </span>
          ) : (
            <Paperclip className="size-4" strokeWidth={1.8} />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="block truncate rounded text-ui-sm font-bold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {name}
          </a>
        ) : (
          <span className="block truncate text-ui-sm font-bold text-foreground">{name}</span>
        )}
        <span className="mt-0.5 block text-caption text-faint tabular-nums">{formatBytes(sizeBytes)}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint outline-none transition-colors duration-instant hover:bg-surface-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}

type FileDropzoneProps = {
  /** The chosen file, or null. The parent owns it. */
  file: File | null
  /** Called with a file that passed the accept and size checks. */
  onFile: (file: File) => void
  /** Called when the preview's remove button is pressed; omit to hide the button. */
  onClear?: () => void
  /** Extensions (`.pdf`) and/or MIME types (`image/png`, `image/*`). Empty = anything. */
  accept?: string[]
  /** Largest file allowed, in bytes. */
  maxBytes?: number
  /** What to drop, e.g. "Drop a CSV here". "or browse" is appended. */
  label?: React.ReactNode
  /** Line under the label while empty, e.g. "JPG, PNG or PDF, up to 10 MB". */
  hint?: React.ReactNode
  /** Show the chosen file under the zone (thumbnail / PDF chip). Defaults to true. */
  preview?: boolean
  /** Also told about a rejected file; the message is shown under the zone either way. */
  onReject?: (message: string) => void
  /** Accessible name of the zone. */
  "aria-label"?: string
  className?: string
}

/**
 * Drop or browse for one file. Checks type and size before handing it over, says why a file was
 * turned away, and previews the choice. Keyboard: Enter or Space opens the file browser.
 */
function FileDropzone({ file, onFile, onClear, accept = [], maxBytes, label = "Drop a file here", hint, preview = true, onReject, "aria-label": ariaLabel = "Upload a file", className }: FileDropzoneProps) {
  const input = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const [error, setError] = React.useState("")
  const [url, setUrl] = React.useState<string>()

  const showThumb = preview && !!file && /^image\/(jpeg|png)$/.test(file.type)
  React.useEffect(() => {
    if (!showThumb || !file) return setUrl(undefined)
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file, showThumb])

  function take(f: File | undefined) {
    if (!f) return
    let message = ""
    if (!fileAccepted(f, accept)) {
      const kinds = acceptLabel(accept)
      message = kinds ? `${f.name} is not a ${kinds} file.` : `${f.name} is not a file type this accepts.`
    } else if (maxBytes !== undefined && f.size > maxBytes) {
      message = `${f.name} is ${formatBytes(f.size)}; the limit is ${formatBytes(maxBytes)}.`
    }
    setError(message)
    if (message) return onReject?.(message)
    onFile(f)
  }
  const browse = () => input.current?.click()

  return (
    <div data-slot="file-dropzone" className={cn("flex flex-col gap-2.5", className)}>
      <input
        ref={input}
        type="file"
        accept={accept.join(",") || undefined}
        className="hidden"
        data-testid="file-dropzone-input"
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-invalid={!!error || undefined}
        data-over={over || undefined}
        onClick={browse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            browse()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files[0])
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-7 text-center outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring",
          over ? "border-ring bg-surface-soft" : error ? "border-tone-risk bg-surface-band hover:bg-surface-soft" : "border-border bg-surface-band hover:bg-surface-soft"
        )}
      >
        <CloudUpload className="size-7 text-faint" strokeWidth={1.6} />
        <div className="text-ui-sm font-bold text-foreground">
          {file ? (
            file.name
          ) : (
            <>
              {label} or <span className="underline underline-offset-2">browse</span>
            </>
          )}
        </div>
        <div className="text-caption text-faint">{file ? "Drop another file or click to replace it" : hint}</div>
      </div>
      {error && (
        <div role="alert" className="text-compact text-tone-danger-foreground">
          {error}
        </div>
      )}
      {preview && file && <FileChip name={file.name} mimeType={file.type} sizeBytes={file.size} url={url} onRemove={onClear} />}
    </div>
  )
}

export { FileDropzone, FileChip, fileAccepted, formatBytes, acceptLabel }
export type { FileDropzoneProps, FileChipProps }
