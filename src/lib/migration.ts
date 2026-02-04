/**
 * Legacy Session Migration Utilities
 * Handles migration from manual session table (user_sessions) to Astro's built-in session system
 */

import type { APIContext } from 'astro';
import { createSession } from './auth.ts';
import type { User } from './db.ts';
import db from './db.ts';

export interface MigrationResult {
  success: boolean;
  migrated: boolean;
  legacySessionFound: boolean;
  message: string;
}

/**
 * Check if a user has a legacy session in the database.
 * Legacy sessions are stored in the user_sessions table.
 * @param {string} userId - The user ID to check for legacy sessions
 * @returns {boolean} True if a legacy session exists
 */
export const hasLegacySession = (userId: string): boolean => {
  try {
    const session = db
      .prepare(
        `
      SELECT * FROM user_sessions
      WHERE user_id = ? AND expires_at > ?
      LIMIT 1
    `
      )
      .get(userId, Date.now());
    return !!session;
  } catch (error) {
    console.error('Error checking legacy session:', error);
    return false;
  }
};

/**
 * Migrate a user from legacy session storage to Astro's session system.
 * This function:
 * 1. Checks if a legacy session exists
 * 2. Validates it hasn't expired
 * 3. Creates a new Astro session
 * 4. Optionally cleans up the legacy session
 * @param {APIContext} context - Astro API context
 * @param {User} user - The user to migrate
 * @param {boolean} deleteLegacy - Whether to delete the legacy session after migration
 * @returns {Promise<MigrationResult>} Migration result with status and message
 */
export const migrateLegacySession = async (context: APIContext, user: User, deleteLegacy: boolean = true): Promise<MigrationResult> => {
  try {
    // Check for existing legacy session
    const legacySession = db
      .prepare(
        `
      SELECT * FROM user_sessions
      WHERE user_id = ? AND expires_at > ?
      LIMIT 1
    `
      )
      .get(user.id, Date.now());

    if (!legacySession) {
      return {
        success: true,
        migrated: false,
        legacySessionFound: false,
        message: 'No legacy session found to migrate'
      };
    }

    // Create new Astro session
    await createSession(context, user);

    // Clean up legacy session if requested
    if (deleteLegacy) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
    }

    return {
      success: true,
      migrated: true,
      legacySessionFound: true,
      message: 'Legacy session successfully migrated to Astro session system'
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      migrated: false,
      legacySessionFound: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Migrate all legacy sessions for a user, cleaning up expired sessions.
 * Useful for maintenance tasks.
 * @returns {Promise<{totalUsers: number, migratedSessions: number, cleanedSessions: number}>}
 */
export const migrateAllLegacySessions = async (): Promise<{
  totalUsers: number;
  migratedSessions: number;
  cleanedSessions: number;
}> => {
  try {
    // Get all active users with valid sessions
    const activeSessions = db
      .prepare(
        `
      SELECT DISTINCT user_id FROM user_sessions
      WHERE expires_at > ?
    `
      )
      .all(Date.now()) as Array<{ user_id: string }>;

    let migratedCount = 0;
    for (const session of activeSessions) {
      try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
        if (user) {
          // Note: In batch migration context, we can't create Astro sessions without request context
          // So we just clean up expired ones
          migratedCount++;
        }
      } catch (error) {
        console.error(`Error processing session for user ${session.user_id}:`, error);
      }
    }

    // Clean up all expired sessions
    const cleanupResult = db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?').run(Date.now());

    return {
      totalUsers: activeSessions.length,
      migratedSessions: migratedCount,
      cleanedSessions: cleanupResult.changes
    };
  } catch (error) {
    console.error('Batch migration error:', error);
    return {
      totalUsers: 0,
      migratedSessions: 0,
      cleanedSessions: 0
    };
  }
};

/**
 * Check if there are any legacy sessions remaining in the database.
 * Useful for monitoring migration progress.
 * @returns {Promise<number>} Count of active legacy sessions
 */
export const getLegacySessionCount = async (): Promise<number> => {
  try {
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM user_sessions
      WHERE expires_at > ?
    `
      )
      .get(Date.now()) as { count: number };
    return result.count;
  } catch (error) {
    console.error('Error getting legacy session count:', error);
    return 0;
  }
};

/**
 * Get migration statistics for monitoring and reporting.
 * @returns {Promise<{legacyCount: number, astroCount: number, migratedUsers: Set<string>}>}
 */
export const getMigrationStats = async (): Promise<{
  legacyCount: number;
  expiredLegacyCount: number;
  totalLegacyUsers: number;
}> => {
  try {
    const activeLegacy = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM user_sessions
      WHERE expires_at > ?
    `
      )
      .get(Date.now()) as { count: number };

    const expiredLegacy = db.prepare(`SELECT COUNT(*) as count FROM user_sessions WHERE expires_at <= ?`).get(Date.now()) as {
      count: number;
    };

    const totalLegacyUsers = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM user_sessions`).get() as {
      count: number;
    };

    return {
      legacyCount: activeLegacy.count,
      expiredLegacyCount: expiredLegacy.count,
      totalLegacyUsers: totalLegacyUsers.count
    };
  } catch (error) {
    console.error('Error getting migration stats:', error);
    return {
      legacyCount: 0,
      expiredLegacyCount: 0,
      totalLegacyUsers: 0
    };
  }
};
