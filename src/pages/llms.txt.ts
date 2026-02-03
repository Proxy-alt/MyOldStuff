import type { APIRoute } from 'astro';
import explanation from '../assets/md/llms.md?raw';
import logo from '../lib/logo.ts';

const getRobotsTxt = `\
# Hello from PeteZah Games!
${logo('#')}

# Explanations allowed
ai-access: allowed
ai-derive: allowed
ai-metadata: allowed
# No training/scraping
ai-train: disallowed
ai-store: disallowed
ai-scrape: disallowed
${explanation}
`;

export const GET: APIRoute = () => {
  return new Response(getRobotsTxt);
};
