import type { APIRoute } from 'astro';
import { requireAuth } from '../../lib/auth.ts';
import type { User } from '../../lib/db.ts';
import db from '../../lib/db.ts';

export const POST: APIRoute = async (context) => {
  try {
    const user = requireAuth(context as any) as User;
    const body = await context.request.json();
    const { userId, action } = body;
    if (!userId || !['suspend', 'staff', 'delete', 'ban', 'promote_admin', 'demote_admin'].includes(action))
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    if (userId === user.id) return new Response(JSON.stringify({ error: 'Cannot manage yourself' }), { status: 400 });

    const admin = db.prepare('SELECT is_admin, email FROM users WHERE id = ?').get(user.id) as Partial<User> | undefined;
    const ownerEmail = process.env.ADMIN_EMAIL;
    const isOwner = admin && admin.email === ownerEmail;
    if (!admin || (admin.is_admin! < 1 && admin.is_admin !== 2))
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
    if (!target) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    if (['promote_admin', 'demote_admin', 'staff'].includes(action) && !isOwner)
      return new Response(JSON.stringify({ error: 'Only the owner can manage admin/staff roles.' }), { status: 403 });
    if (target.email === ownerEmail) return new Response(JSON.stringify({ error: 'Cannot manage the owner.' }), { status: 403 });

    if (action === 'staff') {
      db.prepare('UPDATE users SET is_admin = 2 WHERE id = ?').run(userId);
      return new Response(JSON.stringify({ message: 'User promoted to staff.' }), { status: 200 });
    }
    if (action === 'promote_admin') {
      db.prepare('UPDATE users SET is_admin = 3 WHERE id = ?').run(userId);
      return new Response(JSON.stringify({ message: 'User promoted to admin.' }), { status: 200 });
    }
    if (action === 'demote_admin') {
      db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(userId);
      return new Response(JSON.stringify({ message: 'Admin demoted to user.' }), { status: 200 });
    }

    if ([2, 3].includes(admin.is_admin!) || isOwner) {
      if (action === 'suspend') {
        db.prepare('UPDATE users SET email_verified = 0 WHERE id = ?').run(userId);
        return new Response(JSON.stringify({ message: 'User suspended.' }), { status: 200 });
      }
      if (action === 'ban') {
        try {
          db.prepare('ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0').run();
        } catch (e) {
          // ignore if column exists
        }
        db.prepare('UPDATE users SET banned = 1, email_verified = 0 WHERE id = ?').run(userId);
        return new Response(JSON.stringify({ message: 'User and IP banned.' }), { status: 200 });
      }
      if (action === 'delete') {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        return new Response(JSON.stringify({ message: 'User deleted.' }), { status: 200 });
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown or unauthorized action' }), { status: 400 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Admin action error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
