import { NextResponse } from "next/server";
import { type FeatureRequest, getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 500;
/** Reject obviously oversized bodies before parsing them. */
const MAX_BODY_BYTES = 8_192;

/** Newest feature requests first. */
export async function GET() {
  const requests = await getStore().listRequests();
  return NextResponse.json(requests, { headers: { "cache-control": "no-store" } });
}

/** Add a feature request. Body: { text }. Responds with the stored request. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  const created: FeatureRequest = { text, createdAt: new Date().toISOString() };
  await getStore().addRequest(created);
  return NextResponse.json(created, { status: 201, headers: { "cache-control": "no-store" } });
}
