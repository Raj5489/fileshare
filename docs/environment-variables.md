# Environment Variables

All secrets are stored in environment variables. Never commit real values to source control.

For local development copy `.env.example` to `.env.local` and fill in your values.  
For production set these in **Vercel → Project → Settings → Environment Variables**.

---

## Supabase

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL. Found in Supabase → Settings → API → Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key. Safe to expose to the browser. Found in Settings → API → Project API Keys. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key. **Never expose this to the browser.** Used server-side only to bypass RLS. |

---

## Cloudflare R2

| Variable | Required | Description |
|---|---|---|
| `R2_ACCOUNT_ID` | ✅ | Your Cloudflare account ID. Found in Cloudflare dashboard → right sidebar. |
| `R2_ACCESS_KEY_ID` | ✅ | R2 API token access key ID. Create in R2 → Manage R2 API Tokens. |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 API token secret. Only shown once at creation time. |
| `R2_BUCKET_NAME` | ✅ | The name of your R2 bucket (e.g. `fileshare-uploads`). |
| `R2_PUBLIC_URL` | ✅ | Public URL for your R2 bucket (e.g. `https://pub-xxx.r2.dev`). Enable public access in R2 bucket settings. |

---

## Upstash Redis

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash REST URL. Found in Upstash console → your database → REST API. |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash REST token. Same location. |

Redis is used for rate limiting. If these variables are absent the app starts and rate limiting silently disables (fails open). This is safe for local development but not for production.

---

## Resend (email)

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | ✅ | Resend API key. Free tier: 3,000 emails/month. https://resend.com |
| `EMAIL_FROM` | ✅ | Sender address, e.g. `noreply@yourdomain.com`. Must be a verified domain in Resend. |

---

## Application

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | Full URL of your deployment, no trailing slash. `http://localhost:3000` for local, `https://file-share.in` for production. Used to build share links. |
| `CRON_SECRET` | ✅ | Random secret string to authenticate Vercel cron job requests. Generate with: `openssl rand -hex 32` |

---

## AI Assistant — Groq

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Your Groq API key. Free at https://console.groq.com — no credit card required. |
| `GROQ_MODEL` | ✅ | Model name to use. Default: `llama-3.3-70b-versatile`. See free model list at https://console.groq.com/docs/models. |

The AI call is **server-side only**. This key is never sent to the browser.

**Switching AI providers:** Edit `src/lib/assistant/ai-provider.ts` and add a new class implementing `AIProvider`. No other files need to change.

---

## AI Assistant — Admin

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAILS` | ✅ | Comma-separated list of Supabase Auth email addresses that can access `/admin/assistant`. Example: `you@example.com,colleague@example.com`. No spaces around commas. |

Authorization is checked server-side on every admin request. No client-supplied role is trusted.

---

## AI Assistant — Telegram

| Variable | Optional | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Optional | Bot token from @BotFather. Required to run the Telegram support bot. Without this variable, the Telegram webhook route still responds 200 but sends no replies. |
| `TELEGRAM_WEBHOOK_SECRET` | Optional | A random string used to verify that webhook requests come from Telegram. Set the same value when registering the webhook. Generate with: `openssl rand -hex 32` |

See [telegram-setup.md](telegram-setup.md) for full setup instructions.

---

## GitHub Actions CI

The CI workflow (`/.github/workflows/ci.yml`) reads the following from repository secrets:

- All `SUPABASE_*`, `R2_*`, `UPSTASH_*`, `CRON_SECRET`, `RESEND_API_KEY` — set as **Secrets**
- `NEXT_PUBLIC_*` variables — can be set as repository **Variables** (not Secrets) since they are safe to expose

Add `GROQ_API_KEY`, `ADMIN_EMAILS`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` as repository Secrets in GitHub → Settings → Secrets and variables → Actions.

Then update `.github/workflows/ci.yml` to include:

```yaml
GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
ADMIN_EMAILS: ${{ secrets.ADMIN_EMAILS }}
TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
TELEGRAM_WEBHOOK_SECRET: ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}
```
