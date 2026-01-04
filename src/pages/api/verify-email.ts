import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');

  if (!token) return new Response('Invalid verification link', { status: 400, headers: { 'Content-Type': 'text/html' }});

  try {
    const user = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(token) as any;
    if (!user) return new Response('Invalid or expired link', { status: 400, headers: { 'Content-Type': 'text/html' }});

    const now = Date.now();
    db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, updated_at = ? WHERE id = ?').run(now, user.id);

    return new Response(`
      <html><body style="background:#0a1d37;color:#fff;font-family:Arial;text-align:center;padding:50px;">
      <h1>Email verified successfully!</h1><p>You can now log in.</p>
      <a href="/pages/settings/p.html" style="color:#3b82f6;">Go to Login</a>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response('Verification failed', { status: 500 });
  }
};
