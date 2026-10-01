// Body of the web hook Kratos sends to the API after registration (C94): only
// the account's ID. The API reads the account itself from Kratos's admin API,
// so nothing else in this body is trusted.
function(ctx) {
  identity_id: ctx.identity.id,
}
