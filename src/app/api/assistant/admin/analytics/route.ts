/**
 * GET /api/assistant/admin/analytics
 * Aggregated analytics from real database data.
 * Admin-only.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/assistant/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  // Last 30 days range
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [convsResult, ticketsResult, kbResult, feedbackResult] =
    await Promise.all([
      // All conversations in last 30 days
      admin
        .from("assistant_conversations")
        .select("id, channel, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true }),

      // All tickets in last 30 days
      admin
        .from("assistant_tickets")
        .select("id, status, priority, category, created_at")
        .gte("created_at", since),

      // Knowledge base category distribution
      admin.from("assistant_knowledge").select("category, is_active"),

      // Feedback ratings
      admin
        .from("assistant_feedback")
        .select("rating, created_at")
        .gte("created_at", since),
    ]);

  const convs = convsResult.data ?? [];
  const tickets = ticketsResult.data ?? [];
  const kbRows = kbResult.data ?? [];
  const feedback = feedbackResult.data ?? [];

  // ── Daily conversation counts (last 30 days) ──────────────
  const dailyCounts: Record<string, { web: number; telegram: number }> = {};
  for (const c of convs) {
    const day = (c.created_at as string).slice(0, 10);
    if (!dailyCounts[day]) dailyCounts[day] = { web: 0, telegram: 0 };
    if (c.channel === "web") dailyCounts[day].web++;
    if (c.channel === "telegram") dailyCounts[day].telegram++;
  }
  const dailyConversations = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.web + counts.telegram,
    }));

  // ── Channel distribution ───────────────────────────────────
  const webTotal = convs.filter((c) => c.channel === "web").length;
  const telegramTotal = convs.filter((c) => c.channel === "telegram").length;

  // ── Ticket resolution stats ────────────────────────────────
  const ticketByStatus: Record<string, number> = {};
  const ticketByCategory: Record<string, number> = {};
  for (const t of tickets) {
    ticketByStatus[t.status] = (ticketByStatus[t.status] ?? 0) + 1;
    ticketByCategory[t.category] = (ticketByCategory[t.category] ?? 0) + 1;
  }

  // ── KB category breakdown ──────────────────────────────────
  const kbByCategory: Record<string, { active: number; inactive: number }> = {};
  for (const k of kbRows) {
    if (!kbByCategory[k.category])
      kbByCategory[k.category] = { active: 0, inactive: 0 };
    if (k.is_active) kbByCategory[k.category].active++;
    else kbByCategory[k.category].inactive++;
  }

  // ── Feedback summary ──────────────────────────────────────
  const avgRating =
    feedback.length > 0
      ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length
      : null;
  const ratingDistribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const f of feedback) {
    ratingDistribution[f.rating] = (ratingDistribution[f.rating] ?? 0) + 1;
  }

  return NextResponse.json({
    period: { from: since, to: new Date().toISOString() },
    dailyConversations,
    channelDistribution: {
      web: webTotal,
      telegram: telegramTotal,
      total: convs.length,
    },
    ticketResolution: {
      byStatus: ticketByStatus,
      byCategory: ticketByCategory,
      total: tickets.length,
    },
    knowledgeBase: {
      byCategory: kbByCategory,
      totalActive: kbRows.filter((k) => k.is_active).length,
      totalInactive: kbRows.filter((k) => !k.is_active).length,
    },
    feedback: {
      total: feedback.length,
      averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      distribution: ratingDistribution,
    },
  });
}
