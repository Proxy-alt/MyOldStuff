import type { APIRoute } from 'astro';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const GET: APIRoute = async ({ params }) => {
  const { file } = params;

  const fullPath = join(scramjetPath, `${file}.js`);

  try {
    const data = await readFile(fullPath);

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript'
      }
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
