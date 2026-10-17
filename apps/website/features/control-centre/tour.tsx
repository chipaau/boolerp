'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Activity, ArrowRight, Bell, Check, GitBranch, MapPin, Package } from 'lucide-react'
import { HEX_MASK } from '@/components/hex'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * A sheet for an illustration, in the frosted glass of the site's other cards. Its pieces are placed
 * on it; on phones, too narrow for that, they stack instead (globals.css, .tour-sheet).
 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="tour-sheet glass-card relative aspect-[5/4] w-full overflow-hidden rounded-3xl">
      <div className="relative size-full">{children}</div>
    </div>
  )
}

/** A small card on a sheet (`data-a`: it comes in with its illustration). */
function Chip({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div data-a="" style={style} className={`absolute rounded-xl bg-white px-3.5 py-2.5 text-[13px] text-foreground shadow-[0_0_0_1px_rgb(168_148_118/0.25),0_10px_24px_-14px_rgb(110_76_36/0.35)] ${className}`}>
      {children}
    </div>
  )
}

/** [01] One org tree: a ministry, its divisions, and the clinics under one of them. */
function TreeArt() {
  const nodes = [
    { id: 'root', label: 'Ministry of Health', x: 50, y: 14, root: true },
    { id: 'a', label: 'Finance', x: 20, y: 44 },
    { id: 'b', label: 'Health services', x: 50, y: 44 },
    { id: 'c', label: 'Works', x: 80, y: 44 },
    { id: 'd', label: 'Malé clinic', x: 36, y: 76 },
    { id: 'e', label: 'Hulhumalé clinic', x: 64, y: 76 },
  ]
  const links = [
    ['root', 'a'],
    ['root', 'b'],
    ['root', 'c'],
    ['b', 'd'],
    ['b', 'e'],
  ]
  const at = (id: string) => nodes.find((n) => n.id === id)!
  return (
    <Sheet>
      <svg aria-hidden="true" viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {links.map(([f, t]) => {
          const a = at(f)
          const b = at(t)
          const mid = (a.y + b.y) / 2
          return <path key={t} data-draw="" pathLength={1} d={`M ${a.x} ${a.y * 0.8} V ${mid * 0.8} H ${b.x} V ${b.y * 0.8}`} className="tour-line" />
        })}
      </svg>
      {nodes.map((n) => (
        <Chip key={n.id} className={`-translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-bold ${n.root ? 'bg-ink! text-[#fbf5ec]!' : ''}`} style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          {n.label}
        </Chip>
      ))}
    </Sheet>
  )
}

/** [02] Sites take their rules from their type. */
function SitesArt() {
  return (
    <Sheet>
      <Chip className="left-[8%] top-[12%] w-[44%] p-4!">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">Site type</p>
        <p className="mt-1 text-[16px] font-bold">Store</p>
        <ul className="mt-3 grid gap-1.5 text-[12.5px] text-foreground/75">
          {['Holds stock', 'Can issue', 'Tracks bins'].map((r) => (
            <li key={r} className="flex items-center gap-2">
              <Check className="size-3.5 text-(--brand)" strokeWidth={2.4} /> {r}
            </li>
          ))}
        </ul>
      </Chip>
      <svg aria-hidden="true" viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {[30, 48, 66].map((y) => (
          <path key={y} data-draw="" pathLength={1} d={`M 52 26 C 58 26, 54 ${y}, 58 ${y}`} className="tour-line" />
        ))}
      </svg>
      {['Malé central', 'Hithadhoo overflow', 'Eydhafushi counter'].map((s, i) => (
        <Chip key={s} className="left-[58%] flex w-[38%] items-center gap-2" style={{ top: `${33 + i * 22}%` }}>
          <MapPin className="size-3.5 shrink-0 text-(--brand)" strokeWidth={2} />
          <span className="truncate text-[12.5px] font-bold">{s}</span>
        </Chip>
      ))}
      <Chip className="bottom-[8%] left-[8%] flex items-center gap-2 bg-(--brand-soft)/15! text-[12.5px]">
        <Package className="size-3.5 text-(--brand)" strokeWidth={2} /> Change the type, every store follows
      </Chip>
    </Sheet>
  )
}

