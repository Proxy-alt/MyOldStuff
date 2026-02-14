import type { APIRoute } from 'astro';
import { db, Feedback } from 'astro:db';
import { randomUUID } from 'crypto';
import { getSession } from '../../../server/session';

/**
 * GET /api/feedback
 * Retrieves user feedback using Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const feedback = await db.select().from(Feedback).orderBy(Feedback.created_at);

    return new Response(JSON.stringify({ feedback }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Get feedback error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch feedback' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * POST /api/feedback
 * Submits user feedback using Astro DB
 */
export const POST: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    const body = await context.request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Feedback content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(Feedback).values({
      id,
      user_id: session?.user?.id || null,
      content: content.trim(),
      created_at: now
    });

    return new Response(JSON.stringify({ message: 'Feedback submitted successfully' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Post feedback error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
