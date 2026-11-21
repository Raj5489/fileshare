/**
 * GET /api/assistant/admin/stats
 * Overview metrics for the admin dashboard.
 * Admin-only — validated server-side via requireAdmin().
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  const [convResult, ticketResult, msgResult] = await Promise.all([
    // Conversation counts by channel
    admin.from("assistant_conversations").select("channel", { count: "exact" }),

    // Ticket counts by status
    admin.from("assistant_tickets").select("status", { count: "exact" }),

    // Total messages
    admin
      .from("assistant_messages")
      .select("id", { count: "exact", head: true }),
  ]);

  // Tally conversations
  const convRows = convResult.data ?? [];
  const totalConversations = convRows.length;
  const webConversations = convRows.filter((r) => r.channel === "web").length;
  const telegramConversations = convRows.filter(
    (r) => r.channel === "telegram",
  ).length;

  // Tally tickets
  const ticketRows = ticketResult.data ?? [];
  const totalTickets = ticketRows.length;
  const openTickets = ticketRows.filter((r) => r.status === "open").length;
  const inProgressTickets = ticketRows.filter(
    (r) => r.status === "in_progress",
  ).length;
  const resolvedTickets = ticketRows.filter(
    (r) => r.status === "resolved",
  ).length;
  const closedTickets = ticketRows.filter((r) => r.status === "closed").length;

  const totalMessages = msgResult.count ?? 0;

  // Recent activity — last 5 conversations
  const { data: recentActivity } = await admin
    .from("assistant_conversations")
    .select("id, channel, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    conversations: {
      total: totalConversations,
      web: webConversations,
      telegram: telegramConversations,
    },
    tickets: {
      total: totalTickets,
      open: openTickets,
      in_progress: inProgressTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
    },
    messages: {
      total: totalMessages,
    },
    recentActivity: recentActivity ?? [],
  });
}
