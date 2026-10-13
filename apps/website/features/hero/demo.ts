import recording from './demo-chapters.json'

/**
 * The product demo the tablet plays once the scroll story brings it to the centre: a scripted
 * recording of the workspace (scripts/demo-recording, which also writes demo-chapters.json), in
 * chapters. Each chapter has a caption beside the tablet; scrolling moves from one to the next, the
 * recording jumps to it and loops it while it is on screen.
 */
export const DEMO = {
  mp4: '/hero/demo/demo.mp4',
  webm: '/hero/demo/demo.webm',
  poster: '/hero/demo/poster.jpg',
  duration: recording.duration,
} as const

const CAPTIONS: Record<string, { title: string; body: string }> = {
  home: { title: 'Your day, at a glance', body: 'What is due, who you are meeting and what needs you, the moment you sign in.' },
  inventory: { title: 'Stock that flags itself', body: 'Low stock, overdue orders and waiting approvals surface before they become problems.' },
  calendar: { title: 'Meetings in a few keystrokes', body: 'Find a room, invite the team and send. No back-and-forth.' },
  'control-centre': { title: 'Set up once, used everywhere', body: 'Sites, people and approval chains live in one place that every app reads.' },
}

/**
 * The camera: where the tablet's screen gently zooms while the recording plays, as the script
 * recorded it: from time `t` (seconds), the point (x, y, fractions of the screen) it moves toward,
 * how far in (scale; 1 is the whole screen) and the box the spotlight picks out (left, top, width,
 * height as fractions; null for none).
 */
export const CAMERA = recording.camera

/** The chapters in order, each with where it starts and ends in the recording (seconds) and its caption. */
export const CHAPTERS = recording.chapters.map((c, i, all) => ({
  id: c.id,
  start: c.start,
  end: all[i + 1]?.start ?? recording.duration,
  ...CAPTIONS[c.id],
}))
