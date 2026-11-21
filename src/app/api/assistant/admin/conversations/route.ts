/**
 * GET /api/assistant/admin/conversations
 * Paginated conversation list with optional channel filter and search.
 * Admin-only.
 *
 * Query params:
 *   page     number  (default 1)
 *   limit    number  (default 20, max 50)
 *   channel  "web" | "telegram" | ""
 *   search   string  (matches session_id prefix)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const channel = searchParams.get("channel") ?? "";
  const search  = searchParams.get("search")?.trim() ?? "";
  const offset  = (page - 1) * limit;

  const admin = getSupabaseAdmin();

  let query = admin
    .from("assistant_conversations")
    .select(
      `id, session_id, channel, telegram_chat_id, user_id, created_at, updated_at,
       assistant_messages(count)`,
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel === "web" || channel === "telegram") {
    query = query.eq("channel", channel);
  }
  if (search) {
    query = query.ilike("session_id", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[Admin/Conversations] DB error:", error.message);
    return NextResponse.json({ error: "Failed to fetch conversations." }, { status: 500 });
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
