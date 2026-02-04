import type { APIContext } from 'astro';
import type { User } from './db.ts';
import db from './db.ts';

/**
 * Create a user session using Astro's built-in session management.
 * @param {APIContext} context - Astro API context object
 * @param {User} user - The user object to store in the session
 * @returns {Promise<void>}
 */
export const createSession = async (context: APIContext, user: User): Promise<void> => {
  const sessionUser: App.SessionData['user'] = {
    id: user.id,
    email: user.email,
    username: user.username || 'User',
    is_admin: user.is_admin,
    avatar_url: user.avatar_url || undefined,
    bio: user.bio || undefined,
    created_at: user.created_at,
    updated_at: user.updated_at
  };

  await context.session?.set('user', sessionUser);
};

/**
 * Retrieve the current user session using Astro's built-in session management.
 * @param {APIContext} context - Astro API context object
 * @returns {Promise<User | null>} The user object if a valid session exists, null otherwise
 */
export const getSession = async (context: APIContext): Promise<User | null> => {
  const sessionUser = await context.session?.get('user');
  if (!sessionUser) return null;

  // Fetch the full user record from database to ensure fresh data
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionUser.id) as User | undefined;
  return user || null;
};

/**
 * Clear the user session using Astro's built-in session management.
 * @param {APIContext} context - Astro API context object
 * @returns {Promise<void>}
 */
export const clearSession = async (context: APIContext): Promise<void> => {
  await context.session?.delete('user');
};

/**
 * Attach a user session to the context or return the user.
 * For Astro's APIContext, returns the user object for handler use.
 * @param {APIContext} context - Astro API context object
 * @returns {Promise<User | null>} The user object if a valid session exists, null otherwise
 */
export const attachSession = async (context: APIContext): Promise<User | null> => {
  const user = await getSession(context);
  return user;
};

/**
 * Require a valid authenticated session. Throws a 401 response if not authenticated.
 * @param {APIContext} context - Astro API context object
 * @returns {Promise<User>} The authenticated user object
 * @throws {Response} Response with 401 status if user is not authenticated
 */
export const requireAuth = async (context: APIContext): Promise<User> => {
  const user = await getSession(context);
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
