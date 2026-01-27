import type { APIContext } from 'astro';
import { randomUUID } from 'crypto';
import type { User, UserSession } from './db.ts';
import db from './db.ts';

/** Session duration in milliseconds (1 week) */
const SESSION_DURATION: number = 1000 * 60 * 60 * 24 * 7;

/**
 * Create a new user session in the database.
 * @param {string} userId - The ID of the user to create a session for
 * @returns {{sessionId: string, expiresAt: number}} Object containing the session ID and expiration timestamp
 */
export const createSession = (userId: string): { sessionId: string; expiresAt: number } => {
  const sessionId: string = randomUUID();
  const now: number = Date.now();
  const expiresAt: number = now + SESSION_DURATION;

  db.prepare(
    `
    INSERT INTO user_sessions (session_id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(sessionId, userId, now, expiresAt);

  return { sessionId, expiresAt };
};

/**
 * Create a session and set an HTTP-only cookie on the Astro API context.
 * Use this from signin/signup handlers to issue cookie-backed sessions.
 * @param {APIContext} context - Astro API context object
 * @param {string} userId - The ID of the user to create a session for
 * @returns {{sessionId: string, expiresAt: number}} Object containing the session ID and expiration timestamp
 */
export const createSessionAndSetCookie = (context: APIContext, userId: string): { sessionId: string; expiresAt: number } => {
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

/**
 * Retrieve a user session from the database by cookie ID.
 * Validates session expiration and cleans up expired sessions.
 * @param {APIContext} context - Astro API context object
 * @returns {User | null} The user object if a valid session exists, null otherwise
 */
export const getSession = (context: APIContext): User | null => {
  const cookie = context.cookies.get('session_id');
  if (!cookie?.value) return null;

  const sessionId: string = cookie.value;

  // Fetch session record
  const session = db
    .prepare(
      `
    SELECT * FROM user_sessions WHERE session_id = ?
  `
    )
    .get(sessionId) as UserSession | undefined;

  // Validate session exists
  if (!session) return null;

  // Check if session is expired
  if (Date.now() > session.expires_at) {
    // Clean up expired session
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
    return null;
  }

  // Fetch and return user
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
  return user || null;
};

/**
 * Clear a user session by removing it from the database and deleting the session cookie.
 * @param {APIContext} context - Astro API context object
 * @returns {void}
 */
export const clearSession = (context: APIContext): void => {
  const cookie = context.cookies.get('session_id');
  if (!cookie?.value) return;
  const sessionId: string = cookie.value;
  try {
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
  } catch (e) {
    // Ignore errors during session cleanup
  }
  context.cookies.set('session_id', '', { path: '/', expires: new Date(0) });
};

/**
 * Attach a user session to the context or return the user.
 * For Astro's APIContext, returns the user object for handler use.
 * @param {APIContext} context - Astro API context object
 * @returns {User | null} The user object if a valid session exists, null otherwise
 */
export const attachSession = (context: APIContext): User | null => {
  const user = getSession(context);
  return user;
};

/**
 * Require a valid authenticated session. Throws a 401 response if not authenticated.
 * @param {APIContext} context - Astro API context object
 * @returns {User} The authenticated user object
 * @throws {Response} Response with 401 status if user is not authenticated
 */
export const requireAuth = (context: APIContext): User => {
  const user = getSession(context);
  if (!user) {
    const res = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    throw res;
  }
  return user;
};

/**
 * Check if a user has admin privileges.
 * A user is considered an admin if:
 * - is_admin=1 and email matches ADMIN_EMAIL environment variable
 * - is_admin=2 (super admin)
 * - is_admin=3 (full admin)
 * @param {User | null} user - The user object to check
 * @returns {boolean} True if the user is an admin, false otherwise
 */
export const isAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return (user.is_admin === 1 && user.email === process.env.ADMIN_EMAIL) || user.is_admin === 2 || user.is_admin === 3;
};
