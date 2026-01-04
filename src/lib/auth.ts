import type { APIContext } from 'astro';
import { randomUUID } from 'crypto';
import db from './db';
import type { User, UserSession } from './db';

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

export const isAdmin = (user: User | null) => {
  if (!user) return false;
  return (
    (user.is_admin === 1 && user.email === process.env.ADMIN_EMAIL) ||
    user.is_admin === 2 ||
    user.is_admin === 3
  );
};
