/**
 * GET  /api/assistant/admin/tickets/[id]  — fetch single ticket
 * PATCH /api/assistant/admin/tickets/[id] — update status, priority, admin_notes
 * Admin-only.
 *
 * PATCH body (all optional):
 *   { status?, priority?, admin_notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  status: z
    .enum(["open", "in_progress", "resolved", "closed"])
    .optional(),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .optional(),
  admin_notes: z.string().max(5000).optional(),
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
    .from("assistant_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  // Also fetch conversation messages if linked
  let messages: unknown[] = [];
  if (data.conversation_id) {
    const { data: msgs } = await admin
      .from("assistant_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    messages = msgs ?? [];
  }

  return NextResponse.json({ ticket: data, messages });
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
    .from("assistant_tickets")
    .update(parsed.data)
    .eq("id", id)
    .select("id, ticket_id, status, priority, admin_notes, updated_at")
    .single();

  if (error || !data) {
    console.error("[Admin/Tickets/PATCH] DB error:", error?.message);
    return NextResponse.json({ error: "Failed to update ticket." }, { status: 500 });
  }

  return NextResponse.json({ ticket: data });
}
