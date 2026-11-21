# Deployment Guide — Vercel

This guide covers deploying FileShare (including the AI assistant) to Vercel. The existing site is already live at https://file-share.in. These are the steps to deploy the AI assistant update.

**Do not modify the live production environment without reviewing every step first.**

---

## Pre-deployment checklist

Before pushing to production, verify locally:

```bash
npm run lint       # 0 errors
npx tsc --noEmit   # 0 errors
npm test           # all tests pass
npm run build      # build completes without errors
```

Also confirm:
- [ ] Migration 009 has been applied to the production Supabase database
- [ ] All new environment variables are set in Vercel
- [ ] `NEXT_PUBLIC_APP_URL` is set to `https://file-share.in` (not localhost)
- [ ] `GROQ_API_KEY` is set and valid
- [ ] `ADMIN_EMAILS` contains your production login email

---

## Step 1 — Apply the database migration

**Run migration 009 in Supabase before deploying the code.**

The new API routes (`/api/assistant/*`) will fail with database errors if the tables do not exist.

See [supabase-migration.md](supabase-migration.md) for instructions.

---

## Step 2 — Set environment variables in Vercel

Go to **Vercel → your project → Settings → Environment Variables**.

Add these new variables (in addition to the existing ones which are already set):

| Variable | Value | Environments |
|---|---|---|
| `GROQ_API_KEY` | Your Groq API key | Production, Preview, Development |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Production, Preview, Development |
| `ADMIN_EMAILS` | Your production login email | Production only |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Production, Preview |
| `TELEGRAM_WEBHOOK_SECRET` | Your webhook secret | Production, Preview |

**Important:** `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` must be set as **Encrypted** (Vercel calls these "Sensitive" variables). They must never appear in build logs.

Existing variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_*`, `UPSTASH_*`, `RESEND_API_KEY`, `CRON_SECRET`) are already configured from the initial deployment.

---

## Step 3 — Deploy

### Option A — Git push (automatic)

```bash
git add .
git commit -m "feat: add AI assistant support platform"
git push origin main
```

Vercel detects the push and deploys automatically. The CI pipeline runs lint → tsc → test → build before deployment.

### Option B — Vercel CLI

```bash
npx vercel --prod
```

---

## Step 4 — Verify the deployment

After deployment completes, test these URLs on the live site:

```
https://file-share.in                        → homepage loads, chatbot button visible
https://file-share.in/admin/assistant        → redirects to / if not logged in
```

Log in with your admin email, then:

```
https://file-share.in/admin/assistant        → overview dashboard loads with real data
https://file-share.in/admin/assistant/settings → AI provider shows as configured
```

Send a test chat message via the floating widget. Confirm you get an AI reply.

---

## Step 5 — Register the Telegram webhook (production)

After deployment:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://file-share.in/api/assistant/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

See [telegram-setup.md](telegram-setup.md) for full details.

---

## Step 6 — Update GitHub Actions secrets

Add the following secrets to **GitHub → Settings → Secrets and variables → Actions → Repository secrets** so the CI pipeline can build and test the new code:

```
GROQ_API_KEY
ADMIN_EMAILS
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

Then update `.github/workflows/ci.yml` to pass them:

```yaml
env:
  # ... existing variables ...
  GROQ_API_KEY:              ${{ secrets.GROQ_API_KEY }}
  ADMIN_EMAILS:              ${{ secrets.ADMIN_EMAILS }}
  TELEGRAM_BOT_TOKEN:        ${{ secrets.TELEGRAM_BOT_TOKEN }}
  TELEGRAM_WEBHOOK_SECRET:   ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}
```

---

## Rollback procedure

If a deployment causes issues, roll back immediately in Vercel:

1. Vercel → Deployments → find the last known-good deployment.
2. Click the three-dot menu → **Promote to Production**.

This takes under 30 seconds. No database changes are required — migration 009 is additive and does not affect existing FileShare tables.

---

## Vercel cron jobs

The existing cron jobs in `vercel.json` are unchanged:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup",   "schedule": "0 2 * * *"   },
    { "path": "/api/cron/keepalive", "schedule": "0 3 */3 * *" }
  ]
}
```

No new cron jobs were added for the AI assistant.

---

## Build output summary

The build produces a standard Next.js output with:
- Server Components for all admin pages and share pages
- Client Components only where interactivity is required (chatbot, admin data tables)
- API routes for all backend logic
- No standalone server — standard Vercel serverless deployment
