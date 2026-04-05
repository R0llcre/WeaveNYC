export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    },
    ...init
  });
}
