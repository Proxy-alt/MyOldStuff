import type { APIRoute } from 'astro';
import { db, eq, Users } from 'astro:db';
import bcrypt from 'bcrypt';
import { setUserSession } from '../../../server/session';

/**
 * POST /api/signin
 * Authenticates user with email and password, creates session
 */
export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.select().from(Users).where(eq(Users.email, email)).first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!user.email_verified) {
      return new Response(JSON.stringify({ error: 'Email not verified' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Create Astro session with HTTP-only cookie
    await setUserSession(context, {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin
    });

    return new Response(JSON.stringify({ message: 'Signed in successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Signin error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
