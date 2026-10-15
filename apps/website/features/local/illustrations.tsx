import type { ReactNode } from 'react'

/**
 * The "Built for the Maldives" illustrations, drawn in code in the site's isometric style (cream
 * slabs, ink outlines, amber accents) so each part can move. Shapes are placed in a 3D grid and
 * projected (iso); flat details are drawn in a face's own coordinates and laid onto it with that
 * face's matrix. Parts that animate carry data-* hooks for local.tsx.
 */

const C = { top: '#fbf3e8', left: '#efe2cf', right: '#e2cfb2', ink: '#1f1d1a', soft: '#d9c6a9', amber: '#f28213', amberSoft: '#f6a24d', amberDeep: '#c96a10' }
const INK = { stroke: C.ink, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

type V = [number, number]
const iso = (x: number, y: number, z: number): V => [(x - y) * 0.866, (x + y) * 0.5 - z]
const poly = (...p: V[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')

/** Lays local 2D drawing onto a face: the top (x → x, y → y), or an upright face along x or y. */
const plane = {
  top: ([x, y]: V) => `matrix(0.866 0.5 -0.866 0.5 ${x} ${y})`,
  alongX: ([x, y]: V) => `matrix(0.866 0.5 0 1 ${x} ${y})`, // faces the lower left
  alongY: ([x, y]: V) => `matrix(0.866 -0.5 0 1 ${x} ${y})`, // faces the lower right
}

/** A box: its top and the two faces toward the viewer. */
function Box({ x, y, z, w, d, h, fill = C }: { x: number; y: number; z: number; w: number; d: number; h: number; fill?: { top: string; left: string; right: string } }) {
  return (
    <g>
      <polygon points={poly(iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z))} fill={fill.left} {...INK} />
      <polygon points={poly(iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z))} fill={fill.right} {...INK} />
      <polygon points={poly(iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h))} fill={fill.top} {...INK} />
    </g>
  )
}

function Frame({ children, label, viewBox = '-220 -170 440 330' }: { children: ReactNode; label: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={label} className="h-auto w-full overflow-visible">
      {children}
    </svg>
  )
}

/** Atoll, island and ward as three layers that spread apart; a pin drops onto the top. */
export function Geography() {
  const slab = (z: number, key: string, content: ReactNode) => (
    <g data-geo-layer={key}>
      <Box x={-70} y={-55} z={z} w={140} h={8} d={110} />
      <g transform={plane.top(iso(-70, -55, z + 8))}>{content}</g>
    </g>
  )
  const house = (x: number, y: number, z: number, s = 1) => <Box x={x} y={y} z={z} w={14 * s} d={14 * s} h={12 * s} />
  return (
    <Frame label="Atoll, island and ward, stacked as layers">
      {slab(0, 'ward', <g>{house(30, 30, 0)}</g>)}
      <g data-geo-layer="ward-houses">
        {house(-30, -10, 8)}
        {house(5, 10, 8, 1.2)}
        {house(30, -30, 8)}
      </g>
      {slab(40, 'island', null)}
      <g data-geo-layer="island-houses">
        {house(-40, -20, 48, 0.8)}
        {house(-15, 15, 48, 0.8)}
        {house(20, -5, 48, 0.8)}
      </g>
      {slab(80, 'atoll', (
        <g>
          <ellipse cx="70" cy="55" rx="58" ry="40" fill="#e7e1d6" stroke={C.soft} strokeWidth="1.5" />
          <path d="M48 52 C55 36 82 34 92 46 C100 56 88 70 70 70 C56 70 44 64 48 52 Z" fill={C.amberSoft} stroke={C.amberDeep} strokeWidth="1.5" />
        </g>
      ))}
      {/* the pin on the island */}
      <g data-geo-pin="">
        <path d={`M${iso(5, 0, 120)[0]} ${iso(5, 0, 120)[1] + 26} l-11 -16 a13 13 0 1 1 22 0 z`} fill={C.amber} {...INK} />
        <circle cx={iso(5, 0, 120)[0]} cy={iso(5, 0, 120)[1] + 4} r="4.5" fill="#fff" />
      </g>
      {/* the chain of places on the right: pin, island, ward */}
      <g transform="translate(150 -100)">
        <line x1="0" y1="14" x2="0" y2="150" stroke={C.amber} strokeWidth="2" strokeDasharray="3 6" data-geo-chain="" />
        {[0, 70, 140].map((y, i) => (
          <circle key={y} cx="0" cy={y} r="13" fill={i === 0 ? C.amber : C.top} {...INK} data-geo-stop="" />
        ))}
      </g>
    </Frame>
  )
}

