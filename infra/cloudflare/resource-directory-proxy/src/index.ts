// Resource-directory edge proxy.
// Rewrites Host header so Cloud Run recognizes the request.

interface Env {
  UPSTREAM_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const inboundUrl = new URL(request.url);
    const upstreamUrl = new URL(env.UPSTREAM_ORIGIN);

    // Build target URL: keep path + query, swap hostname to Cloud Run.
    const targetUrl = new URL(inboundUrl.pathname + inboundUrl.search, upstreamUrl);

    // Clone headers, set Host to Cloud Run hostname so SNI + Host check pass.
    const headers = new Headers(request.headers);
    headers.set('host', upstreamUrl.host);

    // Forwarding metadata so origin logs can distinguish edge-proxied
    // requests from direct-to-Cloud-Run.
    headers.set('x-forwarded-host', inboundUrl.host);
    const cfClientIp = request.headers.get('cf-connecting-ip');
    if (cfClientIp) {
      headers.set('x-forwarded-for', cfClientIp);
    }
    headers.set('x-forwarded-proto', 'https');

    const upstreamRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    });

    const upstreamResponse = await fetch(upstreamRequest);

    // Return the response as-is. Streaming-friendly for large payloads.
    return upstreamResponse;
  },
};
