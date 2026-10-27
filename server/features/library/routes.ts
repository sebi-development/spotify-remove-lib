import { Router } from 'express';
import { CATEGORIES } from './categories.ts';
import { countCategory } from './count.ts';
import { getSession } from '../auth/sessions.ts';
import { HttpError } from '../../lib/errors.ts';
import z from 'zod';
import { CATEGORY_IDS } from '../../../shared/protocol.ts';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { backupChunks } from './backup.ts';

const BackupQuery = z.object({
  categories: z.string().transform((s) => s.split(',')).pipe(z.array(z.enum(CATEGORY_IDS)).min(1)),
});
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]))

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

libraryRouter.get('/backup', async (req, res) => {
  const parsed = BackupQuery.safeParse(req.query)
  if (!parsed.success) throw new HttpError(400, 'invalid_categories', 'Error invalid categories')
  const ids = [...new Set(parsed.data.categories)];
  const selected = ids.map((id) => categoryById.get(id)!);
  const today = new Date().toISOString().slice(0, 10)

  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="spotify-backup-${today}.json"`);
    res.setHeader('Cache-Control', 'no-store');

    // Stream
    await pipeline(Readable.from(backupChunks(res.locals.getToken, selected)), res)

  } catch (error) {
    console.error('GET /api/library/backup failed:', error);

    if (res.headersSent) return

    // Safety net for a failure before the first byte (nothing sent yet): answer like /summary.
    if (!getSession(res.locals.sid)) throw new HttpError(401, 'not_logged_in', 'Please log in first.');
    throw new HttpError(502, 'upstream_error', 'Spotify request failed. Please try again.');
  }
})