import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';

export const POST: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get('session_id')?.value;

  if (sessionId) {
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
  }

  // Remove cookie
  cookies.delete('session_id', { path: '/' });

  return new Response(JSON.stringify({ message: 'Signout successful' }), { status: 200 });
};
