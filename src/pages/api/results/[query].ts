import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  try {
    const query = params.query?.toLowerCase();
    if (!query) return new Response(JSON.stringify([]), { status: 400 });

    const response = await fetch(`http://api.duckduckgo.com/ac?q=${encodeURIComponent(query)}&format=json`);

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    const suggestions = data.map((item: any) => ({ phrase: item.phrase })).slice(0, 8);

    return new Response(JSON.stringify(suggestions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error generating suggestions:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch suggestions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
