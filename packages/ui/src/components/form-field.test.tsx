import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FormErrorBanner, TextField, fieldErrors } from "@workspace/ui/components/form-field"
import type { BoundField } from "@workspace/ui/components/form-field"

function field(over: Partial<BoundField<string>["state"]["meta"]> = {}, value = "") {
  let meta = { errors: [] as unknown[], isTouched: false, errorMap: {} as Record<string, unknown>, ...over }
  const f: BoundField<string> & { meta: () => typeof meta } = {
    name: "slug",
    state: { value, meta },
    handleChange: vi.fn(),
    handleBlur: vi.fn(),
    setMeta: vi.fn((updater) => {
      meta = updater(meta)
    }),
    meta: () => meta,
  }
  return f
}

describe("fieldErrors", () => {
  it("shows nothing until the field is touched, then zod's and the API's messages once each", () => {
    expect(fieldErrors(field({ errors: ["is required"] }) as BoundField<unknown>)).toEqual([])
    expect(
      fieldErrors(field({ isTouched: true, errors: [{ message: "is too short" }, "is already used by X", "is already used by X"] }) as BoundField<unknown>)
    ).toEqual(["is too short", "is already used by X"])
  })
})

describe("TextField", () => {
  it("labels the input, marks it required, and shows its hint until there is an error", () => {
    render(<TextField field={field()} label="Slug" required hint="The tenant's web address" />)
    expect(screen.getByLabelText("Slug")).toBeRequired()
    expect(screen.getByText("Slug")).toHaveAttribute("data-required", "true")
    expect(screen.getByText("The tenant's web address")).toBeInTheDocument()
  })

  it("shows the errors once touched, in place of the hint, and marks the input invalid", () => {
    render(<TextField field={field({ isTouched: true, errors: ["is already used by X"] })} label="Slug" hint="hint" />)
    expect(screen.getByRole("alert")).toHaveTextContent("is already used by X")
    expect(screen.queryByText("hint")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Slug")).toHaveAttribute("aria-invalid", "true")
  })

  it("clears the API's error before passing the change on", async () => {
    const user = userEvent.setup()
    const f = field({ isTouched: true, errors: ["is already used by X"], errorMap: { onServer: "is already used by X" } })
    render(<TextField field={f} label="Slug" />)
    await user.type(screen.getByLabelText("Slug"), "x")
    expect(f.setMeta).toHaveBeenCalled()
    expect(f.meta().errorMap.onServer).toBeUndefined()
    expect(f.handleChange).toHaveBeenCalledWith("x")
  })
})

describe("FormErrorBanner", () => {
  it("shows what no field can, with the request's reference", () => {
    render(<FormErrorBanner errors={{ messages: ["parentId: is not a parent"], reference: "req-1" }} />)
    expect(screen.getByRole("alert")).toHaveTextContent("parentId: is not a parent")
    expect(screen.getByRole("alert")).toHaveTextContent("Reference req-1")
  })

  it("shows nothing when there is nothing to say", () => {
    const { container } = render(<FormErrorBanner errors={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
