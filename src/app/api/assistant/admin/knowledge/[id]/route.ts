/**
 * GET    /api/assistant/admin/knowledge/[id]  — fetch single entry
 * PATCH  /api/assistant/admin/knowledge/[id]  — update entry
 * DELETE /api/assistant/admin/knowledge/[id]  — deactivate (soft delete)
 * Admin-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  category:  z.string().min(1).max(60).optional(),
  title:     z.string().min(1).max(200).optional(),
  content:   z.string().min(1).max(10000).optional(),
  keywords:  z.array(z.string().max(60)).max(20).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("assistant_knowledge")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ entry: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("assistant_knowledge")
    .update(parsed.data)
    .eq("id", id)
    .select("id, category, title, is_active, updated_at")
    .single();

  if (error || !data) {
    console.error("[Admin/Knowledge/PATCH] DB error:", error?.message);
    return NextResponse.json({ error: "Failed to update entry." }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = getSupabaseAdmin();

  // Soft-delete: set is_active = false rather than destroying the row
  const { error } = await admin
    .from("assistant_knowledge")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("[Admin/Knowledge/DELETE] DB error:", error.message);
    return NextResponse.json({ error: "Failed to deactivate entry." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
