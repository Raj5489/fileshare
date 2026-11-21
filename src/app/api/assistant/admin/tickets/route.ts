/**
 * GET /api/assistant/admin/tickets
 * Paginated ticket list with status/priority/channel filters and search.
 * Admin-only.
 *
 * Query params:
 *   page     number
 *   limit    number  (max 50)
 *   status   open | in_progress | resolved | closed | ""
 *   priority low | medium | high | critical | ""
 *   channel  web | telegram | ""
 *   search   string  (matches ticket_id or customer_email)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit    = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status   = searchParams.get("status")   ?? "";
  const priority = searchParams.get("priority") ?? "";
  const channel  = searchParams.get("channel")  ?? "";
  const search   = searchParams.get("search")?.trim() ?? "";
  const offset   = (page - 1) * limit;

  const admin = getSupabaseAdmin();

  let query = admin
    .from("assistant_tickets")
    .select(
      "id, ticket_id, channel, customer_name, customer_email, category, description, status, priority, admin_notes, created_at, updated_at, conversation_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const STATUSES   = ["open", "in_progress", "resolved", "closed"] as const;
  const PRIORITIES = ["low", "medium", "high", "critical"] as const;
  const CHANNELS   = ["web", "telegram"] as const;

  if (STATUSES.includes(status as typeof STATUSES[number]))   query = query.eq("status",   status);
  if (PRIORITIES.includes(priority as typeof PRIORITIES[number])) query = query.eq("priority", priority);
  if (CHANNELS.includes(channel as typeof CHANNELS[number]))  query = query.eq("channel",  channel);

  if (search) {
    query = query.or(
      `ticket_id.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`,
    );
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[Admin/Tickets] DB error:", error.message);
    return NextResponse.json({ error: "Failed to fetch tickets." }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}
