import type { APIRoute } from 'astro';
import { clearSession } from '../../lib/auth.ts';

export const POST: APIRoute = async (context) => {
  await clearSession(context as any);
  return new Response(JSON.stringify({ message: 'Signout successful' }), { status: 200 });
};
