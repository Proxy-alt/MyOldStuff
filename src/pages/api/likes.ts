import type { APIRoute } from 'astro';
import { randomUUID } from 'crypto';
import db from '../../lib/db.ts';
import { requireAuth } from '../../lib/auth.ts';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const targetId = url.searchParams.get('targetId');
    if (!['changelog', 'feedback'].includes(type || '') || !targetId) return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE type = ? AND target_id = ?').get(type, targetId)?.count || 0;
    return new Response(JSON.stringify({ count }), { status: 200 });
  } catch (err) {
    console.error('Get likes error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireAuth(context as any);
    const { type, targetId } = await context.request.json();
    if (!['changelog', 'feedback'].includes(type || '') || !targetId) return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    const id = randomUUID();
    const now = Date.now();
    try {
      db.prepare('INSERT INTO likes (id, type, target_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)').run(id, type, targetId, (user as any).id, now);
      return new Response(JSON.stringify({ message: 'Liked!' }), { status: 200 });
    } catch (e) {
      // unique constraint -> already liked; remove
      db.prepare('DELETE FROM likes WHERE type = ? AND target_id = ? AND user_id = ?').run(type, targetId, (user as any).id);
      return new Response(JSON.stringify({ message: 'Unliked.' }), { status: 200 });
    }
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Like error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
