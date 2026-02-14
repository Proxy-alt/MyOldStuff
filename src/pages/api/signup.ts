import type { APIRoute } from 'astro';
import { db, Users } from 'astro:db';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { setUserSession } from '../../../server/session';

/**
 * POST /api/signup
 * Creates a new user account and initializes session
 */
export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const { email, password, username } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user already exists by querying directly (no filter needed for existence check)
    const existing = await db.select().from(Users).first();

    // For existence check, we need to query all and filter
    // In Astro DB, better to just try insert and catch unique constraint error
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const now = new Date();

    try {
      // Insert new user
      await db.insert(Users).values({
        id: userId,
        email,
        password_hash: hashedPassword,
        username: username || 'User',
        created_at: now,
        updated_at: now,
        email_verified: 1, // Auto-verify for now (change in production)
        is_admin: 0,
        bio: null,
        avatar_url: null,
        school: null,
        age: null,
        ip: null,
        verification_token: null
      });
    } catch (insertError: any) {
      if (insertError.message?.includes('UNIQUE') || insertError.message?.includes('unique')) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      throw insertError;
    }

    // Set session for new user
    await setUserSession(context, {
      id: userId,
      email,
      username: username || 'User',
      bio: null,
      avatar_url: null,
      is_admin: 0
    });

    return new Response(JSON.stringify({ message: 'Account created successfully' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
