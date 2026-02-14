import { createProxyMiddleware } from 'http-proxy-middleware';

const externalApis = [
  {
    path: '/api/gn-math/covers',
    target: 'https://cdn.jsdelivr.net/gh/gn-math/covers@main',
    pathRewrite: { '^/api/gn-math/covers': '' }
  },
  {
    path: '/api/gn-math/html',
    target: 'https://cdn.jsdelivr.net/gh/gn-math/html@main',
    pathRewrite: { '^/api/gn-math/html': '' }
  }
];
// credits to gn-math & bread for some of the games, https://discord.gg/gn-math and https://gn-math.dev
export default function setupExternalApis(app) {
  externalApis.forEach(api => {
    app.use(
      api.path,
      createProxyMiddleware({
        target: api.target,
        changeOrigin: true,
        pathRewrite: api.pathRewrite
      })
    );
  });
}
