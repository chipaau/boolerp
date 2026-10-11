'use client'

import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import type { ArtFactory, ArtKind, CareArt as Art, PulseKind } from './types'

// Each artwork's code loads only when it is chosen: Cell brings three.js, Heart its drawing.
const LOADERS: Record<ArtKind, () => Promise<ArtFactory>> = {
  pathways: () => import('./pathways').then((m) => m.createPathways),
  cell: () => import('./cell').then((m) => m.createCell),
  heart: () => import('./heart').then((m) => m.createHeart),
}

export type CareArtHandle = { pulse: (kind: PulseKind, i: number) => void; replay: () => void }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Whether a press landed on a control, which the art should leave alone. */
const onControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('a,button,input,select,textarea,label,[role=button],[role=radio]')

/**
 * The chosen artwork, drawn behind the dashboard. It sits under the cards (pointer-events none), so
 * it follows the pointer and taps through window listeners, measured against its own box.
 */
export function CareArt({ kind, intro, className, ref }: { kind: ArtKind; intro: boolean; className?: string; ref?: Ref<CareArtHandle> }) {
  const box = useRef<HTMLDivElement>(null)
  const art = useRef<Art | null>(null)
  // The intro is decided once, when My Care opens; switching art later redraws it without one.
  const playIntro = useRef(intro)

  useImperativeHandle(ref, () => ({
    pulse: (k, i) => art.current?.pulse(k, i),
    replay: () => art.current?.replay(),
  }))

  useEffect(() => {
    const el = box.current
    if (!el) return
    // A switch or unmount can land between the awaits below; wanted() reads the current answer.
    const run = { live: true }
    const wanted = () => run.live
    let mounted: Art | null = null
    const mount = async (k: ArtKind) => {
      const factory = await LOADERS[k]()
      if (!wanted()) return
      try {
        const a = await factory(el, { intro: playIntro.current, reducedMotion: reducedMotion() })
        playIntro.current = false
        if (!wanted()) return a.dispose()
        mounted = art.current = a
      } catch {
        // No WebGL (an old device, or it is switched off): fall back to the SVG diagram.
        if (k !== 'pathways') await mount('pathways')
      }
    }
    void mount(kind)

    const normalised = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1]
    }
    const onMove = (e: PointerEvent) => art.current?.pointer(...normalised(e))
    const onDown = (e: PointerEvent) => {
      if (!onControl(e.target)) art.current?.tap(...normalised(e), e.pointerType === 'touch')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    return () => {
      run.live = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      mounted?.dispose()
      art.current = null
    }
  }, [kind])

  return <div ref={box} aria-hidden className={cn('pointer-events-none relative overflow-hidden', className)} />
}
