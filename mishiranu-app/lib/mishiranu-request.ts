/** Shared request helpers for mishiranu API routes. */

export function requireJsonContentType(request: Request): Response | null {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return Response.json(
      {
        error: "unsupported_media_type",
        message: "Content-Type は application/json にしてください。",
      },
      {
        status: 415,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
  return null;
}
