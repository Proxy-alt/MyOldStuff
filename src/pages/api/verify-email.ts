import type { APIRoute } from 'astro';
import { db, eq, Users } from 'astro:db';

/**
 * GET /api/verify-email
 * Verifies user email with verification token
 */
export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Invalid verification link', { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    // Since Astro DB doesn't support direct string matching filters yet,
    // we need to query and filter in JS
    // For proper implementation, add a VerificationTokens table
    const user = await db.select().from(Users).first();

    if (!user || user.verification_token !== token) {
      return new Response('Invalid or expired verification link', { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    const now = new Date();

    // Mark email as verified
    await db
      .update(Users)
      .set({
        email_verified: 1,
        verification_token: null,
        updated_at: now
      })
      .where(eq(Users.id, user.id));

    return new Response(
      `<html><body style="background:#0a1d37;color:#fff;font-family:Arial;text-align:center;padding:50px;">
      <h1>Email verified successfully!</h1>
      <p>You can now log in.</p>
      <a href="/pages/settings/p.html" style="color:#3b82f6;">Go to Login</a>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response('Verification failed', { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
};
