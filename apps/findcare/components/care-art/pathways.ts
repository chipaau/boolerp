// Pathways: the original My Care art (the prototype's "Care Diagram"). A fine-line diagram drawn in
// on first visit — a crosshair grid, three specialty rings with clinics orbiting them, today's
// opening hours as a tick fan with a "now" needle, and a tree whose trunk carries your visit. Rings
// glow rose when the dashboard pulses; layers drift with the pointer for depth.
import type { ArtFactory, CareArt } from './types'

const NS = 'http://www.w3.org/2000/svg'
const INK = '#2A2328'
const ACCENT = '#D2689E'
const CX = 720
const CY = 440
const RING_RADII = [118, 196, 278]

type Attrs = Record<string, string | number>
type Draw = { e: SVGGeometryElement; len: number; d: number; dur: number }
type Pop = { e: SVGCircleElement; r: number; d: number }
type Fade = { e: SVGElement; d: number; o?: number; attr?: string }

const ease = (k: number) => 1 - Math.pow(1 - k, 3)
const back = (k: number) => 1 + 2.6 * Math.pow(k - 1, 3) + 1.6 * Math.pow(k - 1, 2)
const clamp = (x: number) => Math.min(1, Math.max(0, x))
const polar = (r: number, deg: number): [number, number] => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)]

