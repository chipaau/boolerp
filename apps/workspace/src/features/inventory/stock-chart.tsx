import { startTransition, useState } from 'react'
import { areaPath, niceMax, plot, smoothPath } from '@workspace/ui/lib/charts'
import { cn } from '@workspace/ui/lib/utils'
import { useStockSeries } from './queries'
import type { Period } from './types'

const W = 900
const H = 200
const TOP = 8
const BOTTOM = 192
const PERIODS: Period[] = ['7d', '30d', '90d']

/**
 * "Stock in vs out": two smoothed lines (sage in, orange out) over gradient washes, a period
 * switch, totals with the net change, and a hover guide with dots and a tooltip. Colours are
 * the chart tokens; the lines draw themselves in on mount.
 */
export function StockChart() {
  const [period, setPeriod] = useState<Period>('30d')
  const [hover, setHover] = useState<number | null>(null)
  const s = useStockSeries(period)
  const n = s.inn.length
  const max = niceMax([...s.inn, ...s.out])
  const pIn = plot(s.inn, W, TOP, BOTTOM, max)
  const pOut = plot(s.out, W, TOP, BOTTOM, max)
  const totalIn = s.inn.reduce((a, b) => a + b, 0)
  const totalOut = s.out.reduce((a, b) => a + b, 0)
  const net = totalIn - totalOut
  const slot = W / (n - 1)
  const yLabels = [4, 3, 2, 1, 0].map((i) => Math.round((max * i) / 4).toLocaleString())
  const gridY = [0, 1, 2, 3, 4].map((i) => TOP + (i * (BOTTOM - TOP)) / 4)
  const hx = hover === null ? 0 : (hover / (n - 1)) * 100

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-ui-lg font-bold text-foreground">Stock in vs out</div>
          <div className="mt-0.5 text-meta text-muted-foreground">Units received against units issued or written off</div>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => {
                setHover(null)
                startTransition(() => setPeriod(p))
              }}
              className={cn(
                'rounded-full px-[13px] py-[5px] text-meta font-bold transition-colors duration-instant ease-bool',
                p === period ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <dl className="my-5 flex gap-[34px]">
        <Total label="Stock in" dot="bg-chart-line-a" value={totalIn.toLocaleString()} />
        <Total label="Stock out" dot="bg-chart-line-b" value={totalOut.toLocaleString()} />
        <Total
          label="Net change"
          value={`${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()}`}
          valueClass={net >= 0 ? 'text-link' : 'text-tone-risk-foreground'}
        />
      </dl>

      <div className="relative flex gap-2.5" onMouseLeave={() => setHover(null)}>
        <div className="flex h-[200px] w-8 shrink-0 flex-col justify-between text-[10.5px] text-muted-foreground">
          {yLabels.map((y, i) => (
            <span key={i}>{y}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full overflow-visible">
            <defs>
              <linearGradient id="hx-in" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-line-a)" stopOpacity="0.3" />
                <stop offset="0.7" stopColor="var(--chart-line-a)" stopOpacity="0.05" />
                <stop offset="1" stopColor="var(--chart-line-a)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hx-out" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-fill)" stopOpacity="0.34" />
                <stop offset="0.7" stopColor="var(--chart-fill)" stopOpacity="0.05" />
                <stop offset="1" stopColor="var(--chart-fill)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridY.map((y) => (
              <line key={y} x1={0} x2={W} y1={y} y2={y} className="stroke-chart-grid" strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
            ))}
            <g className="animate-wash">
              <path d={areaPath(pIn, W, BOTTOM)} fill="url(#hx-in)" />
              <path d={areaPath(pOut, W, BOTTOM)} fill="url(#hx-out)" />
            </g>
            <path d={smoothPath(pOut)} fill="none" className="animate-draw stroke-chart-line-b [stroke-dasharray:1600]" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={smoothPath(pIn)} fill="none" className="animate-draw stroke-chart-line-a [stroke-dasharray:1600]" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <g>
                <rect x={pIn[hover][0] - slot / 2} y={0} width={slot} height={H} className="fill-chart-fill/10" />
                <line x1={pIn[hover][0]} x2={pIn[hover][0]} y1={8} y2={192} className="stroke-chart-guide" strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {s.inn.map((_, i) => (
              <rect key={i} x={pIn[i][0] - slot / 2} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
            ))}
          </svg>

          {hover !== null && (
            <>
              <Dot x={hx} y={pIn[hover][1]} className="bg-chart-line-a" halo="bg-chart-line-a/35" />
              <Dot x={hx} y={pOut[hover][1]} className="bg-chart-line-b" halo="bg-chart-line-b/25" />
              <div
                className="pointer-events-none absolute z-10 -top-6 animate-rise rounded-xl bg-card px-3.5 py-2 whitespace-nowrap shadow-floating [animation-duration:180ms]"
                style={{
                  left: `${hx}%`,
                  transform: `translateX(${hover === 0 ? '0' : hover === n - 1 ? '-100%' : '-50%'})`,
                }}
              >
                <div className="text-overline text-muted-foreground">{s.labels[hover]}</div>
                <div className="mt-1.5 flex gap-3 text-meta font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-chart-line-a" />
                    {s.inn[hover]} in
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-chart-line-b" />
                    {s.out[hover]} out
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="mt-[11px] flex justify-between text-[10.5px] text-muted-foreground">
            {s.labels.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Total({ label, value, dot, valueClass }: { label: string; value: string; dot?: string; valueClass?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.09em] text-muted-foreground uppercase">
        {dot && <span className={cn('size-[7px] rounded-full', dot)} />}
        {label}
      </dt>
      <dd className={cn('mt-1.5 text-[19px] font-bold tracking-[-0.01em] text-foreground', valueClass)}>{value}</dd>
    </div>
  )
}

function Dot({ x, y, className, halo }: { x: number; y: number; className: string; halo: string }) {
  const style = { left: `${x}%`, top: `${y}px` }
  return (
    <>
      <span className={cn('pointer-events-none absolute z-[4] size-6 -translate-x-1/2 -translate-y-1/2 animate-rise rounded-full [animation-duration:200ms]', halo)} style={style} />
      <span className={cn('pointer-events-none absolute z-[5] size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[2.5px] ring-card', className)} style={style} />
    </>
  )
}
