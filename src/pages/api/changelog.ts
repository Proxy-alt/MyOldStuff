import type { APIRoute } from 'astro';
import { Changelog, db } from 'astro:db';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '../../../server/session';

/**
 * GET /api/changelog
 * Retrieves changelog entries using Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const changelog = await db.select().from(Changelog).orderBy(Changelog.created_at);

    return new Response(JSON.stringify({ changelog }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Get changelog error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch changelog' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * POST /api/changelog
 * Creates a new changelog entry (admin only) using Astro DB
 */
export const POST: APIRoute = async (context) => {
  try {
    const user = await getCurrentUser(context);

    if (!user || !user.is_admin) {
      return new Response(JSON.stringify({ error: 'Unauthorized - admin only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const { title, content } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(Changelog).values({
      id,
      title: title.trim(),
      content: content.trim(),
      author_id: user.id,
      created_at: now
    });

    return new Response(JSON.stringify({ message: 'Changelog entry created successfully' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Post changelog error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create changelog entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
