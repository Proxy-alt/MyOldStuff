import type { APIRoute } from 'astro';
import { db, eq, Users } from 'astro:db';
import { getSession } from '../../../server/session';

/**
 * GET /api/profile
 * Retrieves the current user's profile information from Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const session = getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await db.select().from(Users).where(eq(Users.id, session.user.id)).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    let role = 'User';
    if (user.is_admin === 1 && user.email === process.env.ADMIN_EMAIL) role = 'Owner';
    else if (user.is_admin === 3) role = 'Admin';
    else if (user.is_admin === 2) role = 'Staff';

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          user_metadata: {
            name: user.username,
            bio: user.bio,
            avatar_url: user.avatar_url
          },
          app_metadata: {
            provider: 'email',
            is_admin: user.is_admin,
            role
          }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching profile:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
