import { timingSafeEqual } from 'node:crypto';

import Fastify from 'fastify';

import { pool } from './db.js';
import { syncRoutes } from './sync.js';

const apiToken = process.env.API_TOKEN;
if (!apiToken || apiToken === 'change-me') throw new Error('Set API_TOKEN to a random secret (openssl rand -hex 32)');
const expected = Buffer.from(`Bearer ${apiToken}`);

const app = Fastify({ logger: true });

app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { ok: true };
});

// Single-user API: one shared bearer token guards everything except /health.
app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  const given = Buffer.from(request.headers.authorization ?? '');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

await app.register(syncRoutes);

const close = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });
