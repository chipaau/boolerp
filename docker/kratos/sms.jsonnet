// Body of an SMS posted to the courier's HTTP channel. In development it goes to
// Mailpit's send API, so texts appear in the same inbox as email (C85);
// production replaces the channel's URL and this body with the SMS gateway's.
function(ctx) {
  From: { Email: 'sms@bool.test', Name: 'SMS' },
  To: [{ Email: ctx.recipient + '@sms.bool.test' }],
  Subject: 'SMS to ' + ctx.recipient,
  Text: ctx.body,
}
