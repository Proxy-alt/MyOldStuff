import type { APIRoute } from 'astro';
import { clearSession } from '../../../server/session';

/**
 * POST /api/signout
 * Clears user session and logs out
 */
export const POST: APIRoute = async (context) => {
  try {
    await clearSession(context);
    return new Response(JSON.stringify({ message: 'Signed out successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Signout error:', error);
    return new Response(JSON.stringify({ error: 'Failed to sign out' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