export const createPathways: ArtFactory = (container, { reducedMotion, introSpeed }): CareArt => {
  // a seeded random, so the tree grows the same every time
  let seed = 9
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const DRAW: Draw[] = []
  const POP: Pop[] = []
  const FADE: Fade[] = []

  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 1440 900')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'display:block;width:100%;height:100%'
  svg.innerHTML = `<defs>
    <radialGradient id="pw-moon" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E9E1E6"/><stop offset="1" stop-color="#B7AAB4"/></radialGradient>
    <radialGradient id="pw-dark" cx="32%" cy="28%" r="80%"><stop offset="0" stop-color="#D6CCD3"/><stop offset=".55" stop-color="#A89BA5"/><stop offset="1" stop-color="#857884"/></radialGradient>
    <radialGradient id="pw-pearl" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CFC3CC"/></radialGradient>
  </defs>`
  container.appendChild(svg)
  const layer = () => svg.appendChild(document.createElementNS(NS, 'g'))
  const [grid, rings, arc, tree, orbit] = [layer(), layer(), layer(), layer(), layer()]

  const mk = <T extends SVGElement>(tag: string, a: Attrs, parent: SVGElement) => {
    const e = document.createElementNS(NS, tag) as T
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v))
    parent.appendChild(e)
    return e
  }
  /** A line that draws itself in, from delay d over dur seconds. */
  const stroke = (tag: string, a: Attrs, parent: SVGElement, d: number, dur: number) => {
    const e = mk<SVGGeometryElement>(tag, { fill: 'none', stroke: INK, ...a }, parent)
    const len = e.getTotalLength()
    e.style.strokeDasharray = `${len} ${len}`
    e.style.strokeDashoffset = String(len)
    DRAW.push({ e, len, d, dur })
    return e
  }
  /** A dot that pops in at delay d. */
  const pop = (a: Attrs & { r: number }, parent: SVGElement, d: number) => {
    const e = mk<SVGCircleElement>('circle', { ...a, r: 0 }, parent)
    POP.push({ e, r: a.r, d })
    return e
  }

  // crosshair grid
  stroke('line', { x1: CX, y1: 40, x2: CX, y2: 880, 'stroke-width': 0.6, 'stroke-opacity': 0.22 }, grid, 0, 1.2)
  stroke('line', { x1: 60, y1: CY - 170, x2: 1400, y2: CY - 170, 'stroke-width': 0.5, 'stroke-opacity': 0.14 }, grid, 0.1, 1.3)
  stroke('line', { x1: 200, y1: CY + 205, x2: 1320, y2: CY + 205, 'stroke-width': 0.5, 'stroke-opacity': 0.14 }, grid, 0.2, 1.3)
  stroke('line', { x1: CX - 170, y1: CY - 220, x2: CX - 170, y2: CY + 390, 'stroke-width': 0.5, 'stroke-opacity': 0.22 }, grid, 0.25, 1.1)
  stroke('line', { x1: CX + 232, y1: CY - 340, x2: CX + 232, y2: CY + 270, 'stroke-width': 0.5, 'stroke-opacity': 0.22 }, grid, 0.3, 1.1)
  stroke('line', { x1: CX - 430, y1: CY + 260, x2: CX + 300, y2: CY - 290, 'stroke-width': 0.8, 'stroke-opacity': 0.5 }, grid, 0.5, 1.2)
  pop({ cx: CX - 430, cy: CY + 260, r: 3, fill: INK }, grid, 1.5)
  pop({ cx: CX + 300, cy: CY - 290, r: 3, fill: 'none', stroke: INK, 'stroke-width': 0.8 }, grid, 1.5)
  for (let i = 0; i < 4; i++) pop({ cx: CX - 170, cy: CY - 110 + i * 120, r: i % 3 ? 2 : 3.5, fill: i % 2 ? '#fff' : INK, stroke: INK, 'stroke-width': 0.7 }, grid, 1.2 + i * 0.06)
  for (let i = 0; i < 5; i++) {
    const y = CY - 300 + i * 110
    mk('line', { x1: CX + 226, y1: y, x2: CX + 238, y2: y, stroke: INK, 'stroke-width': 0.6, 'stroke-opacity': 0.5 }, grid)
  }

  // specialty rings
  const RINGS = RING_RADII.map((r, i) =>
    stroke(
      'circle',
      { cx: CX, cy: CY, r, 'stroke-width': i === 2 ? 0.9 : 0.6, 'stroke-opacity': 0.42, transform: `rotate(${-90 - i * 25} ${CX} ${CY})` },
      rings,
      0.3 + i * 0.12,
      1.3,
    ),
  )
  stroke('circle', { cx: CX, cy: CY, r: 40, 'stroke-width': 0.6, 'stroke-opacity': 0.35, 'stroke-dasharray': '2 3' }, rings, 0.9, 0.8)

  // today's opening hours (08:00–21:00) as a tick fan, with how busy each hour is
  const H0 = 8
  const H1 = 21
  const A0 = -52
  const A1 = 52
  const BUSY = [3, 5, 8, 6, 4, 3, 5, 9, 11, 10, 6, 4, 2, 1]
  const angle = (h: number) => A0 + ((h - H0) / (H1 - H0)) * (A1 - A0)
  {
    const [x0, y0] = polar(308, A0)
    const [x1, y1] = polar(308, A1)
    stroke('path', { d: `M${x0} ${y0} A308 308 0 0 1 ${x1} ${y1}`, 'stroke-width': 0.7, 'stroke-opacity': 0.5 }, arc, 1.1, 1)
  }
  for (let q = 0; q <= (H1 - H0) * 4; q++) {
    const a = angle(H0 + q / 4)
    const major = q % 4 === 0
    const [x0, y0] = polar(308, a)
    const [x1, y1] = polar(308 + (major ? 12 : 5), a)
    const e = mk('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: INK, 'stroke-width': major ? 0.8 : 0.5, 'stroke-opacity': 0 }, arc)
    FADE.push({ e, d: 1.4 + q * 0.012, o: major ? 0.7 : 0.4, attr: 'stroke-opacity' })
  }
  BUSY.forEach((v, i) => {
    const a = angle(H0 + i + 0.5)
    const [x0, y0] = polar(292, a)
    const [x1, y1] = polar(292 - v * 4, a)
    stroke('line', { x1: x0, y1: y0, x2: x1, y2: y1, 'stroke-width': 2.2, 'stroke-opacity': 0.28, 'stroke-linecap': 'round' }, arc, 1.9 + i * 0.04, 0.5)
  })
  const needle = mk<SVGGElement>('g', { opacity: 0 }, arc)
  FADE.push({ e: needle, d: 2.6 })
  const needleLine = mk('line', { stroke: ACCENT, 'stroke-width': 1.1 }, needle)
  const needleDot = mk('circle', { r: 3, fill: ACCENT }, needle)
  const setNeedle = () => {
    const d = new Date()
    const a = angle(Math.min(H1, Math.max(H0, d.getHours() + d.getMinutes() / 60)))
    const [x0, y0] = polar(254, a)
    const [x1, y1] = polar(356, a)
    needleLine.setAttribute('x1', String(x0))
    needleLine.setAttribute('y1', String(y0))
    needleLine.setAttribute('x2', String(x1))
    needleLine.setAttribute('y2', String(y1))
    needleDot.setAttribute('cx', String(x1))
    needleDot.setAttribute('cy', String(y1))
  }
  setNeedle()
  const needleTimer = window.setInterval(setNeedle, 30000)

  // the tree: a trunk rising through the centre, branching to fine tips, with roots below
  const SPEED = 380
  const tips: [number, number, number][] = []
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number, t0: number, maxDepth: number) => {
    const bend = (rnd() - 0.5) * 0.5
    const x2 = x + Math.cos(a) * len
    const y2 = y + Math.sin(a) * len
    const mx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * len * bend * 0.3
    const my = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * len * bend * 0.3
    stroke(
      'path',
      {
        d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        'stroke-width': Math.max(0.35, w).toFixed(2),
        'stroke-linecap': 'round',
        'stroke-opacity': 0.9,
      },
      tree,
      t0,
      len / SPEED,
    )
    const t1 = t0 + len / SPEED
    if (depth >= maxDepth || len < 5) {
      tips.push([x2, y2, t1])
      return
    }
    const n = depth < 2 ? 2 : rnd() < 0.35 ? 3 : 2
    for (let k = 0; k < n; k++) {
      const spread = (0.28 + rnd() * 0.38) * (k % 2 ? 1 : -1)
      branch(x2, y2, a + spread + (rnd() - 0.5) * 0.2, len * (0.66 + rnd() * 0.14), w * 0.68, depth + 1, t1, maxDepth)
    }
  }
  {
    let x = CX
    let y = CY + 300
    let t = 1.0
    let w = 5.2
    const trunk: [number, number][] = [[x, y]]
    for (let i = 0; i < 9; i++) {
      const nx = CX + Math.sin(i * 1.3 + 1) * (14 - i) + (rnd() - 0.5) * 8
      const ny = y - 36
      stroke(
        'path',
        {
          d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + (rnd() - 0.5) * 18).toFixed(1)} ${(y - 18).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`,
          'stroke-width': w.toFixed(2),
          'stroke-linecap': 'round',
        },
        tree,
        t,
        36 / SPEED,
      )
      t += 36 / SPEED
      x = nx
      y = ny
      w *= 0.9
      trunk.push([x, y])
      if (i >= 3) branch(x, y, -Math.PI / 2 + (i % 2 ? 0.95 : -0.95) + (rnd() - 0.5) * 0.3, 34 + i * 4, w * 0.6, 2, t, 6)
    }
    branch(x, y, -Math.PI / 2 - 0.35, 44, w * 0.8, 0, t, 7)
    branch(x, y, -Math.PI / 2 + 0.4, 40, w * 0.8, 0, t, 7)
    for (let k = 0; k < 5; k++) branch(CX, CY + 300, Math.PI / 2 + (k - 2) * 0.45 + (rnd() - 0.5) * 0.2, 22 + rnd() * 12, 2.2, 3, 1.0, 6)
    // your visit: a target on the trunk
    const [ax, ay] = trunk[5]
    ;[22, 14, 7].forEach((r, i) =>
      stroke('circle', { cx: ax, cy: ay, r, 'stroke-width': 0.7, 'stroke-opacity': 0.6 + i * 0.1, transform: `rotate(-90 ${ax} ${ay})` }, tree, 2.2 + i * 0.1, 0.6),
    )
    pop({ cx: ax, cy: ay, r: 3.2, fill: ACCENT }, tree, 2.5)
  }
  tips.forEach(([x, y, t], i) => {
    if (i % 2) return
    pop({ cx: (x + (rnd() - 0.5) * 4).toFixed(1), cy: (y + (rnd() - 0.5) * 4).toFixed(1), r: Number((0.7 + rnd() * 1.1).toFixed(2)), fill: INK, 'fill-opacity': 0.75 }, tree, t)
  })

  // clinics orbiting their specialty ring; a halo answers a pulse on that ring
  type Orbiter = { g: SVGGElement; halo: SVGCircleElement; ring: number; a0: number; sp: number }
  const ORBITERS: Orbiter[] = []
  ;[2, 3, 2].forEach((count, ring) => {
    for (let k = 0; k < count; k++) {
      const a0 = rnd() * 360
      const kind = (ring * 3 + k) % 4
      const r = kind === 3 ? 7 : kind === 2 ? 4.5 : 3.2
      const g = mk<SVGGElement>('g', {}, orbit)
      const halo = mk<SVGCircleElement>('circle', { cx: 0, cy: 0, r: 0, fill: 'none', stroke: ACCENT, 'stroke-width': 1, opacity: 0 }, g)
      pop(
        { cx: 0, cy: 0, r, fill: kind === 3 ? 'url(#pw-pearl)' : kind === 1 ? '#FFFFFF' : INK, stroke: INK, 'stroke-width': kind === 3 ? 0.5 : 0.8 },
        g,
        2.2 + ORBITERS.length * 0.05,
      )
      if (kind === 3) mk('circle', { cx: 0, cy: 0, r: r + 5, fill: 'none', stroke: INK, 'stroke-width': 0.5, 'stroke-opacity': 0.5 }, g)
      ORBITERS.push({ g, halo, ring, a0, sp: (ring % 2 ? -1 : 1) * (1.4 + rnd() * 1.8) })
    }
  })
  // you, the large sphere at the top, and the hospital lower left
  {
    const [mx, my] = [CX - 150, CY - 300]
    pop({ cx: mx, cy: my, r: 36, fill: 'url(#pw-moon)' }, orbit, 2.0)
    stroke('path', { d: `M${mx - 48} ${my + 12} A50 50 0 0 1 ${mx + 20} ${my - 46}`, 'stroke-width': 0.7, 'stroke-opacity': 0.55 }, orbit, 2.1, 0.7)
    const [hx, hy] = [CX - 268, CY + 150]
    pop({ cx: hx, cy: hy, r: 22, fill: 'url(#pw-dark)' }, orbit, 2.3)
    stroke('circle', { cx: hx, cy: hy, r: 30, 'stroke-width': 0.5, 'stroke-opacity': 0.45 }, orbit, 2.3, 0.6)
  }
  for (let k = 0; k < 10; k++) {
    const a = rnd() * 6.283
    const r = 120 + rnd() * 300
    const x = CX + Math.cos(a) * r * 1.15
    const y = CY + Math.sin(a) * r * 0.95
    if (y < 70 || y > 860) continue
    const filled = rnd() < 0.5
    pop(
      {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: Number((1.2 + rnd() * 2.6).toFixed(1)),
        fill: filled ? INK : '#fff',
        stroke: INK,
        'stroke-width': 0.6,
        'fill-opacity': filled ? 0.8 : 1,
      },
      orbit,
      2.3 + rnd() * 0.6,
    )
  }

  // ---------- animation
  const PARALLAX: [SVGGElement, number][] = [
    [grid, 2],
    [rings, 5],
    [arc, 5],
    [tree, 3],
    [orbit, 9],
  ]
  const pulses: Record<number, number> = {}
  const target = { x: 0, y: 0 }
  const drift = { x: 0, y: 0 }
  let start = performance.now() - (reducedMotion ? 1e5 : 0)
  let raf = 0

  const frame = (now: number) => {
    const el = ((now - start) / 1000) * introSpeed
    const t = reducedMotion ? 0 : now / 1000
    for (const d of DRAW) d.e.style.strokeDashoffset = String(d.len * (1 - ease(clamp((el - d.d) / d.dur))))
    for (const p of POP) {
      const k = clamp((el - p.d) / 0.5)
      p.e.setAttribute('r', (p.r * (k < 1 ? Math.max(0, back(k)) : 1)).toFixed(2))
    }
    for (const f of FADE) f.e.setAttribute(f.attr ?? 'opacity', (ease(clamp((el - f.d) / 0.5)) * (f.o ?? 1)).toFixed(3))
    for (const s of ORBITERS) {
      const a = s.a0 + s.sp * t + (1 - ease(clamp((el - 2) / 1.2))) * 40 * Math.sign(s.sp)
      const [x, y] = polar(RING_RADII[s.ring], a)
      s.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      const pt = pulses[s.ring]
      const k = pt ? (now - pt) / 1400 : 9
      s.halo.setAttribute('r', k < 1 ? (4 + ease(k) * 22).toFixed(1) : '0')
      s.halo.setAttribute('opacity', k < 1 ? (1 - k).toFixed(2) : '0')
    }
    RINGS.forEach((ring, i) => {
      const pt = pulses[i]
      const k = pt ? (now - pt) / 1600 : 9
      const on = k < 1 ? Math.sin(k * Math.PI) : 0
      ring.setAttribute('stroke', on > 0.02 ? ACCENT : INK)
      ring.setAttribute('stroke-opacity', (0.42 + on * 0.5).toFixed(2))
      ring.setAttribute('stroke-width', String((i === 2 ? 0.9 : 0.6) + on * 0.8))
    })
    if (!reducedMotion) {
      drift.x += (target.x - drift.x) * 0.05
      drift.y += (target.y - drift.y) * 0.05
    }
    for (const [g, k] of PARALLAX) g.setAttribute('transform', `translate(${(-drift.x * k).toFixed(2)} ${(-drift.y * k).toFixed(2)})`)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    pulse: (_kind, i) => {
      pulses[i % 3] = performance.now()
    },
    pointer: (x, y) => {
      target.x = x
      target.y = y
    },
    // Pathways is a diagram to look at, not to poke: a tap does nothing.
    tap: () => undefined,
    replay: () => {
      start = performance.now()
    },
    dispose: () => {
      cancelAnimationFrame(raf)
      window.clearInterval(needleTimer)
      svg.remove()
    },
  }
}
