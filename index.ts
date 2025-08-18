// index.ts
export default {
    async fetch(request: Request, env: Env) {
        const url = new URL (request.url);
        return env.ASSETS.fetch(request);
    }
}