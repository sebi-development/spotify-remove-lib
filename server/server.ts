import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.ts';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './features/auth/routes.ts';
import { apiRouter } from './api.ts';
import { attachWebSocket } from './ws.ts';
import { HttpError } from './lib/errors.ts';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = config.NODE_ENV === 'production';
const clientDir = path.join(__dirname, '..', 'client');

const app = express();
// The strict CSP blocks Vite's inline hot-reload scripts, so it is only on in production,
// where the page is the built, external-script bundle.
app.use(helmet({ contentSecurityPolicy: isProduction }));
app.use(cookieParser());

// ── FRONT CHANNEL ──────────────────────────────────────────────
app.use(authRouter);
app.use('/api', apiRouter);
// An unknown /api path must be a JSON 404, not the frontend's index.html (the SPA fallback below).
app.use('/api', () => {
  throw new HttpError(404, 'not_found', 'No such API route.');
});

// ── FRONTEND (React) ───────────────────────────────────────────
// Development: Vite runs inside this server, so the page, /api and /ws share one origin.
// Production: serve the built files from client/dist.
if (isProduction) {
  const dist = path.join(clientDir, 'dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite'); // dev-only dependency
  const vite = await createViteServer({
    configFile: path.join(clientDir, 'vite.config.ts'),
    server: { middlewareMode: true }, // hot reload uses its own port, so ws.ts's /ws upgrade check is untouched
  });
  app.use(vite.middlewares);
}

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