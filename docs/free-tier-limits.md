# Free-Tier Limits

This document explains the resource limits of every free-tier service used in this project, what happens when a limit is reached, and what the upgrade path looks like.

---

## Groq (AI provider)

**Free tier:**
- No credit card required
- ~14,400 requests per day on `llama-3.3-70b-versatile`
- Rate limit: varies by model, typically 30 requests/minute
- Context window: 128K tokens (more than enough for chat)
- Max tokens per response: configured to 512 (keeps costs predictable)

**What happens at the limit:**
Groq returns HTTP 429. The `ai-provider.ts` layer catches this and returns a user-friendly message: *"I'm receiving a lot of requests right now. Please try again in a moment."* No crash, no silent failure.

**Usage estimate:**
At 10 messages/minute per IP rate limit, sustained heavy usage would reach ~14,400 requests in roughly 24 hours of non-stop traffic. Normal support volume stays well below this.

**To upgrade:** Add a paid Groq plan, or change `GROQ_MODEL` to a higher-quota model, or implement a second provider in `ai-provider.ts`.

---

## Supabase (database + auth)

**Free tier (Pause-on-inactivity plan):**
- 500 MB database storage
- 2 GB bandwidth per month
- 50,000 monthly active users
- 500 MB file storage (not used — files go to R2)
- Projects pause after 1 week of inactivity

**What happens at the limit:**
- Storage: inserts fail with a Supabase error. The API returns a 500.
- Bandwidth: connections are throttled.
- Paused project: all API calls fail. The `keepalive` cron job pings Supabase every 3 days to prevent pausing.

**Usage estimate for the AI tables:**
Each conversation row: ~200 bytes. Each message row: ~500 bytes average. At 100 conversations/day with 10 messages each: ~500 KB/day. This fits comfortably in 500 MB for many months.

**To upgrade:** Supabase Pro plan ($25/month) removes the pause policy and increases all limits.

---

## Cloudflare R2 (file storage)

**Free tier:**
- 10 GB storage
- 1 million Class A operations/month (writes, lists)
- 10 million Class B operations/month (reads)
- Egress: free (Cloudflare does not charge for egress)

**What happens at the limit:**
R2 operations return errors. The upload API returns a 500 and the user sees an error message.

**To upgrade:** R2 paid tier is $0.015/GB/month beyond 10 GB. Very inexpensive at scale.

---

## Upstash Redis (rate limiting)

**Free tier:**
- 10,000 commands per day
- 256 MB storage
- One database

**What happens at the limit:**
Upstash returns an error. The rate-limit module in `rate-limit.ts` is written to **fail open** — if Redis is unavailable or returns an error, it allows the request through. This prevents Redis issues from blocking legitimate users.

**Usage estimate:**
Each incoming request consumes 1–2 Redis commands (one per rate-limit check). At 1,000 requests/day across all limiters: ~2,000 commands/day, well within the 10,000 limit.

**To upgrade:** Upstash Pay-as-you-go plan starts at $0.2 per 100,000 commands.

---

## Vercel (hosting)

**Free (Hobby) tier:**
- 100 GB bandwidth per month
- 100 serverless function executions per day (Vercel cron)
- Unlimited deployments
- Edge Network CDN

**What happens at the limit:**
Bandwidth: Vercel throttles or blocks further requests. Cron: cron jobs do not run until the next day.

**To upgrade:** Vercel Pro ($20/month) for teams or higher-traffic projects.

---

## Resend (email)

**Free tier:**
- 3,000 emails per month
- 100 emails per day

**What happens at the limit:**
Resend returns a 429 error. Currently email is used for Supabase Auth (password reset, magic link). If the daily limit is hit, Auth emails fail silently from the user's perspective.

**To upgrade:** Resend paid plans start at $20/month for 50,000 emails.

---

## Summary

| Service | Daily free capacity | Upgrade trigger |
|---|---|---|
| Groq | ~14,400 AI requests | Sustained 24-hour traffic from many users |
| Supabase | — (monthly limits) | Months of moderate usage; pause prevention via cron |
| Cloudflare R2 | — (monthly limits) | File storage exceeds 10 GB |
| Upstash Redis | 10,000 commands | > ~5,000 rate-limited requests/day |
| Vercel | — (monthly limits) | > 100 GB transferred/month |
| Resend | 100 emails | > 100 Auth emails/day |

For a demo, portfolio, or small production deployment, all free tiers are sufficient indefinitely.
