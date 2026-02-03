import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { handler as astroHandler } from './dist/server/entry.mjs'; // Astro Build Output
import startFastifyServer from './dist/server/server.js'; // Your Compiled Backend

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Start the Backend (Fastify)
console.log('🚀 Starting Fastify Backend on :3001');
startFastifyServer().catch((err) => console.error('Backend failed:', err));

// 2. Configure Proxy (Replaces Vite Proxy for Prod)
const proxyOptions = {
  target: 'http://localhost:3001',
  changeOrigin: true,
  ws: true, // <--- CRITICAL: Enables WebSocket Proxying
  logLevel: 'silent'
};

// Apply Proxy to Backend Routes
app.use('/bare', createProxyMiddleware(proxyOptions));
app.use('/wisp', createProxyMiddleware(proxyOptions));
app.use('/scram', createProxyMiddleware(proxyOptions));
app.use('/api/wisp-premium', createProxyMiddleware(proxyOptions));

// 3. Serve Astro
app.use(express.static('dist/client')); // Static assets (JS/CSS)
app.use((req, res, next) => {
  // Pass non-proxy requests to Astro
  astroHandler(req, res, next);
});

// 4. Start Frontend Server
const server = app.listen(PORT, () => {
  console.log(`✅ Production Frontend running on http://localhost:${PORT}`);
});

// Explicitly Upgrade WebSockets for the Proxy
server.on('upgrade', (req, socket, head) => {
  // If the request is for wisp/bare, let the proxy handle the upgrade
  if (req.url.startsWith('/wisp') || req.url.startsWith('/bare')) {
    // The middleware above handles the routing, but we need to ensure the upgrade happens
    // http-proxy-middleware usually handles this automatically if mounted correctly,
    // but sometimes explicit handling on the 'upgrade' event is safer for bare-metal Node.
  }
});
