import type { APIRoute } from 'astro';
import { db, eq, UserSettings } from 'astro:db';
import { randomUUID } from 'crypto';
import { getSession } from '../../../server/session';

/**
 * GET /api/load-localstorage
 * Loads user's localstorage data using Astro DB
 */
export const GET: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const settings = await db.select().from(UserSettings).where(eq(UserSettings.user_id, session.user.id)).first();

    if (!settings || !settings.localstorage_data) {
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      const data = JSON.parse(settings.localstorage_data);
      return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (parseError) {
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Load localstorage error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load localstorage' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/**
 * POST /api/save-localstorage
 * Saves user's localstorage data using Astro DB
 */
export const POST: APIRoute = async (context) => {
  try {
    const session = await getSession(context);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await context.request.json();
    const { data } = body;

    if (!data || typeof data !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid data format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    const dataString = JSON.stringify(data);

    // Try to update existing settings
    const existing = await db.select().from(UserSettings).where(eq(UserSettings.user_id, session.user.id)).first();

    if (existing) {
      await db
        .update(UserSettings)
        .set({
          localstorage_data: dataString,
          updated_at: now
        })
        .where(eq(UserSettings.id, existing.id));
    } else {
      // Create new settings record
      const id = randomUUID();
      await db.insert(UserSettings).values({
        id,
        user_id: session.user.id,
        localstorage_data: dataString,
        theme: 'dark',
        notifications_enabled: 1,
        created_at: now,
        updated_at: now
      });
    }

    return new Response(JSON.stringify({ message: 'Localstorage saved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Save localstorage error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save localstorage' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
