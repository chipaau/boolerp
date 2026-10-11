// The sign-in providers' own marks, as each asks its sign-in buttons to show them (from the approved
// prototype): Google's four-colour G, Apple's logo in white on the dark button, Facebook's blue f.

export function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function AppleMark() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="#FFFFFF">
      <path d="M16.37 1.43c0 1.14-.46 2.23-1.21 3.03-.8.86-2.1 1.52-3.17 1.43-.14-1.1.41-2.25 1.15-3.02.82-.87 2.22-1.5 3.23-1.44zM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.52-1.54.01-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07 1-1.73-.02-3.05-1.77-4.04-3.33C-.07 15.9-.36 10.9 1.36 8.26 2.58 6.38 4.5 5.28 6.3 5.28c1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.31.88 4.52 2.39-3.97 2.18-3.33 7.85.65 9.43z" />
    </svg>
  )
}

export function FacebookMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"
      />
    </svg>
  )
}