/** The national ID card, connected to the person's fingerprint; the check pops when they meet. */
export function Identity() {
  const card = iso(-120, 0, 0)
  const tile = iso(105, -40, -20)
  return (
    <Frame label="An identity card verified against a fingerprint">
      <g transform={plane.alongY(card)}>
        <rect x="6" y="-152" width="220" height="140" rx="16" fill={C.right} {...INK} />
        <rect x="0" y="-160" width="220" height="140" rx="16" fill={C.top} {...INK} />
        <rect x="18" y="-140" width="16" height="9" rx="3" fill={C.soft} />
        <rect x="38" y="-140" width="26" height="9" rx="3" fill={C.soft} />
        <rect x="18" y="-120" width="56" height="70" rx="6" fill="none" stroke={C.soft} strokeWidth="2" />
        <circle cx="46" cy="-98" r="10" fill={C.left} {...INK} />
        <path d="M30 -60 a16 14 0 0 1 32 0 z" fill={C.left} {...INK} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="88" y={-118 + i * 17} width={i === 3 ? 60 : 92} height="8" rx="4" fill={C.soft} opacity="0.75" />
        ))}
        <g data-id-check="" transform="translate(190 -132)">
          <circle r="18" fill={C.amber} />
          <path d="M-8 0 l5 6 l11 -12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* the link */}
      <path data-id-link="" d={`M${card[0] + 200} ${card[1] - 118} L${tile[0] - 6} ${tile[1] - 52}`} stroke={C.amber} strokeWidth="3" strokeDasharray="7 7" fill="none" />
      <circle data-id-dot="" cx={card[0] + 200} cy={card[1] - 118} r="7" fill={C.amber} />
      <g transform={plane.alongY(tile)}>
        <rect x="6" y="-82" width="74" height="78" rx="12" fill={C.right} {...INK} />
        <rect x="0" y="-88" width="74" height="78" rx="12" fill={C.top} {...INK} />
        <g transform="translate(37 -49)" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round">
          {[8, 14, 20, 26].map((r) => (
            <path key={r} d={`M${-r * 0.8} ${r * 0.4} A${r} ${r} 0 1 1 ${r * 0.8} ${r * 0.4}`} />
          ))}
          <rect data-id-scan="" x="-30" y="-30" width="60" height="3" rx="1.5" fill={C.amber} stroke="none" opacity="0" />
        </g>
      </g>
    </Frame>
  )
}

/** Two coin stacks, MVR and USD; coins fall onto their tops. */
export function Currency() {
  const coin = (cx: number, cy: number, fill: { top: string; side: string; ink: string }) => (
    <g>
      <path d={`M${cx - 44} ${cy} v12 a44 24 0 0 0 88 0 v-12`} fill={fill.side} stroke={fill.ink} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx={cx} cy={cy} rx="44" ry="24" fill={fill.top} stroke={fill.ink} strokeWidth="2" />
    </g>
  )
  const mvr = { top: C.amberSoft, side: C.amber, ink: C.ink }
  const usd = { top: C.top, side: C.right, ink: C.ink }
  const stack = (cx: number, base: number, n: number, fill: typeof mvr, label: string, key: string) => (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} data-coin={key} data-coin-i={i}>
          {coin(cx, base - i * 13, fill)}
        </g>
      ))}
      <g data-coin={key} data-coin-i={n}>
        {coin(cx, base - n * 13, fill)}
        <text x={cx} y={base - n * 13 + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={key === 'mvr' ? '#fff' : C.ink} transform={`rotate(-18 ${cx} ${base - n * 13})`}>
          {label}
        </text>
      </g>
    </g>
  )
  return (
    <Frame label="Coin stacks for MVR and USD">
      <ellipse cx="-50" cy="70" rx="58" ry="26" fill="#000" opacity="0.06" />
      <ellipse cx="62" cy="96" rx="58" ry="26" fill="#000" opacity="0.06" />
      {stack(-50, 60, 5, mvr, 'MVR', 'mvr')}
      {stack(62, 86, 3, usd, 'USD', 'usd')}
    </Frame>
  )
}

