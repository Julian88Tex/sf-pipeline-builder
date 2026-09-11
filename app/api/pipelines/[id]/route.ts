import { NextResponse } from "next/server";
import { getStore, ID_PATTERN, verifyPassword } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Load a shared pipeline by live-link id or version id. Returns the raw
 * serialized pipeline; 401 when a password is required and missing or wrong.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const password = new URL(request.url).searchParams.get("pw") ?? "";
  const store = getStore();

  let data: string | null = null;
  let master = await store.getMaster(id);
  if (master) {
    data = master.data;
  } else {
    const version = await store.getVersion(id);
    if (version) {
      data = version.data;
      master = await store.getMaster(version.masterId);
    }
  }
  if (data === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Skip the (deliberately slow) hash check when no password was sent at all.
  if (master?.passwordHash && (!password || !verifyPassword(password, master.passwordHash))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }
  return new Response(data, {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
