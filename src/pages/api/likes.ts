import type { APIRoute } from 'astro';
import { count as countFn, db, eq, Likes } from 'astro:db';
import { randomUUID } from 'crypto';
import { getSession } from '../../../server/session';

/**
 * GET /api/likes
 * Retrieves like count for a specific game using Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      return new Response(JSON.stringify({ error: 'gameId parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await db.select({ count: countFn() }).from(Likes).where(eq(Likes.game_id, gameId));

    return new Response(JSON.stringify({ count: result[0]?.count || 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Get likes error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch likes' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * POST /api/likes
 * Adds a like to a game using Astro DB (toggle on/off)
 */
export const POST: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const { gameId } = body;

    if (!gameId || typeof gameId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid gameId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if already liked
    const existing = await db.select().from(Likes).where(eq(Likes.user_id, session.user.id));

    const alreadyLiked = existing.some((like) => like.game_id === gameId);

    if (alreadyLiked) {
      // Remove like (unlike)
      const likeToDelete = existing.find((like) => like.game_id === gameId);
      if (likeToDelete) {
        await db.delete(Likes).where(eq(Likes.id, likeToDelete.id));
      }
      return new Response(JSON.stringify({ message: 'Like removed' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      // Add new like
      const id = randomUUID();
      const now = new Date();

      await db.insert(Likes).values({
        id,
        user_id: session.user.id,
        game_id: gameId,
        created_at: now
      });

      return new Response(JSON.stringify({ message: 'Like added successfully' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Post like error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process like' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
