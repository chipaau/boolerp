import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

/** The signed-in person the fake BFF answers with. */
export const staff = { id: '0192f6a0-0000-7000-8000-00000000a001', email: 'staff@bool.test', phone: '+9607000000', displayName: 'Test Staff' }

/**
 * The fake API for page tests (C175): the signed-in user is always answered, so the console's
 * session guard lets pages render; each test adds the handlers it needs with `server.use`.
 */
export const server = setupServer(http.get('/api/auth/me', () => HttpResponse.json({ user: staff, clientId: 'erp-admin' })))
