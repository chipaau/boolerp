"use client"

import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import { Bold, Italic, List, ListOrdered, Undo2 } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/**
 * A small Tiptap editor in the theme: bold, italic, lists and undo, HTML in and out. `value` is
 * the document as HTML; `onChange` receives it after every edit. The field looks like the other
 * filled inputs (Soft Cream plate, no border) and the prose styles live in globals.css (.tiptap).
 */
function RichText({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  className,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder ?? "" })],
    content: value,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  })

  // keep the document in step when the caller resets the value (a dialog re-opening)
  useEffect(() => {
    if (value !== editor.getHTML() && !(value === "" && editor.isEmpty)) editor.commands.setContent(value, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(),
    }),
  })

  return (
    <div data-slot="rich-text" className={cn("rounded-[10px] bg-surface-band", className)}>
      <div className="flex items-center gap-0.5 border-b border-divider px-2 py-1.5">
        <Tool label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </Tool>
        <Tool label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </Tool>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-divider" />
        <Tool label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </Tool>
        <Tool label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </Tool>
        <span className="flex-1" />
        <Tool label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </Tool>
      </div>
      <EditorContent editor={editor} className="px-[13px] py-[11px] text-compact leading-[1.6] text-foreground" />
    </div>
  )
}

function Tool({ label, active = false, disabled = false, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("size-7 rounded-[7px] hover:translate-y-0 [&_svg:not([class*='size-'])]:size-[15px]", active ? "bg-primary text-foreground hover:bg-primary" : "text-muted-foreground")}
    >
      {children}
    </Button>
  )
}

export { RichText }
