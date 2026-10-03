import { WORKSPACE, openSignedIn, test } from './helpers'

// Signs the suite's account in once and saves the browser state (cookies), which the app
// projects start from (playwright.config.ts). App journeys then do not sign in again
// before every test, which kept the suite close to the login service's limit of 10 form
// submissions a minute (C112). Platform tests (sign-in, sign-out) still use fresh browsers.
test('sign in once for the app journeys', async ({ page }) => {
  await openSignedIn(page, `${WORKSPACE}/`)
  await page.context().storageState({ path: new URL('../.auth/state.json', import.meta.url).pathname })
})
