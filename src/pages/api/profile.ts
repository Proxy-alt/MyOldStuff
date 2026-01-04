import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';
import { getSession } from '../../lib/auth.ts';

export const GET: APIRoute = async (context) => {
  const user = getSession(context); // You must implement this helper based on your DB

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // Re-fetch to ensure fresh data
    const dbUser = db.prepare('SELECT id, email, username, bio, avatar_url, is_admin, created_at FROM users WHERE id = ?').get(user.id) as any;

    if (!dbUser) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });

    let role = 'User';
    if (dbUser.is_admin === 1 && dbUser.email === process.env.ADMIN_EMAIL) role = 'Owner';
    else if (dbUser.is_admin === 3) role = 'Admin';
    else if (dbUser.is_admin === 2) role = 'Staff';

    return new Response(JSON.stringify({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        user_metadata: {
          name: dbUser.username,
          bio: dbUser.bio,
          avatar_url: dbUser.avatar_url
        },
        app_metadata: {
          provider: 'email',
          is_admin: dbUser.is_admin,
          role
        }
      }
    }), { headers: { 'Content-Type': 'application/json' }});
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
