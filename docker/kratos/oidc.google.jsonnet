// Maps a Google (or, locally, the stand-in provider's) profile to an account
// (C85). A profile without an email Google reports as verified is refused:
// registration through Google signs in at once (the session hook), so the
// address must already be verified; otherwise Kratos would ask for an email and
// accept any address typed. The address is marked verified; the phone is not in
// Google's profile, so Kratos asks for it. Google's picture becomes the
// optional picture trait.
local claims = std.extVar('claims');
local verified = std.objectHas(claims, 'email') && std.objectHas(claims, 'email_verified') && claims.email_verified == true;

if !verified then
  error 'Google did not confirm this account\'s email address. Sign in with a password instead.'
else
  {
    identity: {
      traits: {
        email: claims.email,
        [if std.objectHas(claims, 'name') then 'name']: claims.name,
        [if std.objectHas(claims, 'picture') then 'picture']: claims.picture,
      },
      verified_addresses: [
        { via: 'email', value: claims.email },
      ],
    },
  }
