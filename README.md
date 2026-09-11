# Salesforce Pipeline Builder

Visually design Salesforce DevOps pipelines and share them as a link.
Live at [sf-pipeline-builder.vercel.app](https://sf-pipeline-builder.vercel.app/).

## What it does

- Lay out environments (scratch orgs, sandboxes, production) across Development, Testing and Production lanes.
- Name each environment and its git branch, pick its org type, add environments before, after or next to any card.
- **Who can deploy**: list the people, roles or teams allowed to deploy into each environment. Shown on the card, editable per card or for a multi-selection.
- **Quality gates** on every promotion arrow: built-in gates (Apex Tests, PMD, PR Review) plus write-in **PR**, **Flow** and **Custom** gates.
- Undo/redo, dark mode, mobile layout.
- **Save & Share**: a live link that always shows the latest save, version links that snapshot a moment in time, optional password protection, and a list of recent pipelines saved from this browser.
- A feature-request box so people can tell you what to build next.

## Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Storage

Shared pipelines and feature requests are stored server-side. The backend is
chosen from the environment at runtime (see `lib/store.ts`):

| Backend | Environment variables |
| --- | --- |
| Upstash Redis / Vercel KV | `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| Vercel Blob (must be a **private** Blob store) | `BLOB_READ_WRITE_TOKEN` |
| Postgres (Neon, Supabase, ...) | `POSTGRES_URL` or `DATABASE_URL` |

Backends are tried in that order. Set `STORAGE_BACKEND=redis`, `blob`,
`postgres` or `memory` to force one. Postgres connections verify TLS
certificates unless the URL sets `sslmode`; set `PGSSL_NO_VERIFY=1` for a
self-signed server.

With none of these set, an in-memory store is used: fine for local
development, but saved links do not survive a restart.

## Share link format

Links use a hash fragment so the page itself stays static:

- `#s=<id>` loads a live link or version link from `/api/pipelines/<id>`.
- `#p=<base64url>` is an older self-contained link that carries the whole pipeline.

Serialized pipelines are versioned (`v: 3` today). Older `v: 1` and `v: 2` saves still load.

## Project layout

```
app/                Next.js app router: page, layout, API routes, icon
components/         PipelineBuilder and its cards, edges, menus and editors
lib/pipeline.ts     Pipeline model, layout helpers, (de)serialization
lib/gates.ts        Quality gate kinds and helpers
lib/store.ts        Storage adapters (Redis, Blob, Postgres, memory)
```
