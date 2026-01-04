import type { APIRoute } from 'astro';
import pathWrapper from '../../lib/pathWrapper.ts';
import { join } from 'node:path';

const entry = import.meta.resolve("@your-org/package");
const pkgDir = new URL(".", entry).pathname;

const distDir = join(pkgDir, "dist");

export const GET: APIRoute = async ({ params }) => {
  const file = params.file;
  return await pathWrapper(distDir, file, "application/javascript");
};
