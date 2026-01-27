import type { APIRoute } from 'astro';
import logo from '../lib/logo.ts';

const getRobotsTxt = `\
# Hello from PeteZah Games!
${logo('#')}
# We like it when people and bots visit our site.
# Check out our Discord server at https://discord.gg/petezah-games-1337108365591187640
User-agent: *
Allow: /
Disallow: /api/
`;

export const GET: APIRoute = () => {
  return new Response(getRobotsTxt);
};
