import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'

// One human, one photo. The picture belongs to the *identity*, not to a tenant membership or an
// operator record, so it lives here beside the session rather than in either app's fixtures —
// that is what keeps malecouncil.bool.mv and admin.bool.mv showing the same face for the same
// sign-in. At integration this reads the Kratos identity's `picture` trait and the table goes.

const FIXTURE: { email: string; name: string; src: string }[] = [
  { email: 'mariyam@bool.co', name: 'Mariyam Ahmed', src: avatar5 },
]

/** The signed-in person's photo, or undefined when they have none (the avatar then shows initials). */
export function identityPhoto(user: { name: string; email: string }): string | undefined {
  const email = user.email.trim().toLowerCase()
  const name = user.name.trim().toLowerCase()
  return FIXTURE.find((p) => (email && p.email.toLowerCase() === email) || (name && p.name.toLowerCase() === name))?.src
}
