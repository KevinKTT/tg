import { readHealth } from "@/lib/health";

export const runtime = "nodejs";

export function GET() {
  try {
    return Response.json(readHealth());
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
