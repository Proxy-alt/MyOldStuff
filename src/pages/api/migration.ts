import type { APIRoute } from 'astro';
import { getSession, isAdmin } from '../../lib/auth.ts';
import { getMigrationStats, migrateAllLegacySessions, migrateLegacySession } from '../../lib/migration.ts';

/**
 * GET /api/migration/status
 * Get migration statistics (admin only)
 */
export const GET: APIRoute = async (context) => {
  try {
    const user = await getSession(context);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    if (!isAdmin(user)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

    const stats = await getMigrationStats();
    return new Response(JSON.stringify(stats), { status: 200 });
  } catch (error) {
    console.error('Migration status error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

/**
 * POST /api/migration/migrate-self
 * Migrate current user's legacy session to Astro session
 */
export const POST: APIRoute = async (context) => {
  try {
    const user = await getSession(context);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const result = await migrateLegacySession(context as any, user, true);
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Self migration error:', error);
    return new Response(JSON.stringify({ error: 'Migration failed', success: false }), { status: 500 });
  }
};

/**
 * POST /api/migration/cleanup
 * Clean up expired legacy sessions (admin only)
 */
export const PATCH: APIRoute = async (context) => {
  try {
    const user = await getSession(context);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    if (!isAdmin(user)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

    const result = await migrateAllLegacySessions();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error('Batch migration error:', error);
    return new Response(JSON.stringify({ error: 'Migration failed' }), { status: 500 });
  }
};
