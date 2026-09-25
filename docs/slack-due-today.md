# Slack due-today bot (spike)

Optional channel for AiEA. **PWA board remains source of truth.**

## Behaviour
- Cron `GET/POST /api/cron/slack-due-today` (Bearer `CRON_SECRET`) posts **one Slack message per mapped user** listing that user’s tasks due today.
- Preferred target: `SLACK_AIEA_CHANNEL` (e.g. `#aiea`). Each message is `<@U…>`-tagged so a shared farm channel stays private per person.
- Fallback: if channel unset, DM each mapped Slack user.
- Thread replies: `done <id>` · `snooze <id>` · `snooze <id> 3d` — only mutate **that Slack user’s** AiEA workspace (`SLACK_USER_MAP`).
- Without `SLACK_BOT_TOKEN`, cron and events are no-ops (safe in prod).

## Multi-user map
```json
SLACK_USER_MAP={"U0WILL":"will@farm.example","U0OTHER":"other@farm.example"}
```
Single-user back-compat: `SLACK_AIEA_USER_EMAIL` + `SLACK_NOTIFY_USER_ID` folds into a one-entry map.

## Slack app (Will)
1. https://api.slack.com/apps → Create New App → From scratch → workspace **beausoleilfarm**
2. Name suggestion: **AiEA Due Today**
3. **Socket Mode** → Enable → create App-Level Token (`connections:write`) → `SLACK_APP_TOKEN`
4. OAuth scopes (Bot): `chat:write`, `channels:history`, `groups:history`, `im:history`, `im:read`, `im:write`, `users:read`
5. Install to workspace; invite bot to `#aiea`
6. Event Subscriptions (hosted) **or** Socket Mode worker locally:
   - Events: `message.channels`, `message.groups`, `message.im`
   - Request URL: `https://<host>/api/slack/events` (needs `SLACK_SIGNING_SECRET`)
7. Put secrets in Vercel env / `.env.local` (gitignored) — **do not paste tokens in Slack/chat**

## Local prove (no live Slack)
```bash
npm run test:slack
node scripts/prove-slack.mjs
```

## Manual smoke (after install)
1. Set env vars; ensure AiEA users exist for mapped emails
2. `curl -H "Authorization: Bearer $CRON_SECRET" https://aiea-cyan.vercel.app/api/cron/slack-due-today`
3. In `#aiea`, find your tagged message; thread `done <id>` / `snooze <id>`
4. Confirm board/PWA shows the change
