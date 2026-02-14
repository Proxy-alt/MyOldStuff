import type { APIRoute } from 'astro';
import { db, eq, Users } from 'astro:db';
import { getSession } from '../../../server/session';

/**
 * POST /api/update-profile
 * Updates the current user's profile information
 */
export const POST: APIRoute = async (context) => {
  try {
    const session = getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const { username, bio, age, school } = body;
    const now = new Date();

    await db
      .update(Users)
      .set({
        username: username || null,
        bio: bio || null,
        age: age || null,
        school: school || null,
        updated_at: now
      })
      .where(eq(Users.id, session.user.id));

    return new Response(JSON.stringify({ message: 'Profile updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
