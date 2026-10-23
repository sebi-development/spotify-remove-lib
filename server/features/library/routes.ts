import { Router } from 'express';
import { CATEGORIES } from './categories.ts';
import { countCategory } from './count.ts';
import { getSession } from '../auth/sessions.ts';
import { HttpError } from '../../lib/errors.ts';

export const libraryRouter: Router = Router();
libraryRouter.get('/summary', async (req, res) => {
  try {
    const pairs = await Promise.all(
      CATEGORIES.map(async (c) => [c.id, await countCategory(res.locals.getToken, c)] as const)
    )

    const counts = Object.fromEntries(pairs)
    res.json({ counts })

  } catch (error) {
    console.error('GET /api/library/summary failed:', error);
    if (!getSession(res.locals.sid)) throw new HttpError(401, 'not_logged_in', 'Please log in first.');
    throw new HttpError(502, 'upstream_error', 'Spotify request failed. Please try again.');
  }

})