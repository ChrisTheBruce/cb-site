// index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env?.ASSETS?.fetch) {
      return new Response("ASSETS binding missing", { status: 500 });
    }

    const url = new URL(request.url);
    let res = await env.ASSETS.fetch(request);

    // If root or any HTML route 404s, serve /index.html (fixes “can’t be found” at /)
    const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");
    if ((url.pathname === "/" || wantsHtml) && res.status === 404) {
      const indexReq = new Request(new URL("/index.html", url), request);
      res = await env.ASSETS.fetch(indexReq);
    }
    return res;
  }
}