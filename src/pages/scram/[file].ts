import type { APIRoute } from 'astro';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import pathWrapper from '../../lib/pathWrapper.ts';

export const GET: APIRoute = async ({ params }) => {
  const file = params.file;
  return await pathWrapper(scramjetPath, file, "application/javascript");
};
