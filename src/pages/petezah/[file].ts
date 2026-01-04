import pathWrapper from '../../lib/pathWrapper';
import { uvPath } from '@petezah-games/ultraviolet';
import type { APIRoute } from 'astro';
export const GET: APIRoute = async ({ params }) => {
    const file = params.file;
    return await pathWrapper(uvPath, file, "application/javascript");
};
