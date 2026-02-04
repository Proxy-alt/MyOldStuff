import type { APIRoute } from 'astro';
import bcrypt from 'bcrypt';
import { createSession } from '../../lib/auth.ts';
import type { User } from '../../lib/db.ts';
import db from '../../lib/db.ts';
import { migrateLegacySession } from '../../lib/migration.ts';

export const POST: APIRoute = async ({ request, ...context }) => {
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

    // Create Astro session
    await createSession(context as any, user);

    // Attempt to migrate legacy session if one exists
    const migrationResult = await migrateLegacySession(context as any, user, true);
    const migrated = migrationResult.migrated;

    return new Response(JSON.stringify({ message: 'Signed in', migrated }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
