/**
 * Session Management with Astro Native Sessions
 * Uses context.session for server-side session storage
 * Sessions are stored server-side with only a session ID in the cookie
 *
 * @see types/astro-session.ts for TypeScript interfaces
 * @see https://docs.astro.build/en/guides/sessions/
 */

import type { APIContext } from 'astro';
import { db, eq, Users } from 'astro:db';
import { randomUUID } from 'crypto';

// Re-export types from dedicated types file
export { DEFAULT_SESSION_CONFIG } from '../types/astro-session';
export type { AstroSession, AuthContext, SessionCookieOptions, SessionUser, UserProfile } from '../types/astro-session';

// Import types for internal use
import type { AstroSession, SessionUser } from '../types/astro-session';

/**
 * Type-safe wrapper for storing serializable session data
 * Works around the Astro session API's strict typing
 */
function storeInSession(context: APIContext, key: string, value: unknown): void {
  const store = context.session as any;
  if (store?.set) {
    store.set(key, value);
  }
}

/**
 * Type-safe wrapper for retrieving session data
 */
async function retrieveFromSession(context: APIContext, key: string): Promise<unknown> {
  const store = context.session as any;
  if (store?.get) {
    return store.get(key);
  }
  return undefined;
}

export function generateId(): string {
  return randomUUID();
}

/**
 * Get the current user session from Astro context
 * Returns the stored session user data from server-side session storage
 */
export async function getSession(context: APIContext): Promise<AstroSession | null> {
  try {
    if (!context.session) {
      return null;
    }

    // Get user and created_at from session storage using Astro's session API
    const user = (await retrieveFromSession(context, 'user')) as SessionUser | undefined;

    if (!user) {
      return null;
    }

    return {
      user,
      created_at: Date.now()
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Get current authenticated user from database using session
 */
export async function getCurrentUser(context: APIContext): Promise<SessionUser | null> {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return null;
    }

    const users = await db.select().from(Users).where(eq(Users.id, session.user.id));
    const user = users[0];

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Set user session in context
 * Session data is stored server-side in context.session storage
 */
export function setUserSession(
  context: APIContext,
  user: SessionUser,
  expiresIn: number = 1000 * 60 * 60 * 24 * 7 // 7 days
): void {
  const sessionData: AstroSession = {
    user,
    created_at: Date.now()
  };

  // Store user in session (Astro session expects Users table structure)
  storeInSession(context, 'user', user);
}

/**
 * Clear user session from context
 */
export function clearSession(context: APIContext): void {
  context.session?.destroy();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(context: APIContext): Promise<boolean> {
  const session = await getSession(context);
  return !!session?.user?.id;
}

/**
 * Check if user is admin
 */
export async function isAdmin(context: APIContext): Promise<boolean> {
  const user = await getCurrentUser(context);
  return !!user && user.is_admin > 0;
}

/**
 * Get client IP address from context or headers
 */
export function getClientIP(input: APIContext | Headers): string {
  const headers = input instanceof Headers ? input : input.request.headers;

  const forwarded = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  const cfIP = headers.get('cf-connecting-ip');
  const trueClientIP = headers.get('true-client-ip');

  let ip: string | null = null;

  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  } else if (cfIP) {
    ip = cfIP;
  } else if (trueClientIP) {
    ip = trueClientIP;
  } else if (realIP) {
    ip = realIP;
  }

  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  return ip || 'unknown';
}

/**
 * Create a new user session after authentication
 */
export async function createSession(context: APIContext, userId: string): Promise<boolean> {
  try {
    const users = await db.select().from(Users).where(eq(Users.id, userId));
    const user = users[0];

    if (!user) {
      return false;
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin
    };

    setUserSession(context, sessionUser);
    return true;
  } catch (error) {
    console.error('Failed to create session:', error);
    return false;
  }
}

/**
 * Verify session is still valid (user still exists in database)
 */
export async function verifySession(context: APIContext): Promise<boolean> {
  const session = await getSession(context);
  if (!session?.user?.id) {
    return false;
  }

  try {
    const users = await db.select().from(Users).where(eq(Users.id, session.user.id));
    return users.length > 0;
  } catch (error) {
    console.error('Failed to verify session:', error);
    return false;
  }
}

/**
 * Update session after user profile changes
 */
export function updateSession(context: APIContext, updates: Partial<SessionUser>): void {
  // Get current user from session and merge updates
  const store = context.session as any;
  if (store?.get && store?.set) {
    const currentUser = store.get('user') as SessionUser | undefined;
    if (currentUser) {
      const updatedUser: SessionUser = {
        ...currentUser,
        ...updates
      };
      storeInSession(context, 'user', updatedUser);
    }
  }
}
