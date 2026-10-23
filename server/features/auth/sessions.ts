import crypto from 'crypto';
import { config } from '../../config.ts';

type Session = {
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  refreshing?: Promise<void> | undefined;
}
type RefreshResponse = { access_token: string; expires_in: number; refresh_token?: string };

export type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

const sessionsMap = new Map<string, Session>();

export function createSession(t: TokenResponse): string {
  const sid = crypto.randomBytes(24).toString('hex');

  sessionsMap.set(sid, {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000
  });

  return sid;
}

export function getSession(sid: string) {
  return sessionsMap.get(sid)
}

export async function getAccessToken(sid: string): Promise<string> {
  const session = getSession(sid)

  if (!session) throw new Error('Missing session')
  if (session.expiresAt - 60_000 > Date.now()) {
    return session.accessToken
  }
  if (!session.refreshing) {
    session.refreshing = refreshSession(sid, session).finally(() => {
      session.refreshing = undefined;
    });
  }
  await session.refreshing;
  return session.accessToken;
}

async function refreshSession(sid: string, session: Session): Promise<void> {
  const res = await fetch(`https://accounts.spotify.com/api/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: config.CLIENT_ID,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  if (!res.ok) {
    if (res.status >= 400 && res.status < 500) sessionsMap.delete(sid); // spotify reject
    throw new Error(`Error loading refresh token`)
  }

  const data = await res.json() as RefreshResponse
  session.accessToken = data.access_token
  session.expiresAt = Date.now() + data.expires_in * 1000;
  session.refreshToken = data.refresh_token ?? session.refreshToken
}

export function deleteSession(sid: string): void {
  sessionsMap.delete(sid)
}