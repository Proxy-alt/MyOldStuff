import type { APIRoute } from 'astro';
import { db, eq, Users } from 'astro:db';
import { clearSession, getSession } from '../../../server/session';

/**
 * DELETE /api/delete-account
 * Deletes the current user's account and session
 */
export const DELETE: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Delete user from database
    await db.delete(Users).where(eq(Users.id, session.user.id));

    // Clear session
    await clearSession(context);

    return new Response(JSON.stringify({ message: 'Account deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
