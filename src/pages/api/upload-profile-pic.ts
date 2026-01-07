import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { getSession } from '../../lib/auth.ts';
import db from '../../lib/db.ts';

export const POST: APIRoute = async (context) => {
  const user = getSession(context);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File;

    if (!file) return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profile-pics', user.id.toString());

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/uploads/profile-pics/${user.id}/${fileName}`;
    const now = Date.now();

    db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(avatarUrl, now, user.id);

    return new Response(JSON.stringify({ url: avatarUrl }), { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
