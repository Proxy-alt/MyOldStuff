import type { APIRoute } from 'astro';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import db from '../../lib/db.ts';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, username } = await request.json();

    // Check if user exists
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) {
      return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const verificationToken = randomUUID();
    const now = Date.now();

    // Insert new user
    // Note: defaulting is_admin, email_verified to 0 as per your schema defaults, but good to be explicit if needed
    db.prepare(
      `
        INSERT INTO users (id, email, password_hash, username, created_at, updated_at, verification_token, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `
    ).run(userId, email, hashedPassword, username || 'User', now, now, verificationToken);

    // TODO: Send email with verificationToken here

    return new Response(JSON.stringify({ message: 'Account created' }), { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
