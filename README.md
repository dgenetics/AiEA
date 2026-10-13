# AiEA — AI Executive Assistant

A personal (and soon multi-user) operating system for **life, home, and work**.

Capture messy notes. AiEA proposes structure — one-time vs recurring, priorities, deadlines, people follow-ups — **you confirm**. Then it surfaces a Today board, Daily Brief, and in-app pings so you stay ahead.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Prisma 7** + SQLite (local); schema is workspace-scoped for multi-tenant later
- **SpaceXAI / xAI** (`grok-4.5`) for capture + brief (optional; heuristics work without a key)
- **PWA** manifest for installable web app

## Quick start

```bash
# 1. Install deps
npm install

# 2. Env
cp .env.example .env
# Optional: set XAI_API_KEY from https://console.x.ai

# 3. Database
npm run db:migrate
# or: npx prisma migrate dev

# 4. PWA icons (optional)
npm run icons

# 5. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Get started** → create an account.

## Core flows

| Flow | What happens |
|------|----------------|
| **Capture** | Paste brain-dump → AI proposes tasks → you accept |
| **Today** | Priority + due-today + follow-ups |
| **People** | Open loops per person |
| **Recurring** | Templates; occurrences auto-materialize when due |
| **Daily Brief** | Morning-style briefing + coach tips |
| **Pings** | Bell menu for due reminders |

## Product principles

1. **AI proposes; you confirm** — never silent autopilot on your life.
2. **Workspace-scoped data** — ready for small-team workspaces later.
3. **Areas** — Work / Home / Life by default.
4. **Trustworthy board** — complete, snooze, or reschedule; no zombie lists.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply migrations (local SQLite) |
| `npm run db:push:turso` | Apply Prisma migrations to Turso (prod/preview — Vercel build does **not** migrate) |
| `npm run db:studio` | Prisma Studio |
| `npm run icons` | Generate PWA icons |

## Env vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | SQLite path (`file:./dev.db`) |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Production libSQL (AiEA’s **own** Turso DB only — never share with BF Maintenance) |

App startup does not migrate and does not import. Preview and production share one Turso database, so do not boot a preview to apply schema.

Back up first (`turso db shell <db-name> ".dump"` or a Turso branch), then:

```bash
vercel env pull .env.vercel --environment=production --yes
FARM_SCHEMA_PUSH=1 node --env-file=.env.vercel scripts/push-turso-schema.mjs
```

Import an old bf-maintenance database only after that backup, and only into a workspace id you pass:

```bash
FARM_IMPORT_ALLOW_REMOTE=1 FARM_IMPORT_WORKSPACE_ID=<id> \
  BF_SOURCE_DATABASE_URL="libsql://..." \
  npx tsx scripts/import-bf-data.ts
```

| `XAI_API_KEY` | SpaceXAI / xAI key — [console.x.ai](https://console.x.ai/team/default/api-keys) |
| `XAI_MODEL` | Optional model override (default `grok-4.5`) |
| `XAI_BASE_URL` | Optional API base (default `https://api.x.ai/v1`) |
| `AIEA_TIMEZONE` | Optional IANA tz for AI date reasoning (e.g. `America/New_York`) |
| `AUTH_SECRET` | Session hardening (change in prod) |
| `CRON_SECRET` | Auth for `/api/cron/materialize-schedules` (daily 12:00 UTC) |
| `BF_SOURCE_DATABASE_URL` | Old bf-maintenance database for `scripts/import-bf-data.ts` |
| `FARM_IMPORT_WORKSPACE_ID` | Workspace that receives that import |
| `FARM_SCHEMA_PUSH` | Set to `1` to allow `scripts/push-turso-schema.mjs` on a remote database |
| `FARM_IMPORT_ALLOW_REMOTE` | Set to `1` to allow the import script to write to Turso |

### Wire SpaceXAI

1. Create an API key at [console.x.ai](https://console.x.ai/team/default/api-keys) (load credits on the account first).
2. Put it in `.env` (never commit this file):

```bash
XAI_API_KEY="xai-..."
```

3. Restart the dev server (`npm run dev`) so Next.js reloads env.
4. Optional live check (while logged in): `GET /api/ai/status?ping=1`

Without a key, Capture still works via local heuristics.

### AI behavior

- **Capture** uses structured JSON outputs + Zod validation (strict schema) and creates tasks immediately.
- Prompts include clock context (timezone, today, EOM) so deadlines stay grounded.
- On any AI failure, the app falls back to heuristics. The field also offers Retry and Save as one task.

## Roadmap (post-MVP)

- Web Push + email/SMS channels  
- Calendar sync (Google / Apple)  
- Multi-user workspace invites & shared Home lists  
- Email/Slack ingest  
- Native mobile shells  

## License

Private — all rights reserved unless you choose otherwise.


## Agent verification (pstack / poteto)

Hong / agents: use **poteto-mode** with the project skill `.cursor/skills/verify-aiea/` (launch → doctor → Playwright drive → evidence). Confirm `~/.cursor/rules/pstack-models.mdc` on the box. One-shot:

```bash
./.cursor/skills/verify-aiea/scripts/gate.sh --local --feature capture-accept
```

Live/post-auth needs **`AIEA_SMOKE_EMAIL` + `AIEA_SMOKE_PASSWORD`** (both; smoke user only — never personal / 1Password). When unset, `gate.sh --live-smoke` **clean-skips** (CI stays green). Hong creates the smoke User row; verify does not. Set CI secrets with `gh secret set` (see `.cursor/skills/verify-aiea/SKILL.md`). Legacy `AIEA_EMAIL`/`AIEA_PASSWORD` are demoted — migrate to SMOKE names. No separate `BF_*` pair for smoke login. Parallel to bf-maintenance verify — do not conflate with BF PIN / #20 login threads.
