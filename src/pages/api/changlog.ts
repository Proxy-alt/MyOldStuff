import type { APIRoute } from 'astro';
import db from '../../lib/db';
import { getSession, isAdmin } from '../../lib/auth';
import { randomUUID } from 'crypto';

export const GET: APIRoute = async () => {
  try {
    const changelogs = db.prepare(`
      SELECT c.*, u.username as author_name
      FROM changelog c
      LEFT JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `).all();
    return new Response(JSON.stringify({ changelogs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const user = getSession(context);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!isAdmin(user)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  try {
    const { title, content } = await context.request.json();
    if (!title || !content) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });

    const id = randomUUID();
    const now = Date.now();

    db.prepare('INSERT INTO changelog (id, title, content, author_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, title, content, user.id, now
    );

    return new Response(JSON.stringify({ message: 'Changelog created', id }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
