import recording from './demo-chapters.json'

/**
 * The product demo the tablet plays once the scroll story brings it to the centre: a scripted
 * recording of the workspace (scripts/demo-recording, which also writes demo-chapters.json), in
 * chapters. It plays on its own, start to end and round again, each chapter's caption under the
 * tablet as it plays. Nothing of it loads until the story starts.
 */
export const DEMO = {
  // 2560×1600, and 1600×1000 (-sm) for screens that do not need the larger one (scripts/demo-recording/run.sh)
  mp4: '/hero/demo/demo.mp4',
  webm: '/hero/demo/demo.webm',
  mp4Small: '/hero/demo/demo-sm.mp4',
  webmSmall: '/hero/demo/demo-sm.webm',
  poster: '/hero/demo/poster.jpg',
  duration: recording.duration,
} as const

/**
 * Points the video at the recording: the smaller encode only when the screen will show it well
 * under its 1600px width (`need`: the screen's width on the tablet, in device pixels, with any
 * zoom), since UI text softens quickly once a video is scaled up; the larger otherwise. WebM (VP9,
 * about a third lighter) where the browser plays it, else MP4 (H.264, Safari).
 */
export function loadDemo(video: HTMLVideoElement, need: number) {
  if (video.src) return
  const small = need <= 1300
  const webm = video.canPlayType('video/webm; codecs="vp9"') !== ''
  video.poster = DEMO.poster
  video.src = small ? (webm ? DEMO.webmSmall : DEMO.mp4Small) : webm ? DEMO.webm : DEMO.mp4
  video.preload = 'auto'
  video.load()
}

const CAPTIONS: Record<string, { title: string; body: string }> = {
  home: { title: 'Your day, at a glance', body: 'What is due, who you are meeting and what needs you, the moment you sign in.' },
  inventory: { title: 'Stock that flags itself', body: 'Low stock, overdue orders and waiting approvals surface before they become problems.' },
  theme: { title: 'Easy on the eyes, day or night', body: 'Light or dark, every app follows the theme you choose.' },
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
