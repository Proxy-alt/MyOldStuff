import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request }) => {
  const target = 'https://cdn.jsdelivr.net/gh/gn-math/covers@main';
  const path = params.path || '';

  try {
    const response = await fetch(`${target}/${path}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    return new Response('Proxy Error', { status: 502 });
  }
};
