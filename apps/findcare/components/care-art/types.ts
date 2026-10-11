// The My Care artwork behind the dashboard. Three are drawn — Pathways (the original care diagram),
// Cell and Heart — and the patient picks one. Each draws into a container it is given and answers
// the same few calls, so the dashboard drives whichever is showing the same way.

export type ArtKind = 'pathways' | 'cell' | 'heart'

export const ART_KINDS: { kind: ArtKind; label: string }[] = [
  { kind: 'pathways', label: 'Pathways' },
  { kind: 'cell', label: 'Cell' },
  { kind: 'heart', label: 'Heart' },
]

/** What happened, so the art can answer in kind: the queue moved, a slot opened, or a tap. */
export type PulseKind = 'queue' | 'slot'

export type ArtOptions = {
  /** Prefer stillness: no drawing-in intro, gentler motion. Otherwise every artwork draws in as it loads. */
  reducedMotion: boolean
}

export interface CareArt {
  /** Something happened on the dashboard; i picks which ring or element answers (Pathways). */
  pulse: (kind: PulseKind, i: number) => void
  /** The pointer, normalised to the art's box: -1…1 on each axis (outside the box goes beyond). */
  pointer: (x: number, y: number) => void
  /** A tap at a normalised point; touch makes it a little stronger. */
  tap: (x: number, y: number, touch: boolean) => void
  /** Plays the intro again. */
  replay: () => void
  /** Stops drawing and frees what it held (WebGL contexts, timers). */
  dispose: () => void
}

export type ArtFactory = (container: HTMLElement, options: ArtOptions) => CareArt | Promise<CareArt>
