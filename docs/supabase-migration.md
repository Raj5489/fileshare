# Supabase Migration Guide

This document explains how to apply every database migration in order.  
**All migrations are safe to re-run** — they use `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DROP IF EXISTS` guards throughout.

---

## Migration files

| File | Contents |
|---|---|
| `001_init.sql` | `profiles`, `files` tables, RLS policies, profile stats trigger |
| `002_add_is_confirmed.sql` | Adds `is_confirmed` column to `files` |
| `003_collections.sql` | `collections` table, `collection_id` FK on `files` |
| `004_fix_trigger_for_confirmed.sql` | Rebuilds the profile stats trigger to fire on confirmation |
| `005_remove_is_confirmed_from_rls.sql` | Removes `is_confirmed` from the public read policy |
| `006_guest_collections.sql` | Makes `user_id` nullable on `collections` for guest use |
| `007_fix_collection_delete.sql` | Adds `ON DELETE SET NULL` to `files.collection_id` FK |
| `008_increment_download_rpc.sql` | Atomic `increment_download_count(file_id)` RPC function |
| `009_assistant.sql` | Five AI assistant tables, RLS policies, seed data, ticket ID RPC |

---

## How to apply migrations

### Option A — Supabase SQL Editor (recommended for production)

1. Open your Supabase project → **SQL Editor**.
2. For each file in order (001 through 009), paste the full contents and click **Run**.
3. If a migration has already been applied, re-running it is safe — no data is destroyed.

### Option B — Supabase CLI (local development)

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked to your project:

```bash
# Link to your project (one-time)
supabase link --project-ref tyxucrpaplrdrrsoyykh

# Push all migrations
supabase db push
```

The CLI reads all files in `supabase/migrations/` and applies unapplied ones in order.

---

## What migration 009 creates

This is the only migration added by the AI assistant feature.

**Tables:**

```
assistant_conversations  — one row per chat session (web or Telegram)
assistant_messages       — individual message turns
assistant_knowledge      — knowledge-base entries
assistant_tickets        — support tickets
assistant_feedback       — optional message ratings
```

**Functions:**

```
set_updated_at()          — trigger function, updates updated_at on row change
generate_ticket_id()      — RPC, returns IDs like TKT-20250601-0042
```

**Seed data:** 21 verified knowledge-base entries covering general questions, uploading, downloading, sharing, folders, expiry, account management, security, and troubleshooting. All facts are verified against the codebase.

---

## Verifying the migration ran correctly

Run this query in the Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'assistant_%'
ORDER BY table_name;
```

You should see five rows: `assistant_conversations`, `assistant_feedback`, `assistant_knowledge`, `assistant_messages`, `assistant_tickets`.

Verify seed data:

```sql
SELECT COUNT(*) FROM public.assistant_knowledge WHERE is_active = TRUE;
-- Expected: 21
```

---

## Rolling back migration 009

If you need to remove the AI assistant tables entirely:

```sql
-- Drop in reverse dependency order
DROP TABLE IF EXISTS public.assistant_feedback;
DROP TABLE IF EXISTS public.assistant_tickets;
DROP TABLE IF EXISTS public.assistant_messages;
DROP TABLE IF EXISTS public.assistant_knowledge;
DROP TABLE IF EXISTS public.assistant_conversations;
DROP FUNCTION IF EXISTS public.generate_ticket_id();
DROP FUNCTION IF EXISTS public.set_updated_at();
```

This does not affect any existing FileShare tables.

---

## Row Level Security summary

| Table | Anon can INSERT | Anon can SELECT | Auth can SELECT |
|---|---|---|---|
| `assistant_conversations` | No (service-role only) | No | Own rows only |
| `assistant_messages` | No (service-role only) | No | Own conversations only |
| `assistant_knowledge` | No | Active entries only | Active entries only |
| `assistant_tickets` | Yes (create a ticket) | No | No |
| `assistant_feedback` | Yes | No | No |

All admin reads and writes use the **service-role key** server-side, which bypasses RLS. Admin authorization is enforced at the application layer by `src/lib/assistant/admin-auth.ts`.
