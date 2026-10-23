import type { RequestHandler } from 'express';
import { getAccessToken, getSession } from './sessions.ts';
import { HttpError } from '../../lib/errors.ts';

export const requireSession: RequestHandler = (req, res, next) => {
  const sid = req.cookies.sid
  if (!sid || !getSession(sid)) throw new HttpError(401, 'not_logged_in', 'Please log in first.')
  res.locals.sid = sid
  res.locals.getToken = () => getAccessToken(sid)
  next()
}