/** A parent office linked to its branches; the links draw out from the parent. */
export function Oversight() {
  const site = (x: number, y: number, s: number, key: string) => (
    <g key={key} data-site={key}>
      <Box x={x - 40 * s} y={y - 40 * s} z={0} w={80 * s} d={80 * s} h={7} />
      <Box x={x - 24 * s} y={y - 24 * s} z={7} w={48 * s} d={48 * s} h={40 * s} />
      {/* windows on the two front faces */}
      <g transform={plane.alongX(iso(x - 24 * s, y + 24 * s, 7 + 40 * s))}>
        {[0, 1].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={6 * s + c * 14 * s} y={8 * s + r * 15 * s} width={7 * s} height={9 * s} fill={C.soft} stroke={C.ink} strokeWidth="1.2" />))}
      </g>
      <g transform={plane.alongY(iso(x + 24 * s, y + 24 * s, 7 + 40 * s))}>
        {[0, 1].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={6 * s + c * 14 * s} y={8 * s + r * 15 * s} width={7 * s} height={9 * s} fill={C.soft} stroke={C.ink} strokeWidth="1.2" />))}
        <rect x={16 * s} y={28 * s} width={14 * s} height={4 * s} fill={C.amber} />
      </g>
    </g>
  )
  const parent: V = iso(0, -60, 7)
  const kids: [number, number][] = [[-120, 30], [-10, 110], [110, 40]]
  return (
    <Frame label="A parent office linked to its branches" viewBox="-230 -150 460 330">
      {kids.map(([x, y], i) => {
        const k = iso(x, y, 7)
        return <path key={i} data-link="" d={`M${parent[0]} ${parent[1] + 30} L${k[0]} ${k[1] - 30}`} stroke={C.amber} strokeWidth="3" strokeDasharray="7 7" fill="none" />
      })}
      {kids.map(([x, y], i) => (
        <circle key={i} data-link-dot="" cx={parent[0]} cy={parent[1] + 30} r="6" fill={C.amber} />
      ))}
      {site(0, -60, 1.25, 'parent')}
      {kids.map(([x, y], i) => site(x, y, 0.8, `kid-${i}`))}
    </Frame>
  )
}

/** Records stacked behind a shield, linked to a clock: the shield lifts, the clock turns. */
export function Audit() {
  const at = (x: number) => iso(x, 0, 0)
  const clock = iso(130, -40, 30)
  return (
    <Frame label="Records protected by a shield, with their history">
      {[-120, -95, -70].map((x, i) => (
        <g key={x} transform={plane.alongY(at(x))} data-audit-card={i}>
          <rect x="6" y="-142" width="118" height="140" rx="14" fill={C.right} {...INK} />
          <rect x="0" y="-148" width="118" height="140" rx="14" fill={C.top} {...INK} />
          {i === 2 && (
            <g>
              <rect x="16" y="-130" width="22" height="22" rx="4" fill={C.soft} />
              {[0, 1, 2].map((l) => (
                <rect key={l} x="16" y={-96 + l * 18} width="84" height="8" rx="4" fill={C.soft} opacity="0.7" />
              ))}
            </g>
          )}
        </g>
      ))}
      <g data-audit-shield="" transform={plane.alongY(at(-10))}>
        <rect x="6" y="-104" width="100" height="100" rx="16" fill={C.right} {...INK} />
        <rect x="0" y="-110" width="100" height="100" rx="16" fill={C.top} {...INK} />
        <path d="M50 -86 l22 8 v18 c0 14 -10 22 -22 28 c-12 -6 -22 -14 -22 -28 v-18 z" fill={C.amberSoft} stroke={C.amberDeep} strokeWidth="2" />
        <path d="M41 -60 l6 7 l12 -13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path data-audit-link="" d={`M${at(-10)[0] + 92} ${at(-10)[1] - 110} L${clock[0] - 46} ${clock[1] - 4}`} stroke={C.amber} strokeWidth="3" strokeDasharray="7 7" fill="none" />
      <circle data-audit-dot="" cx={at(-10)[0] + 92} cy={at(-10)[1] - 110} r="7" fill={C.amber} />
      <g transform={`translate(${clock[0]} ${clock[1]})`}>
        <ellipse cx="6" cy="4" rx="44" ry="48" fill={C.right} {...INK} />
        <ellipse cx="0" cy="0" rx="44" ry="48" fill={C.top} {...INK} />
        <path d="M-22 -10 a24 24 0 1 1 2 20" fill="none" stroke={C.amberDeep} strokeWidth="4" strokeLinecap="round" />
        <path d="M-26 -18 l3 10 l10 -3" fill="none" stroke={C.amberDeep} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <g data-audit-hand="">
          <line x1="0" y1="0" x2="0" y2="-18" stroke={C.amberDeep} strokeWidth="4" strokeLinecap="round" />
        </g>
        <line x1="0" y1="0" x2="10" y2="8" stroke={C.amberDeep} strokeWidth="4" strokeLinecap="round" />
      </g>
    </Frame>
  )
}