/** [03] A purchase goes up its chain, one sign-off at a time. */
function ApprovalArt() {
  const steps = ['Unit lead', 'Claudia Reyes', 'Ada Whitfield']
  return (
    <Sheet>
      <Chip className="left-1/2 top-[12%] w-[62%] -translate-x-1/2 p-4!">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <GitBranch className="size-4 text-(--brand)" strokeWidth={1.8} /> Capital spend
          </p>
          <span className="rounded-full bg-(--brand-soft)/20 px-2.5 py-0.5 text-[11.5px] font-bold text-[#b45f12]">Above MVR 400,000</span>
        </div>
        <p className="mt-2 text-[12.5px] text-foreground/60">Purchase order · MVR 420,000</p>
      </Chip>
      <div className="tour-row absolute inset-x-[10%] top-[52%] flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s} className="contents">
            {i > 0 && <span data-draw-x="" className="tour-dash mx-2 h-0.5 grow origin-left" />}
            <div data-a="" className="flex flex-col items-center gap-2">
              <span data-tick="" className="tour-step relative grid size-12 place-items-center">
                <span aria-hidden="true" className="tour-step-hex absolute inset-0" style={{ mask: HEX_MASK }} />
                <Check className="tour-step-check relative size-5" strokeWidth={2.4} />
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-bold">{s}</span>
            </div>
          </div>
        ))}
      </div>
      <Chip className="bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap text-[12.5px]">
        Approved in order · <span className="font-bold text-[#3f7a4c]">signed off</span>
      </Chip>
    </Sheet>
  )
}

/** [04] Rules point at roles: the site manager changes, the alert still lands. */
function RolesArt() {
  return (
    <Sheet>
      <Chip className="left-[8%] top-[14%] w-[48%] p-4!">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">Notification rule</p>
        <p className="mt-1 text-[14.5px] font-bold">Stock below minimum</p>
        <p className="mt-2 flex items-center gap-2 text-[12.5px] text-foreground/70">
          <ArrowRight className="size-3.5" strokeWidth={2} /> the site manager
        </p>
      </Chip>
      <Chip className="right-[6%] top-[40%] w-[48%] p-4!">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">Site manager</p>
        <div className="relative mt-2 h-6">
          <p data-swap-out="" className="invisible absolute inset-0 text-[14.5px] font-bold text-foreground/45 line-through">Ibrahim Shareef</p>
          <p data-swap-in="" className="absolute inset-0 text-[14.5px] font-bold">Claudia Reyes</p>
        </div>
        <p className="mt-1 text-[12px] text-foreground/55">Malé central</p>
      </Chip>
      <svg aria-hidden="true" viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path data-draw="" pathLength={1} d="M 32 30 C 32 44, 50 40, 58 40" className="tour-line" />
      </svg>
      <Chip className="bottom-[12%] left-[14%] flex items-center gap-3 p-3.5!">
        <span className="grid size-8 place-items-center rounded-full bg-(--brand-soft)/20 text-(--brand)">
          <Bell className="size-4" strokeWidth={1.9} />
        </span>
        <span>
          <span className="block text-[13px] font-bold">Claudia Reyes</span>
          <span className="block text-[12px] text-foreground/60">Paracetamol is below minimum at Malé central</span>
        </span>
      </Chip>
    </Sheet>
  )
}

