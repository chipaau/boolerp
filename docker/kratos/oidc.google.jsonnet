// Maps a Google (or, locally, the stand-in provider's) profile to an account
// (C85). Only an address Google reports as verified is copied, and it is marked
// verified; the phone is not in Google's profile, so Kratos asks for it.
local claims = std.extVar('claims');
local verified = std.objectHas(claims, 'email') && std.objectHas(claims, 'email_verified') && claims.email_verified;

{
  identity: {
    traits: {
      [if verified then 'email']: claims.email,
      [if std.objectHas(claims, 'name') then 'name']: claims.name,
    },
    [if verified then 'verified_addresses']: [
      { via: 'email', value: claims.email },
    ],
  },
}
