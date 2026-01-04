import type { APIRoute } from 'astro';
import db from '../../lib/db';
import bcrypt from 'bcrypt';
import { createSession } from '../../lib/auth';
import type { User } from '../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    // Explicitly cast the result to User type
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    if (!user.email_verified) {
       return new Response(JSON.stringify({ error: 'Email not verified' }), { status: 403 });
    }

    // Create DB Session
    const { sessionId, expiresAt } = createSession(user.id);

    // Set Cookie
    cookies.set('session_id', sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: import.meta.env.PROD,
        expires: new Date(expiresAt)
    });

    return new Response(JSON.stringify({ message: 'Signed in' }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
