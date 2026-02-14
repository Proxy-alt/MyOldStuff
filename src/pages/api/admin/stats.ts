import type { APIRoute } from 'astro';
import { Changelog, Comments, count as countFn, db, Feedback, Users } from 'astro:db';
import { isAdmin } from '../../../../server/session';

/**
 * GET /api/admin/stats
 * Retrieves admin statistics using Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const adminCheck = await isAdmin(context);

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Unauthorized - admin only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Count statistics
    const userCountResult = await db.select({ count: countFn() }).from(Users);
    const commentCountResult = await db.select({ count: countFn() }).from(Comments);
    const feedbackCountResult = await db.select({ count: countFn() }).from(Feedback);
    const changelogCountResult = await db.select({ count: countFn() }).from(Changelog);

    return new Response(
      JSON.stringify({
        stats: {
          userCount: userCountResult[0]?.count || 0,
          commentCount: commentCountResult[0]?.count || 0,
          feedbackCount: feedbackCountResult[0]?.count || 0,
          changelogCount: changelogCountResult[0]?.count || 0
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get admin stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch admin stats' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
