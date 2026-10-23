export function GET() {
  const requestId = crypto.randomUUID();
  console.info(JSON.stringify({ event: "health", requestId, status: "ok" }));
  return Response.json(
    { status: "ok", app: "picwiz", version: 2, storage: "browser-local", requestId },
    { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
  );
}
