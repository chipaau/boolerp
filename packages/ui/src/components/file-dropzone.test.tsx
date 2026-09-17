import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { acceptLabel, FileChip, FileDropzone, fileAccepted, formatBytes } from "@workspace/ui/components/file-dropzone"

const MB = 1024 * 1024
const make = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type })
  Object.defineProperty(f, "size", { value: size })
  return f
}

function Controlled(props: Partial<React.ComponentProps<typeof FileDropzone>> & { spy?: (f: File) => void }) {
  const [file, setFile] = React.useState<File | null>(null)
  return (
    <FileDropzone
      file={file}
      onFile={(f) => {
        setFile(f)
        props.spy?.(f)
      }}
      onClear={() => setFile(null)}
      accept={[".jpg", ".png", ".pdf", "image/jpeg", "image/png", "application/pdf"]}
      maxBytes={10 * MB}
      label="Drop the slip here"
      hint="JPG, PNG or PDF, up to 10 MB"
      aria-label="Upload slip"
      {...props}
    />
  )
}

const zone = () => screen.getByRole("button", { name: "Upload slip" })
const input = () => screen.getByTestId("file-dropzone-input") as HTMLInputElement

describe("helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(812)).toBe("812 B")
    expect(formatBytes(48 * 1024)).toBe("48 KB")
    expect(formatBytes(2.4 * MB)).toBe("2.4 MB")
    expect(formatBytes(10 * MB)).toBe("10 MB")
  })
  it("matches extensions, exact MIME types and families; empty accepts anything", () => {
    expect(fileAccepted({ name: "SLIP.JPG", type: "" }, [".jpg"])).toBe(true)
    expect(fileAccepted({ name: "a.bin", type: "application/pdf" }, ["application/pdf"])).toBe(true)
    expect(fileAccepted({ name: "a", type: "image/webp" }, ["image/*"])).toBe(true)
    expect(fileAccepted({ name: "a.txt", type: "text/plain" }, [".csv", "image/*"])).toBe(false)
    expect(fileAccepted({ name: "a.txt", type: "text/plain" }, [])).toBe(true)
  })
  it("labels the accepted extensions", () => {
    expect(acceptLabel([".jpg", ".png", ".pdf", "image/png"])).toBe("JPG, PNG or PDF")
    expect(acceptLabel([".csv"])).toBe("CSV")
    expect(acceptLabel(["text/csv"])).toBe("")
  })
})

describe("FileDropzone", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:thumb")
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => vi.restoreAllMocks())

  it("shows the label and hint while empty", () => {
    render(<Controlled />)
    expect(zone()).toHaveTextContent("Drop the slip here or browse")
    expect(screen.getByText("JPG, PNG or PDF, up to 10 MB")).toBeInTheDocument()
    expect(input().accept).toBe(".jpg,.png,.pdf,image/jpeg,image/png,application/pdf")
  })

  it("opens the browser on click, Enter and Space, but not other keys", async () => {
    render(<Controlled />)
    const click = vi.spyOn(input(), "click")
    await userEvent.click(zone())
    zone().focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    await userEvent.keyboard("a")
    expect(click).toHaveBeenCalledTimes(3)
  })

  it("takes a browsed image, previews a thumbnail, and clears it", async () => {
    const spy = vi.fn()
    const { unmount } = render(<Controlled spy={spy} />)
    fireEvent.change(input(), { target: { files: [make("slip.png", "image/png", 48 * 1024)] } })
    expect(spy).toHaveBeenCalledOnce()
    expect(zone()).toHaveTextContent("slip.png")
    expect(screen.getByText("Drop another file or click to replace it")).toBeInTheDocument()
    expect(document.querySelector("img")).toHaveAttribute("src", "blob:thumb")
    expect(screen.getByRole("link", { name: "slip.png" })).toHaveAttribute("href", "blob:thumb")
    expect(screen.getByText("48 KB")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Remove slip.png" }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumb")
    expect(zone()).toHaveTextContent("Drop the slip here or browse")
    unmount()
  })

  it("shows a PDF chip for a dropped PDF, with no thumbnail", () => {
    render(<Controlled />)
    fireEvent.dragOver(zone())
    expect(zone()).toHaveAttribute("data-over", "true")
    fireEvent.dragLeave(zone())
    expect(zone()).not.toHaveAttribute("data-over")
    fireEvent.dragOver(zone())
    fireEvent.drop(zone(), { dataTransfer: { files: [make("slip.pdf", "application/pdf", 2.4 * MB)] } })
    expect(zone()).not.toHaveAttribute("data-over")
    expect(screen.getByText("PDF")).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("rejects the wrong type and oversize files with a clear message", () => {
    const onReject = vi.fn()
    const spy = vi.fn()
    render(<Controlled spy={spy} onReject={onReject} />)
    fireEvent.drop(zone(), { dataTransfer: { files: [make("notes.txt", "text/plain")] } })
    expect(screen.getByRole("alert")).toHaveTextContent("notes.txt is not a JPG, PNG or PDF file.")
    expect(zone()).toHaveAttribute("aria-invalid", "true")
    fireEvent.drop(zone(), { dataTransfer: { files: [make("big.jpg", "image/jpeg", 12 * MB)] } })
    expect(screen.getByRole("alert")).toHaveTextContent("big.jpg is 12 MB; the limit is 10 MB.")
    expect(onReject).toHaveBeenCalledTimes(2)
    expect(spy).not.toHaveBeenCalled()
    fireEvent.drop(zone(), { dataTransfer: { files: [make("ok.jpg", "image/jpeg")] } })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(spy).toHaveBeenCalledOnce()
  })

  it("rejects without a callback, using a generic message when no extensions are listed", () => {
    render(<Controlled accept={["text/csv"]} />)
    fireEvent.drop(zone(), { dataTransfer: { files: [make("a.png", "image/png")] } })
    expect(screen.getByRole("alert")).toHaveTextContent("a.png is not a file type this accepts.")
  })

  it("ignores an empty selection and works with defaults and no preview", () => {
    const onFile = vi.fn()
    const { rerender } = render(<FileDropzone file={null} onFile={onFile} />)
    const z = screen.getByRole("button", { name: "Upload a file" })
    expect(z).toHaveTextContent("Drop a file here or browse")
    expect(input()).not.toHaveAttribute("accept")
    fireEvent.change(input(), { target: { files: [] } })
    expect(onFile).not.toHaveBeenCalled()
    fireEvent.drop(z, { dataTransfer: { files: [make("huge.bin", "", 50 * MB)] } })
    expect(onFile).toHaveBeenCalledOnce()
    rerender(<FileDropzone file={make("x.png", "image/png")} onFile={onFile} preview={false} />)
    expect(document.querySelector('[data-slot="file-chip"]')).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

describe("FileChip", () => {
  it("shows a paperclip for other files, a plain name without a url, and no remove button by default", () => {
    render(<FileChip name="data.csv" mimeType="text/csv" sizeBytes={812} />)
    expect(screen.getByText("data.csv").tagName).toBe("SPAN")
    expect(screen.getByText("812 B")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })
  it("does not show a thumbnail for an image without a url", () => {
    render(<FileChip name="slip.jpg" mimeType="image/jpeg" sizeBytes={10} />)
    expect(document.querySelector("img")).toBeNull()
  })
})
