import { Router } from 'express';
import { requireSession } from './features/auth/middleware.ts';
import { api } from './lib/spotify.ts';
import { getSession } from './features/auth/sessions.ts';
import { HttpError } from './lib/errors.ts';
import { libraryRouter } from './features/library/routes.ts';

export const apiRouter: Router = Router()
apiRouter.use(requireSession);
apiRouter.use('/library', libraryRouter);

apiRouter.get('/me', async (req, res) => {
  try {
    const data = await api(res.locals.getToken, '/me') as { id: string; display_name?: string }
    res.json({ id: data.id, displayName: data.display_name ?? data.id })
  } catch (error) {
    console.error('GET /api/me failed:', error)
    // refreshSession deletes the session when Spotify rejects the refresh token:
    // "session gone" means log in again, anything else is an upstream failure.
    if (!getSession(res.locals.sid)) throw new HttpError(401, 'not_logged_in', 'Please log in first.')
    throw new HttpError(502, 'upstream_error', 'Spotify request failed. Please try again.')
  }
})
