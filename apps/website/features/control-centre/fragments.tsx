import { ArrowRight, CircleAlert, GitBranch, UserMinus } from 'lucide-react'

/**
 * The hero's picture: not the app's screens (which would hand over the whole interface) but three
 * pieces of what Control Centre does, drawn small on a dark stage, each floating gently: what needs
 * attention, an approval chain, and one person's exit reaching the apps. The data is the demo
 * workspace's.
 */
export function Fragments() {
  return (
    <div aria-hidden="true" className="cc-stage relative min-h-[30rem] overflow-hidden rounded-3xl bg-[#2a2622] p-6 sm:p-10">
      <div className="cc-stage-grid pointer-events-none absolute inset-0" />

      {/* what needs attention */}
      <div className="cc-float relative w-full max-w-[22rem] rounded-2xl bg-[#fbf5ec] p-5 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)]">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/55">
          <CircleAlert className="size-3.5 text-(--brand)" strokeWidth={2} /> Needs attention
        </p>
        <ul className="mt-3 grid gap-2 text-[13.5px]">
          <li className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
            <span className="text-foreground">Exited, still holding access</span>
            <span className="rounded-full bg-(--brand-soft)/20 px-2.5 py-0.5 text-[11.5px] font-bold text-[#b45f12]">Revoke</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
            <span className="text-foreground">Bins near capacity</span>
            <span className="text-foreground/50 tabular-nums">2</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
            <span className="text-foreground">Overdue invoice</span>
            <span className="text-foreground/50 tabular-nums">1</span>
          </li>
        </ul>
      </div>

      {/* an approval chain */}
      <div className="cc-float cc-float-2 relative mt-6 ml-auto w-full max-w-[27rem] rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-[#f6eee3] backdrop-blur-sm sm:-mt-6">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <GitBranch className="size-4 text-(--brand-soft)" strokeWidth={1.8} /> Capital spend
          </p>
          <span className="rounded-full bg-(--brand-soft)/20 px-2.5 py-0.5 text-[11.5px] font-bold text-(--brand-soft)">Above MVR 400,000</span>
        </div>
        <ol className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
          {['Unit lead', 'Claudia Reyes', 'Ada Whitfield'].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="size-3.5 text-white/35" strokeWidth={1.8} />}
              <span className="rounded-full border border-white/15 px-3 py-1">
                <span className="text-white/45">{i + 1}.</span> {step}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-white/45">Used by Inventory · purchase over budget</p>
      </div>

      {/* one exit, reaching the apps */}
      <div className="cc-float cc-float-3 relative mt-6 flex max-w-[20rem] items-start gap-3 rounded-2xl bg-[#fbf5ec] p-4 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)] sm:-mt-2 sm:ml-[12%]">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-(--brand-soft)/20 text-(--brand)">
          <UserMinus className="size-4" strokeWidth={1.8} />
        </span>
        <span>
          <span className="block text-[13.5px] font-bold text-foreground">Hugo Fernández exited</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-foreground/65">Site access revoked in Inventory and Scan</span>
        </span>
      </div>
    </div>
  )
}
