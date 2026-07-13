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
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Prisma Studio |
| `npm run icons` | Generate PWA icons |

## Env vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | SQLite path (`file:./dev.db`) |
| `XAI_API_KEY` | SpaceXAI / xAI key — [console.x.ai](https://console.x.ai/team/default/api-keys) |
| `XAI_MODEL` | Optional model override (default `grok-4.5`) |
| `XAI_BASE_URL` | Optional API base (default `https://api.x.ai/v1`) |
| `AIEA_TIMEZONE` | Optional IANA tz for AI date reasoning (e.g. `America/New_York`) |
| `AUTH_SECRET` | Session hardening (change in prod) |
| `CRON_SECRET` | Future scheduled jobs |

### Wire SpaceXAI

1. Create an API key at [console.x.ai](https://console.x.ai/team/default/api-keys) (load credits on the account first).
2. Put it in `.env` (never commit this file):

```bash
XAI_API_KEY="xai-..."
```

3. Restart the dev server (`npm run dev`) so Next.js reloads env.
4. In the app header, the badge should show **SpaceXAI · grok-4.5**.
5. Optional live check (while logged in): `GET /api/ai/status?ping=1`

Without a key, Capture still works via local heuristics (amber badge / “Local heuristics” label).

### AI behavior

- **Capture** uses structured JSON outputs + Zod validation (strict schema).
- **Daily Brief** polishes summary/tips with the same pipeline.
- Prompts include clock context (timezone, today, EOM) so deadlines stay grounded.
- On any AI failure, the app falls back to heuristics and surfaces the reason.

## Roadmap (post-MVP)

- Web Push + email/SMS channels  
- Calendar sync (Google / Apple)  
- Multi-user workspace invites & shared Home lists  
- Email/Slack ingest  
- Native mobile shells  

## License

Private — all rights reserved unless you choose otherwise.
