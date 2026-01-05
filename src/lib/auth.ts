import type { APIContext } from 'astro';
import { randomUUID } from 'crypto';
import db from './db.ts';
import type { User, UserSession } from './db.ts';

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7; // 1 week

export const createSession = (userId: string) => {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;

  db.prepare(`
    INSERT INTO user_sessions (session_id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, now, expiresAt);

  return { sessionId, expiresAt };
};

/**
 * Create session and set cookie on the Astro API context.
 * Use this from signin/signup handlers to issue cookie-backed sessions.
 */
export const createSessionAndSetCookie = (context: APIContext, userId: string) => {
  const { sessionId, expiresAt } = createSession(userId);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(expiresAt)
  };
  context.cookies.set('session_id', sessionId, cookieOptions);
  return { sessionId, expiresAt };
};

export const getSession = (context: APIContext): User | null => {
  const cookie = context.cookies.get('session_id');
  if (!cookie?.value) return null;

  const sessionId = cookie.value;

  // 1. Fetch session
  const session = db.prepare(`
    SELECT * FROM user_sessions WHERE session_id = ?
  `).get(sessionId) as UserSession | undefined;

  // 2. Validate session
  if (!session) return null;
  if (Date.now() > session.expires_at) {
    // Clean up expired session
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
    return null;
  }

  // 3. Fetch User
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
  return user || null;
};

export const clearSession = (context: APIContext) => {
  const cookie = context.cookies.get('session_id');
  if (!cookie?.value) return;
  const sessionId = cookie.value;
  try {
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
  } catch (e) {
    // ignore
  }
  context.cookies.set('session_id', '', { path: '/', expires: new Date(0) });
};

export const attachSession = (context: APIContext) => {
  const user = getSession(context);
  // Attach to context.locals if available, otherwise return user
  // Astro's APIContext doesn't have a standardized locals, so return user for handler use
  return user;
};

export const requireAuth = (context: APIContext) => {
  const user = getSession(context);
  if (!user) {
    const res = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    throw res;
  }
  return user;
};

export const isAdmin = (user: User | null) => {
  if (!user) return false;
  return (
    (user.is_admin === 1 && user.email === process.env.ADMIN_EMAIL) ||
    user.is_admin === 2 ||
    user.is_admin === 3
  );
};
