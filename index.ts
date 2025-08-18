// index.ts
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        return new Response("Hi no Hono now", {
            headers: {"content-type": "text/plain"},
        });
    },
};