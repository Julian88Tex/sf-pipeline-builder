import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Server-side persistence for shared pipelines and feature requests.
 *
 * The backend is picked from the environment at runtime so the app works on
 * whichever storage integration the Vercel project has attached:
 *
 *   - Upstash / Vercel KV (Redis over REST):  KV_REST_API_URL + KV_REST_API_TOKEN
 *                                              or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   - Vercel Blob (a *private* store):         BLOB_READ_WRITE_TOKEN
 *   - Postgres (Neon, Supabase, ...):          POSTGRES_URL or DATABASE_URL
 *
 * Set STORAGE_BACKEND=redis|blob|postgres|memory to force one. With nothing
 * configured, an in-memory store is used: fine for local development, but
 * data disappears when the process restarts.
 */

export interface MasterRecord {
  id: string;
  /** Secret that lets the creator overwrite the live link. */
  writeKey: string;
  data: string;
  latestVersionId: string;
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRecord {
  id: string;
  masterId: string;
  data: string;
  createdAt: string;
}

export interface FeatureRequest {
  text: string;
  createdAt: string;
}

export type StoreKind = "redis" | "blob" | "postgres" | "memory";

export interface PipelineStore {
  readonly kind: StoreKind;
  getMaster(id: string): Promise<MasterRecord | null>;
  putMaster(record: MasterRecord): Promise<void>;
  getVersion(id: string): Promise<VersionRecord | null>;
  putVersion(record: VersionRecord): Promise<void>;
  listRequests(): Promise<FeatureRequest[]>;
  addRequest(request: FeatureRequest): Promise<void>;
}

export const MAX_REQUESTS_LISTED = 200;
const MAX_REQUESTS_KEPT = 1000;

// ---------------------------------------------------------------------------
// IDs, keys and passwords

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Shape of every id that can appear in a share link or be looked up. */
export const ID_PATTERN = /^[a-z0-9-]{1,64}$/i;
/** Shape of a write key as issued by newWriteKey. */
export const WRITE_KEY_PATTERN = /^[0-9a-f]{48}$/;

/** Short, URL-safe id made only of the characters share links accept. */
export function newId(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

export function newWriteKey(): string {
  return randomBytes(24).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function safeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// Redis over REST (Upstash / Vercel KV)

const KEY_MASTER = (id: string) => `spb:master:${id}`;
const KEY_VERSION = (id: string) => `spb:version:${id}`;
const KEY_REQUESTS = "spb:requests";

class RedisRestStore implements PipelineStore {
  readonly kind = "redis";
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command<T>(args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`Redis error: ${body.error ?? res.status}`);
    return body.result as T;
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.command<string | null>(["GET", key]);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  getMaster(id: string) {
    return this.getJson<MasterRecord>(KEY_MASTER(id));
  }
  async putMaster(record: MasterRecord) {
    await this.command(["SET", KEY_MASTER(record.id), JSON.stringify(record)]);
  }
  getVersion(id: string) {
    return this.getJson<VersionRecord>(KEY_VERSION(id));
  }
  async putVersion(record: VersionRecord) {
    await this.command(["SET", KEY_VERSION(record.id), JSON.stringify(record)]);
  }
  async listRequests() {
    const items = await this.command<string[]>(["LRANGE", KEY_REQUESTS, 0, MAX_REQUESTS_LISTED - 1]);
    const out: FeatureRequest[] = [];
    for (const item of items ?? []) {
      try {
        out.push(JSON.parse(item) as FeatureRequest);
      } catch {}
    }
    return out;
  }
  async addRequest(request: FeatureRequest) {
    await this.command(["LPUSH", KEY_REQUESTS, JSON.stringify(request)]);
    await this.command(["LTRIM", KEY_REQUESTS, 0, MAX_REQUESTS_KEPT - 1]);
  }
}

// ---------------------------------------------------------------------------
// Vercel Blob (private blobs, one JSON document per record)

const BLOB_PREFIX = "sf-pipeline-builder";
const REQUESTS_BLOB = `${BLOB_PREFIX}/requests.json`;

class BlobStore implements PipelineStore {
  readonly kind = "blob";

  private async read<T>(pathname: string): Promise<{ value: T; etag: string } | null> {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    try {
      const value = (await new Response(result.stream).json()) as T;
      return { value, etag: result.blob.etag };
    } catch {
      return null;
    }
  }

  private async write(pathname: string, value: unknown, ifMatch?: string) {
    const { put, BlobError } = await import("@vercel/blob");
    try {
      await put(pathname, JSON.stringify(value), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        ...(ifMatch ? { ifMatch } : {}),
      });
    } catch (error) {
      if (error instanceof BlobError && !/precondition/i.test(error.message)) {
        throw new Error(
          `Vercel Blob write failed (the store must be a private Blob store): ${error.message}`,
        );
      }
      throw error;
    }
  }

  async getMaster(id: string) {
    return (await this.read<MasterRecord>(`${BLOB_PREFIX}/masters/${id}.json`))?.value ?? null;
  }
  putMaster(record: MasterRecord) {
    return this.write(`${BLOB_PREFIX}/masters/${record.id}.json`, record);
  }
  async getVersion(id: string) {
    return (await this.read<VersionRecord>(`${BLOB_PREFIX}/versions/${id}.json`))?.value ?? null;
  }
  putVersion(record: VersionRecord) {
    return this.write(`${BLOB_PREFIX}/versions/${record.id}.json`, record);
  }
  async listRequests() {
    const list = (await this.read<FeatureRequest[]>(REQUESTS_BLOB))?.value;
    return Array.isArray(list) ? list.slice(0, MAX_REQUESTS_LISTED) : [];
  }
  async addRequest(request: FeatureRequest) {
    // Optimistic concurrency: retry when another request changed the list meanwhile.
    const { BlobPreconditionFailedError } = await import("@vercel/blob");
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await this.read<FeatureRequest[]>(REQUESTS_BLOB);
      const list = Array.isArray(current?.value) ? current.value : [];
      try {
        await this.write(REQUESTS_BLOB, [request, ...list].slice(0, MAX_REQUESTS_KEPT), current?.etag);
        return;
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError) || attempt === 3) throw error;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Postgres

class PostgresStore implements PipelineStore {
  readonly kind = "postgres";
  private pool: import("pg").Pool | null = null;
  private ready: Promise<void> | null = null;

  constructor(private readonly connectionString: string) {}

  private async db() {
    if (!this.pool) {
      const { Pool } = await import("pg");
      const local = /localhost|127\.0\.0\.1/.test(this.connectionString);
      const urlSetsSsl = /[?&]sslmode=/.test(this.connectionString);
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 3,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        // Verify certificates unless explicitly opted out; the URL's sslmode wins when present.
        ssl: local || urlSetsSsl ? undefined : { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== "1" },
      });
      // A dropped idle connection surfaces here; without a listener it would crash the process.
      this.pool.on("error", (error) => console.error("[sf-pipeline-builder] postgres pool error", error));
    }
    if (!this.ready) {
      this.ready = this.pool
        .query(
          `create table if not exists pipeline_masters (
             id text primary key,
             write_key text not null,
             data text not null,
             latest_version_id text not null default '',
             password_hash text,
             created_at timestamptz not null,
             updated_at timestamptz not null
           );
           create table if not exists pipeline_versions (
             id text primary key,
             master_id text not null,
             data text not null,
             created_at timestamptz not null
           );
           create table if not exists feature_requests (
             id bigserial primary key,
             text text not null,
             created_at timestamptz not null
           );`,
        )
        .then(() => undefined)
        .catch((error: unknown) => {
          // Let the next request retry instead of caching the failure forever.
          this.ready = null;
          throw error;
        });
    }
    await this.ready;
    return this.pool;
  }

  async getMaster(id: string) {
    const db = await this.db();
    const { rows } = await db.query(
      `select id, write_key, data, latest_version_id, password_hash, created_at, updated_at
         from pipeline_masters where id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      writeKey: row.write_key,
      data: row.data,
      latestVersionId: row.latest_version_id,
      passwordHash: row.password_hash ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    } satisfies MasterRecord;
  }
  async putMaster(record: MasterRecord) {
    const db = await this.db();
    await db.query(
      `insert into pipeline_masters (id, write_key, data, latest_version_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         data = excluded.data,
         latest_version_id = excluded.latest_version_id,
         password_hash = excluded.password_hash,
         updated_at = excluded.updated_at`,
      [
        record.id,
        record.writeKey,
        record.data,
        record.latestVersionId,
        record.passwordHash,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }
  async getVersion(id: string) {
    const db = await this.db();
    const { rows } = await db.query(
      `select id, master_id, data, created_at from pipeline_versions where id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      masterId: row.master_id,
      data: row.data,
      createdAt: new Date(row.created_at).toISOString(),
    } satisfies VersionRecord;
  }
  async putVersion(record: VersionRecord) {
    const db = await this.db();
    await db.query(
      `insert into pipeline_versions (id, master_id, data, created_at) values ($1, $2, $3, $4)
       on conflict (id) do nothing`,
      [record.id, record.masterId, record.data, record.createdAt],
    );
  }
  async listRequests() {
    const db = await this.db();
    const { rows } = await db.query(
      `select text, created_at from feature_requests order by created_at desc, id desc limit $1`,
      [MAX_REQUESTS_LISTED],
    );
    return rows.map((row) => ({ text: row.text, createdAt: new Date(row.created_at).toISOString() }));
  }
  async addRequest(request: FeatureRequest) {
    const db = await this.db();
    await db.query(`insert into feature_requests (text, created_at) values ($1, $2)`, [
      request.text,
      request.createdAt,
    ]);
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback

class MemoryStore implements PipelineStore {
  readonly kind = "memory";
  private masters = new Map<string, MasterRecord>();
  private versions = new Map<string, VersionRecord>();
  private requests: FeatureRequest[] = [];

  async getMaster(id: string) {
    return this.masters.get(id) ?? null;
  }
  async putMaster(record: MasterRecord) {
    this.masters.set(record.id, record);
  }
  async getVersion(id: string) {
    return this.versions.get(id) ?? null;
  }
  async putVersion(record: VersionRecord) {
    this.versions.set(record.id, record);
  }
  async listRequests() {
    return this.requests.slice(0, MAX_REQUESTS_LISTED);
  }
  async addRequest(request: FeatureRequest) {
    this.requests.unshift(request);
    this.requests = this.requests.slice(0, MAX_REQUESTS_KEPT);
  }
}

// ---------------------------------------------------------------------------

function createStore(): PipelineStore {
  const env = process.env;
  const forced = env.STORAGE_BACKEND as StoreKind | undefined;
  const redisUrl = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const postgres = env.POSTGRES_URL || env.DATABASE_URL;

  const wants = (kind: StoreKind) => forced === kind || forced === undefined;
  if (forced && !["redis", "blob", "postgres", "memory"].includes(forced)) {
    console.warn(`[sf-pipeline-builder] Unknown STORAGE_BACKEND "${forced}", auto-detecting instead.`);
  }
  if (wants("redis") && redisUrl && redisToken) return new RedisRestStore(redisUrl, redisToken);
  if (wants("blob") && env.BLOB_READ_WRITE_TOKEN) return new BlobStore();
  if (wants("postgres") && postgres) return new PostgresStore(postgres);
  if (forced && forced !== "memory") {
    console.warn(
      `[sf-pipeline-builder] STORAGE_BACKEND=${forced} but its environment variables are missing.`,
    );
  }
  console.warn(
    "[sf-pipeline-builder] No storage configured (Redis, Blob or Postgres). Saved pipelines will not persist.",
  );
  return new MemoryStore();
}

const globalRef = globalThis as typeof globalThis & { __sfPipelineStore?: PipelineStore };

/** The process-wide store, created on first use. */
export function getStore(): PipelineStore {
  if (!globalRef.__sfPipelineStore) globalRef.__sfPipelineStore = createStore();
  return globalRef.__sfPipelineStore;
}
