// functions/[[path]].ts
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
const app = new Hono().basePath('/api');

// This is an example API endpoint at /api/hello
app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from your Hono backend!',
  });
});

// You can add more routes here for your consulting services, contact form, etc.

export const onRequest = handle(app);