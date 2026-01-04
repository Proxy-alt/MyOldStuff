import type { APIRoute } from 'astro';
import logo from '../lib/logo';

const getRobotsTxt = `\
# Hello from PeteZah Games!
${logo('#')}
# Explainations allowed
ai-access: allowed
ai-derive: allowed
ai-metadata: allowed
# No training/scraping
ai-train: disallowed
ai-store: disallowed
ai-scrape: disallowed
`;

export const GET: APIRoute = ({ site }) => {
  return new Response(getRobotsTxt);
};
