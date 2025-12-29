import type { APIRoute } from 'astro';
import { Buffer } from 'node:buffer';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

// Cache for the master lossless AVIF
let masterCache: { buffer: Buffer; timestamp: number } | null = null;

export const GET: APIRoute = async ({ params }) => {
  const format = params.format; // "png" or "avif"
  const now = Date.now();

  // Cache duration (1 hour)
  const CACHE_DURATION = 3600_000;

  // If cached master exists and is fresh → use it
  if (masterCache && now - masterCache.timestamp < CACHE_DURATION) {
    return serveFromMaster(masterCache.buffer, format);
  }

  // Otherwise regenerate the master lossless AVIF
  const masterAvif = await generateMasterLosslessAvif();

  // Cache it
  masterCache = {
    buffer: masterAvif,
    timestamp: now
  };

  return serveFromMaster(masterAvif, format);
};

/* ---------------------------------------------
   Generate the master LOSSLESS AVIF screenshot
---------------------------------------------- */
async function generateMasterLosslessAvif(): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // 16:9 at 960 × 540
  await page.setViewport({
    width: 960,
    height: 540,
    deviceScaleFactor: 1
  });

  await page.goto('https://petezahgames.com', {
    waitUntil: 'networkidle2'
  });

  // Screenshot directly as LOSSLESS AVIF
  const rawData = await page.screenshot({
    // Cast 'avif' as any because Puppeteer types only officially support png/jpeg/webp
    type: 'avif' as any,
    fullPage: false
  });

  await browser.close();

  // Ensure strict Buffer type
  return Buffer.from(rawData);
}

/* ---------------------------------------------
   Serve AVIF (lossy) or PNG (fallback)
   using the master lossless AVIF
---------------------------------------------- */
async function serveFromMaster(masterAvif: Buffer, format: string | undefined): Promise<Response> {
  let output: Buffer;

  if (format === 'avif') {
    // Lossy AVIF for OG (tiny + high quality)
    output = await sharp(masterAvif)
      .avif({
        quality: 50,
        effort: 6, // 'speed' does not exist in Sharp options; 'effort' ranges 0 (fastest) to 9 (slowest)
        chromaSubsampling: '4:2:0'
      })
      .toBuffer();

    // Cast output to BodyInit to satisfy strict TypeScript 'Response' definition
    return new Response(output as BodyInit, {
      headers: {
        'Content-Type': 'image/avif',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // PNG fallback (for Facebook, older crawlers)
  output = await sharp(masterAvif).png({ compressionLevel: 9 }).toBuffer();

  return new Response(output as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
