import { NextResponse } from "next/server";
import { parsePipeline } from "@/lib/pipeline";
import {
  getStore,
  hashPassword,
  ID_PATTERN,
  type MasterRecord,
  newId,
  newWriteKey,
  safeEqual,
  type VersionRecord,
  WRITE_KEY_PATTERN,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Largest serialized pipeline we accept (roughly 250 KB). */
const MAX_DATA_BYTES = 250_000;
/** Reject obviously oversized bodies before parsing them. */
const MAX_BODY_BYTES = MAX_DATA_BYTES * 2;

interface SaveBody {
  data?: unknown;
  masterId?: unknown;
  writeKey?: unknown;
  /** Present to change protection: a password to set one, "" to remove it. */
  password?: unknown;
}

/**
 * Save a pipeline. Creates a new live link the first time; later saves with
 * the matching write key update the same live link. Every save also stores an
 * immutable version snapshot.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, masterId, writeKey, password } = body;
  if (typeof data !== "string" || data.length === 0 || data.length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: "Pipeline data missing or too large" }, { status: 400 });
  }
  if (!parsePipeline(data)) {
    return NextResponse.json({ error: "Pipeline data is not valid" }, { status: 400 });
  }
  if (password !== undefined && typeof password !== "string") {
    return NextResponse.json({ error: "Password must be a string" }, { status: 400 });
  }
  if (typeof password === "string" && password.length > 200) {
    return NextResponse.json({ error: "Password is too long" }, { status: 400 });
  }

  const store = getStore();
  const now = new Date().toISOString();

  let master: MasterRecord | null = null;
  const updating = masterId !== undefined && masterId !== null && masterId !== "";
  if (updating) {
    // An update must name a well-formed live link and carry its write key.
    if (typeof masterId !== "string" || !ID_PATTERN.test(masterId)) {
      return NextResponse.json({ error: "Invalid masterId" }, { status: 400 });
    }
    if (typeof writeKey !== "string" || !WRITE_KEY_PATTERN.test(writeKey)) {
      return NextResponse.json({ error: "Write key does not match" }, { status: 403 });
    }
    const existing = await store.getMaster(masterId);
    if (!existing || !safeEqual(existing.writeKey, writeKey)) {
      return NextResponse.json({ error: "Write key does not match" }, { status: 403 });
    }
    master = existing;
  }
  if (!master) {
    master = {
      id: newId(),
      writeKey: newWriteKey(),
      data,
      latestVersionId: "",
      passwordHash: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const version: VersionRecord = { id: newId(), masterId: master.id, data, createdAt: now };
  master.data = data;
  master.latestVersionId = version.id;
  master.updatedAt = now;
  if (typeof password === "string") {
    master.passwordHash = password ? hashPassword(password) : null;
  }

  await store.putVersion(version);
  await store.putMaster(master);

  return NextResponse.json(
    {
      masterId: master.id,
      writeKey: master.writeKey,
      versionId: version.id,
      protected: master.passwordHash !== null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
