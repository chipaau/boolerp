import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Stepper, StepperFooter, StepperLayout } from "@workspace/ui/components/stepper"

const steps = [{ title: "Details", hint: "Name and role" }, { title: "Access" }, { title: "Review" }]
const stepButtons = () => screen.getAllByRole("button")

describe("Stepper", () => {
  it("renders the title overline, uses it as the nav label, and marks the current step", () => {
    render(<Stepper title="New employee" steps={steps} current={0} onStep={() => {}} />)
    expect(screen.getByRole("navigation", { name: "New employee" })).toBeInTheDocument()
    expect(screen.getByText("Name and role")).toBeInTheDocument()
    const [first, second] = stepButtons()
    expect(first).toHaveAttribute("aria-current", "step")
    expect(first).toHaveAttribute("data-state", "current")
    expect(second).not.toHaveAttribute("aria-current")
    // complete defaults to true, so later steps are open
    expect(second).toHaveAttribute("data-state", "upcoming")
    expect(second).not.toHaveAttribute("aria-disabled")
  })

  it("falls back to a generic label and is read-only without onStep", async () => {
    render(<Stepper title={<b>Rich</b>} steps={steps} current={1} />)
    expect(screen.getByRole("navigation", { name: "Steps" })).toBeInTheDocument()
    const [first] = stepButtons()
    expect(first).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(first) // no handler: nothing to call, must not throw
  })

  it("renders without a title", () => {
    render(<Stepper steps={steps} current={0} />)
    expect(screen.getByRole("navigation", { name: "Steps" })).toBeInTheDocument()
  })

  it("locks steps past an incomplete one and ignores clicks on them", async () => {
    const user = userEvent.setup()
    const onStep = vi.fn()
    render(<Stepper steps={steps} current={0} complete={(i) => i !== 0} onStep={onStep} />)
    const [first, second, third] = stepButtons()
    expect(second).toHaveAttribute("data-state", "locked")
    expect(second).toHaveAttribute("aria-disabled", "true")
    expect(third).toHaveAttribute("data-state", "locked")
    await user.click(second)
    await user.click(first) // the current step is not re-emitted
    expect(onStep).not.toHaveBeenCalled()
  })

  it("emits clickable steps and shows completed ones", async () => {
    const user = userEvent.setup()
    const onStep = vi.fn()
    const { rerender } = render(<Stepper steps={steps} current={0} onStep={onStep} />)
    rerender(<Stepper steps={steps} current={2} onStep={onStep} />)
    const [first, second] = stepButtons()
    expect(first).toHaveAttribute("data-state", "complete")
    await user.click(second)
    expect(onStep).toHaveBeenCalledWith(1)
  })

  it("keeps reached steps open after going back, even when an earlier step is incomplete", () => {
    const { rerender } = render(<Stepper steps={steps} current={2} complete={() => true} onStep={() => {}} />)
    rerender(<Stepper steps={steps} current={0} complete={(i) => i !== 0} onStep={() => {}} />)
    const [first, second, third] = stepButtons()
    expect(first).toHaveAttribute("data-state", "current")
    expect(second).toHaveAttribute("data-state", "complete")
    expect(third).toHaveAttribute("data-state", "upcoming")
    expect(third).not.toHaveAttribute("aria-disabled")
  })
})

describe("StepperLayout and StepperFooter", () => {
  it("render the rail, body, note and actions", () => {
    render(
      <StepperLayout rail={<span>rail</span>} className="extra">
        <p>body</p>
        <StepperFooter note="All set">
          <button type="button">Save</button>
        </StepperFooter>
      </StepperLayout>
    )
    expect(screen.getByText("rail").closest("aside")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
    expect(screen.getByText("All set")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="stepper-layout"]')).toHaveClass("extra")
  })
})
