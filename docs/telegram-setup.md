# Telegram Bot Setup

This guide walks through creating the FileShare support bot on Telegram and connecting it to your deployment.

---

## Step 1 — Create the bot with @BotFather

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. When prompted, enter a display name: `FileShare Support`
4. Enter a username (must end in `bot`): e.g. `fileshare_support_bot`
5. BotFather will reply with your **bot token** — a string like `9191149085:AAEudkrc...`
6. Copy it. You will never see it again in this form (you can revoke and regenerate if lost).

---

## Step 2 — Set environment variables

Add these to your environment (`.env.local` for local dev, Vercel settings for production):

```
TELEGRAM_BOT_TOKEN=<your bot token from BotFather>
TELEGRAM_WEBHOOK_SECRET=<a random string — generate with: openssl rand -hex 32>
```

The webhook secret is a value you choose. Telegram will send it in every request header so your server can verify the request is genuine.

---

## Step 3 — Deploy your application

The Telegram webhook handler lives at:

```
POST /api/assistant/telegram
```

This route must be publicly reachable over HTTPS before you register the webhook. Localhost does **not** work — Telegram cannot reach it.

**For production:** Deploy to Vercel first (see [deployment.md](deployment.md)), then come back here.

**For local testing:** Use a tunnel service:

```bash
# Option A — ngrok (free tier)
npx ngrok http 3000
# Copy the https:// URL it gives you

# Option B — Cloudflare Tunnel (free, no account needed for quick tunnels)
npx cloudflared tunnel --url http://localhost:3000
```

Your webhook URL will be: `https://<your-tunnel-or-domain>/api/assistant/telegram`

---

## Step 4 — Register the webhook with Telegram

Replace the placeholders and run this curl command once:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-domain>/api/assistant/telegram",
    "secret_token": "<your TELEGRAM_WEBHOOK_SECRET value>",
    "allowed_updates": ["message"]
  }'
```

**Expected response:**

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## Step 5 — Verify the webhook is set

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Look for `"url"` matching your deployment URL and `"pending_update_count": 0`.

---

## Step 6 — Test the bot

Open Telegram, search for your bot username, and send:

- `/start` — should reply with a welcome message
- `/help` — should list available commands
- `How do I upload a file?` — should reply with an AI-generated answer

---

## Updating the webhook URL

If your domain changes (e.g. you rename the Vercel project), re-run the `setWebhook` command with the new URL. Only one webhook URL can be active at a time.

To remove the webhook (e.g. to switch back to polling for local testing):

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

---

## Bot commands (register with BotFather for the menu)

You can register the commands so they appear in Telegram's command menu:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start",  "description": "Welcome message and introduction"},
      {"command": "help",   "description": "Show available commands"},
      {"command": "ticket", "description": "Create a support ticket"}
    ]
  }'
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Bot does not reply | Webhook not registered or wrong URL | Re-run `setWebhook` with the correct URL |
| Bot replies with generic error | `TELEGRAM_BOT_TOKEN` not set in env | Add the variable and redeploy |
| Webhook returns 200 but no reply sent | `TELEGRAM_BOT_TOKEN` missing server-side | Same as above |
| Requests rejected (no processing) | `TELEGRAM_WEBHOOK_SECRET` mismatch | Ensure the env variable matches what you passed to `setWebhook` |
| AI replies with "not configured" message | `GROQ_API_KEY` not set | Add the Groq API key to environment variables |
