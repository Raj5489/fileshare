# FileShare AI — Multi-Channel Customer Support Platform

A production-quality file-sharing application with an integrated AI customer support system built on Next.js 16, Supabase, Cloudflare R2, and Groq.

**Live site:** https://file-share.in  
**Admin dashboard:** https://file-share.in/admin/assistant

---

## What this project is

FileShare is a free file-sharing service (upload, share, expire, password-protect files). On top of that core product, this repository includes **FileShare AI** — a fully integrated, multi-channel customer support automation platform built to demonstrate real-world AI integration skills.

### FileShare AI features

| Feature              | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| Website chatbot      | Floating widget on every page, suggested questions, ticket escalation |
| Telegram support bot | Same AI and knowledge base, via Telegram Bot API                      |
| AI knowledge base    | Supabase-backed, admin-editable, keyword + full-text retrieval        |
| Support ticketing    | Human-readable ticket IDs, status/priority workflow                   |
| Admin dashboard      | `/admin/assistant` — conversations, tickets, KB management, analytics |
| Provider abstraction | Swap AI providers by changing one env variable                        |

---

## Technology stack

| Layer                 | Technology                                    |
| --------------------- | --------------------------------------------- |
| Framework             | Next.js 16 (App Router, TypeScript strict)    |
| UI                    | Tailwind CSS v4, shadcn/ui, Lucide React      |
| Database              | Supabase PostgreSQL + Row Level Security      |
| Auth                  | Supabase Auth (email/password + Google OAuth) |
| Storage               | Cloudflare R2 (S3-compatible)                 |
| Cache / rate limiting | Upstash Redis                                 |
| AI provider           | Groq (free tier — no credit card required)    |
| Telegram              | Official Telegram Bot API (webhook)           |
| Deployment            | Vercel                                        |
| Testing               | Vitest                                        |

---

## Repository structure

```
src/
├── app/
│   ├── api/
│   │   ├── assistant/          ← AI support API routes
│   │   │   ├── chat/           ← POST /api/assistant/chat
│   │   │   ├── ticket/         ← POST /api/assistant/ticket
│   │   │   ├── telegram/       ← POST /api/assistant/telegram (webhook)
│   │   │   └── admin/          ← Admin-only data routes
│   │   ├── files/              ← File listing (authenticated)
│   │   ├── upload/             ← Presigned + multipart upload
│   │   ├── download/           ← Signed download URLs
│   │   └── collections/        ← Folder management
│   ├── admin/assistant/        ← Admin dashboard pages
│   ├── dashboard/              ← User file dashboard
│   ├── f/[token]/              ← File share page
│   └── c/[token]/              ← Collection share page
├── components/
│   ├── assistant/              ← Chatbot + admin UI components
│   └── ui/                     ← shadcn/ui primitives
└── lib/
    ├── assistant/              ← AI provider, KB retrieval, support logic
    ├── r2.ts                   ← Cloudflare R2 client
    ├── rate-limit.ts           ← Upstash rate limiters
    └── supabase*.ts            ← Supabase clients (browser, server, admin)

supabase/migrations/            ← Versioned SQL migrations (001–009)
docs/                           ← Setup and deployment guides
```

---

## Quick start (local development)

### Prerequisites

- Node.js 20+
- A Supabase project (free tier)
- Cloudflare R2 bucket (free tier)
- Upstash Redis database (free tier)
- Groq API key (free — https://console.groq.com)

### 1. Clone and install

```bash
git clone <repo-url>
cd fileshare
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every variable. See [docs/environment-variables.md](docs/environment-variables.md) for a description of each variable.

### 3. Apply database migrations

Run all SQL files in `supabase/migrations/` in order against your Supabase project. See [docs/supabase-migration.md](docs/supabase-migration.md) for step-by-step instructions.

### 4. Start the development server

```bash
npm run dev
```

Open http://localhost:3000.

The AI chatbot appears as a floating button on every page. The admin dashboard is at http://localhost:3000/admin/assistant (requires the email in `ADMIN_EMAILS` to be logged in).

### 5. Run tests

```bash
npm test          # run all tests
npx tsc --noEmit  # type-check
npm run lint      # lint
```

---

## Deployment

See [docs/deployment.md](docs/deployment.md) for the complete Vercel deployment checklist.

---

## Telegram setup

See [docs/telegram-setup.md](docs/telegram-setup.md) to create a bot, configure the webhook, and test it.

---

## Free-tier limits

See [docs/free-tier-limits.md](docs/free-tier-limits.md) for a plain-language explanation of what each free tier covers and when you would need to upgrade.

---

## Built by

Raj Parmar · [GitHub](https://github.com/Raj5489) · [LinkedIn](https://www.linkedin.com/in/raj-parmar-22261934b)
