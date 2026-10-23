import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.ts';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { api } from './lib/spotify.ts';
import { runCleanup } from './features/library/cleaner.ts';
import { getAccessToken } from './features/auth/sessions.ts';
import { authRouter } from './features/auth/routes.ts';
import { apiRouter } from './api.ts';
import { attachWebSocket } from './ws.ts';
import { CATEGORIES } from './features/library/categories.ts';
import { HttpError } from './lib/errors.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cookieParser());

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── FRONT CHANNEL ──────────────────────────────────────────────
app.use(authRouter);
app.use('/api', apiRouter);

app.post('/cleanup', async (req, res) => {
  const sid = req.cookies.sid;
  // From here on, every Spotify call asks for a (possibly refreshed) token.
  const getToken = () => getAccessToken(sid);
  try {
    await getToken(); // fail fast with 401 if the session is gone
  } catch {
    res.status(401).send('Not logged in — visit / and log in first');
    return;
  }

  if (req.query.confirm !== 'DELETE') {
    res.status(400).send('Pass ?confirm=DELETE to confirm you want to wipe your library.');
    return;
  }

  // No default for a destructive action: the caller must say which one it wants.
  const dryRunParam = req.query.dryRun;
  if (dryRunParam !== 'true' && dryRunParam !== 'false') {
    res.status(400).send('Pass ?dryRun=true (preview) or ?dryRun=false (real wipe) explicitly.');
    return;
  }
  const dryRun = dryRunParam === 'true';

  try {
    // Log WHOSE library this is before anything is touched.
    const me = await api(getToken, '/me') as { id: string; display_name?: string };
    console.log(`[cleanup] ${dryRun ? 'DRY RUN' : 'REAL WIPE'} for "${me.display_name ?? me.id}" (${me.id})`);

    const summary = await runCleanup(getToken, {
      categories: CATEGORIES.map((c) => c.id),
      dryRun,
      onEvent: (e) => console.log('[cleanup]', e),
    });
    res.json(summary);
  } catch (error) {
    console.error('Cleanup failed:', error);
    res.status(502).send('Cleanup failed — see the server log for details.');
  }
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error('Unhandled error:', err); // unknown error: log it, never send its text to the client
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong.' } });
})


const server = app.listen(config.PORT, () => {
  console.log(`Server running → http://127.0.0.1:${config.PORT}`);
});

attachWebSocket(server);
