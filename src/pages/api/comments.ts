import type { APIRoute } from 'astro';
import { randomUUID } from 'crypto';
import db from '../../lib/db.ts';
import { requireAuth } from '../../lib/auth.ts';

// Server will perform minimal validation only. Full HTML sanitization
// should be handled client-side (e.g., DOMPurify) before sending comments.
function validateContent(content: unknown) {
  if (!content || typeof content !== 'string') return false;
  if (content.length < 1 || content.length > 10000) return false;
  const banned = [/\bnigg\w*\b/i, /\bcunt\b/i, /\bchink\b/i, /\bfag\w*\b/i, /\btrann\w*\b/i, /\bspic\b/i, /\bslut\b/i, /\bwhore\b/i, /\bretard\b/i];
  if (banned.some((r) => r.test(content))) return false;
  return true;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const targetId = url.searchParams.get('targetId');
    if (!['changelog', 'feedback'].includes(type || '')) return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
    if (!targetId) return new Response(JSON.stringify({ error: 'Invalid targetId' }), { status: 400 });
    const comments = db.prepare('SELECT c.*, u.username, u.avatar_url FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.type = ? AND c.target_id = ? ORDER BY c.created_at ASC').all(type, targetId);
    return new Response(JSON.stringify({ comments }), { status: 200 });
  } catch (err) {
    console.error('Get comments error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireAuth(context as any);
    const { type, targetId, content } = await context.request.json();
    if (!['changelog', 'feedback'].includes(type || '')) return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
    if (!targetId || typeof targetId !== 'string') return new Response(JSON.stringify({ error: 'Invalid targetId' }), { status: 400 });
    if (!validateContent(content)) return new Response(JSON.stringify({ error: 'Invalid or inappropriate content' }), { status: 400 });
    // Assume client sanitized HTML; store as-is
    const sanitizedContent = typeof content === 'string' ? content : String(content);
    const id = randomUUID();
    const now = Date.now();
    db.prepare('INSERT INTO comments (id, type, target_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, type, targetId, (user as any).id, sanitizedContent, now);
    return new Response(JSON.stringify({ message: 'Comment posted.' }), { status: 200 });
  } catch (err) {
    if (err instanceof Response) return err; // requireAuth may throw
    console.error('Add comment error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireAuth(context as any);
    const body = await context.request.json();
    const commentId = body.commentId;
    if (!commentId || typeof commentId !== 'string') return new Response(JSON.stringify({ error: 'Invalid commentId' }), { status: 400 });
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) return new Response(JSON.stringify({ error: 'Comment not found' }), { status: 404 });
    if (comment.user_id !== (user as any).id && !(user as any).is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    return new Response(JSON.stringify({ message: 'Comment deleted.' }), { status: 200 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Delete comment error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  // Admin cleanup endpoint: expects admin session
  try {
    const user = requireAuth(context as any);
    if (!(user as any).is_admin) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    // perform cleanup similar to server version
    const allComments = db.prepare('SELECT id, content FROM comments').all();
    let deletedCount = 0;
    for (const comment of allComments) {
      if (!validateContent(comment.content)) {
        db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
        deletedCount++;
      }
    }
    return new Response(JSON.stringify({ message: `Cleaned up ${deletedCount} malicious comment(s).`, deletedCount }), { status: 200 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Cleanup comments error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
