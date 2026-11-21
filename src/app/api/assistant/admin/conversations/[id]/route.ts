/**
 * GET /api/assistant/admin/conversations/[id]
 * Single conversation with all its messages.
 * Admin-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const admin = getSupabaseAdmin();

  const [convResult, msgResult] = await Promise.all([
    admin
      .from("assistant_conversations")
      .select("id, session_id, channel, telegram_chat_id, user_id, created_at, updated_at")
      .eq("id", id)
      .single(),
    admin
      .from("assistant_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (convResult.error || !convResult.data) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversation: convResult.data,
    messages: msgResult.data ?? [],
  });
}
