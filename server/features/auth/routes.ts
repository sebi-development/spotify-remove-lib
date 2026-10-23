import { Router } from 'express';
import crypto from 'crypto'
import { config } from '../../config.ts';
import { createSession, deleteSession } from './sessions.ts';
import type { TokenResponse } from './sessions.ts';
import { cancelJob } from '../jobs/jobs.ts';
import { closeSessionSockets } from '../../ws.ts';

export const authRouter: Router = Router();

authRouter.get('/login', (req, res) => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const state = crypto.randomBytes(16).toString('hex');
  const code_challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    response_type: 'code',
    redirect_uri: config.REDIRECT_URI,
    scope: 'user-library-read user-library-modify user-follow-read user-follow-modify playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative',
    state,
    show_dialog: 'true', // always show Spotify's consent screen, so you can switch accounts
    code_challenge_method: 'S256',
    code_challenge,
  });

  const url = `https://accounts.spotify.com/authorize?${params}`;
  const cookieOpts = { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 } as const;
  res
    .cookie('state', state, cookieOpts)
    .cookie('verifier', verifier, cookieOpts)
    .redirect(url);
})

authRouter.get('/callback', async (req, res) => {
  const { state: urlState, code } = req.query;
  const storedState = req.cookies.state;
  const storedVerifier = req.cookies.verifier

  res.clearCookie('state');
  res.clearCookie('verifier')

  if (urlState !== storedState || !storedVerifier) {
    res.status(403).send('Unauthorized');
    return;
  }

  // The user clicked Cancel on Spotify's page (?error=access_denied), or the
  // code is missing/malformed. Either way there is nothing to exchange.
  if (req.query.error || typeof code !== 'string') {
    res.redirect('/?error=login_cancelled');
    return;
  }

  // ── BACK CHANNEL ────────────────────────────────────────────
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    code_verifier: storedVerifier,
    grant_type: 'authorization_code',
    redirect_uri: config.REDIRECT_URI,
    code,
  });

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenRes.status, await tokenRes.text());
      res.status(502).send('Login failed');
      return;
    }

    const tokenData = await tokenRes.json() as TokenResponse;
    const sid = createSession(tokenData);
    res.cookie('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send the browser back to the main page — logged in now
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.status(502).send('Login failed');
  }
})

authRouter.post('/logout', (req, res) => {
  const sid = req.cookies.sid
  if (sid) {
    cancelJob(sid)              // stop a running wipe on purpose, before its session disappears
    closeSessionSockets(sid)    // close every open tab of this session
    deleteSession(sid)
  }

  res.clearCookie('sid')
  res.sendStatus(204)
})
