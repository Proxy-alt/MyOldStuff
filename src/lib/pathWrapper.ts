import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Read and return a file from a specified base directory path.
 * Prevents directory traversal attacks by rejecting paths with ".." sequences.
 * @param {string} basePath - Base directory path to read files from
 * @param {string | undefined} file - Relative file path (without "../")
 * @param {string} [contentType='application/javascript'] - MIME type for the response
 * @returns {Promise<Response>} Response object with file contents or error message
 * @throws Returns 400 for invalid paths, 404 for missing files
 */
export default async function (basePath: string, file: string | undefined, contentType: string = 'application/javascript'): Promise<Response> {
  // Prevent directory traversal attacks
  if (file?.includes('..')) {
    return new Response('Invalid path', { status: 400 });
  }

  const fullPath: string = join(basePath, `${file}`);
  process.stderr.write(fullPath + '\n');

  try {
    const data: Buffer = await readFile(fullPath);

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType
      }
    });
  } catch {
    process.stderr.write(fullPath + '\n');

    return new Response(`Not found and the full path was ${fullPath}`, { status: 404 });
  }
}
