import type { APIRoute } from 'astro';
import { Comments, db, eq, Users } from 'astro:db';
import { randomUUID } from 'crypto';
import { getCurrentUser, getSession } from '../../../server/session';

/**
 * Content validation function
 */
function validateContent(content: unknown) {
  if (!content || typeof content !== 'string') return false;
  if (content.length < 1 || content.length > 10000) return false;
  const banned = [/\bnigg\w*\b/i, /\bcunt\b/i, /\bchink\b/i, /\bfag\w*\b/i, /\btrann\w*\b/i, /\bspic\b/i, /\bslut\b/i, /\bwhore\b/i, /\bretard\b/i];
  if (banned.some((r) => r.test(content))) return false;
  return true;
}

/**
 * GET /api/comments
 * Retrieves comments for a specific game using Astro DB
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

    // Select comments with user details
    const comments = await db.select().from(Comments).where(eq(Comments.game_id, gameId));

    // Enrich with user data
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const users = await db.select().from(Users).where(eq(Users.id, comment.user_id));
        const user = users[0];

        return {
          ...comment,
          username: user?.username,
          avatar_url: user?.avatar_url
        };
      })
    );

    return new Response(JSON.stringify({ comments: enrichedComments }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Get comments error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * POST /api/comments
 * Creates a new comment for a game using Astro DB
 */
export const POST: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const { gameId, content } = body;

    if (!gameId || typeof gameId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid gameId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!validateContent(content)) {
      return new Response(JSON.stringify({ error: 'Invalid or inappropriate content' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(Comments).values({
      id,
      user_id: session.user.id,
      game_id: gameId,
      content,
      created_at: now,
      updated_at: now
    });

    return new Response(JSON.stringify({ message: 'Comment created successfully', id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Post comment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create comment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * DELETE /api/comments
 * Deletes a comment using Astro DB
 */
export const DELETE: APIRoute = async (context) => {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const commentId = body.commentId;

    if (!commentId || typeof commentId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid commentId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const comments = await db.select().from(Comments).where(eq(Comments.id, commentId));
    const comment = comments[0];

    if (!comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (comment.user_id !== user.id && !user.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await db.delete(Comments).where(eq(Comments.id, commentId));

    return new Response(JSON.stringify({ message: 'Comment deleted' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete comment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete comment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * PUT /api/comments
 * Admin cleanup endpoint for malicious comments using Astro DB
 */
export const PUT: APIRoute = async (context) => {
  try {
    const user = await getCurrentUser(context);

    if (!user || !user.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const allComments = await db.select().from(Comments);
    let deletedCount = 0;

    for (const comment of allComments) {
      if (!validateContent(comment.content)) {
        await db.delete(Comments).where(eq(Comments.id, comment.id));
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cleaned up ${deletedCount} malicious comment(s).`,
        deletedCount
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup comments error:', error);
    return new Response(JSON.stringify({ error: 'Failed to cleanup comments' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