/** [05] Every change, on the record. */
function LogArt() {
  const rows = [
    ['Eydhafushi counter paused', 'Sites · Claudia Reyes', '16:40'],
    ['Bram Jansen added to Warehouse', 'Employees · Nadia Sorensen', '09:12'],
    ['Write-off of MVR 84,000 approved', 'Stock · Claudia Reyes', '15:48'],
    ['Capital spend chain changed', 'Approvals · Ada Whitfield', '11:05'],
  ]
  return (
    <Sheet>
      <div className="tour-row absolute inset-x-[10%] top-[12%] grid gap-2.5">
        <p data-a="" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55">
          <Activity className="size-3.5 text-(--brand)" strokeWidth={2} /> Activity log
        </p>
        {rows.map(([what, who, when]) => (
          <div key={what} data-a="" className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[0_0_0_1px_rgb(168_148_118/0.25)]">
            <span>
              <span className="block text-[13.5px] font-bold text-foreground">{what}</span>
              <span className="block text-[12px] text-foreground/55">{who}</span>
            </span>
            <span className="text-[12px] tabular-nums text-foreground/45">{when}</span>
          </div>
        ))}
        <p data-a="" className="mt-1 text-center text-[12px] text-foreground/50">Read-only · export as CSV</p>
      </div>
    </Sheet>
  )
}

const FEATURES = [
  { id: 'tree', tab: 'One org tree', title: ['Your organisation,', 'drawn once.'], body: 'Divisions, departments and teams in one tree that every app follows.', Art: TreeArt },
  { id: 'sites', tab: 'Places with rules', title: ['Set the rules once,', 'reuse them.'], body: 'Every site inherits how it stores, issues and tracks from its type.', Art: SitesArt },
  { id: 'approvals', tab: 'Approval chains', title: ['Sign-off that follows', 'your structure.'], body: 'Who signs, in what order and above what value, for any app’s actions.', Art: ApprovalArt },
  { id: 'roles', tab: 'Roles, not names', title: ['People change.', 'Rules keep working.'], body: 'Alerts and approvals go to whoever holds the role today.', Art: RolesArt },
  { id: 'log', tab: 'On the record', title: ['Nothing happens', 'off the record.'], body: 'Every change in every app, who made it and when. Nobody can edit it.', Art: LogArt },
]

/**
 * What Control Centre does, five things in turn: a short title on one side and a drawn sheet on the
 * other, alternating. The page scrolls as usual; each sheet draws itself in as it comes into view,
 * once. With reduced motion, the sheets are simply there.
 */
export function Tour() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const triggers = gsap.utils.toArray<HTMLElement>('[data-feature]', section.current).map((row) => {
          const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
          // each kind of part the sheet has, in turn (not every sheet has every kind)
          const part = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars, at: number) => {
            const els = row.querySelectorAll(sel)
            if (els.length) tl.fromTo(els, from, to, at)
          }
          part('[data-copy] > *', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0)
          part('[data-a]', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power2.out' }, 0.15)
          part('[data-draw]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.1, ease: 'power1.inOut' }, 0.35)
          part('[data-draw-x]', { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 0.35, ease: 'power1.inOut' }, 0.6)
          part('[data-tick]', { '--on': 0 }, { '--on': 1, duration: 0.25, stagger: 0.35 }, 0.7)
          part('[data-swap-out]', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, 1.1)
          part('[data-swap-in]', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 1.3)
          return ScrollTrigger.create({ trigger: row, start: 'top 72%', once: true, onEnter: () => tl.play() })
        })
        return () => triggers.forEach((t) => t.kill())
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} className="relative">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div className="section-b relative mx-auto grid w-full max-w-6xl gap-(--section-y) gutter">
        {FEATURES.map(({ id, tab, title, body, Art }, i) => (
          <div key={id} data-feature={id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div data-copy="" className={i % 2 ? 'lg:order-2' : ''}>
              <p className="text-overline tracking-[0.28em] text-muted-foreground">
                {String(i + 1).padStart(2, '0')} · {tab}
              </p>
              <h2 className="section-title mt-4 text-foreground">
                {title[0]} <span className="text-(--brand)">{title[1]}</span>
              </h2>
              <p className="section-lead mt-4 max-w-md text-muted-foreground">{body}</p>
            </div>
            <div className={`w-full max-w-[34rem] ${i % 2 ? 'lg:justify-self-end' : 'lg:justify-self-start'}`}>
              <Art />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
