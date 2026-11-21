/**
 * GET  /api/assistant/admin/knowledge  — list entries (paginated + search)
 * POST /api/assistant/admin/knowledge  — create new entry
 * Admin-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const createSchema = z.object({
  category: z.string().min(1).max(60),
  title:    z.string().min(1).max(200),
  content:  z.string().min(1).max(10000),
  keywords: z.array(z.string().max(60)).max(20).default([]),
  is_active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit    = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const search   = searchParams.get("search")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const active   = searchParams.get("active");
  const offset   = (page - 1) * limit;

  const admin = getSupabaseAdmin();

  let query = admin
    .from("assistant_knowledge")
    .select("id, category, title, content, keywords, is_active, created_at, updated_at", {
      count: "exact",
    })
    .order("category", { ascending: true })
    .order("title",    { ascending: true })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (active === "true")  query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[Admin/Knowledge] GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch knowledge base." }, { status: 500 });
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

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("assistant_knowledge")
    .insert(parsed.data)
    .select("id, category, title, keywords, is_active, created_at")
    .single();

  if (error || !data) {
    console.error("[Admin/Knowledge] POST error:", error?.message);
    return NextResponse.json({ error: "Failed to create entry." }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
