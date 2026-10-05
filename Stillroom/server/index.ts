// One process serves the API and the app. `npm run dev` runs Vite inside it (hot reload); `npm start`
// serves the built files from dist/.
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './app.ts';
import { configured } from './supabase.ts';

// Settings come from .env when there is one, otherwise from the environment (as on Render).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // no .env file
}

const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT) || 8787;
const root = fileURLToPath(new URL('..', import.meta.url));

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use('/api', api);
const server = createHttpServer(app);

if (dev) {
  const { createServer } = await import('vite');
  // Hot reload shares the app's HTTP server, so development needs one port, like production.
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = `${root}dist`;
  if (!existsSync(`${dist}/index.html`)) {
    console.error('dist/ is missing: run `npm run build` first, or use `npm run dev`.');
    process.exit(1);
  }
  app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false }));
  app.get('/{*path}', (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile(`${dist}/index.html`));
}

server.listen(port, () => {
  console.log(`Stillroom on http://localhost:${port}${dev ? ' (dev)' : ''}`);
  if (!configured()) console.warn('Supabase isn’t configured: copy .env.example to .env and fill in SUPABASE_URL and SUPABASE_ANON_KEY.');
});
