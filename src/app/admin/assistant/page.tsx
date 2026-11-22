/**
 * /admin/assistant — Overview
 * Server component: data is fetched server-side, page streams instantly.
 */
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  MessageSquare,
  Ticket,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  Send,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// ── Data ─────────────────────────────────────────────────────

async function getStats() {
  const admin = getSupabaseAdmin();

  const [
    convResult,
    ticketResult,
    msgResult,
    kbResult,
    recentConvs,
    recentTickets,
  ] = await Promise.all([
    admin.from("assistant_conversations").select("channel"),
    admin.from("assistant_tickets").select("status, priority"),
    admin
      .from("assistant_messages")
      .select("id", { count: "exact", head: true }),
    admin.from("assistant_knowledge").select("is_active"),
    admin
      .from("assistant_conversations")
      .select("id, channel, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("assistant_tickets")
      .select("id, ticket_id, status, priority, category, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const convRows = convResult.data ?? [];
  const ticketRows = ticketResult.data ?? [];
  const kbRows = kbResult.data ?? [];

  return {
    conversations: {
      total: convRows.length,
      web: convRows.filter((r) => r.channel === "web").length,
      telegram: convRows.filter((r) => r.channel === "telegram").length,
    },
    tickets: {
      total: ticketRows.length,
      open: ticketRows.filter((r) => r.status === "open").length,
      inProgress: ticketRows.filter((r) => r.status === "in_progress").length,
      resolved: ticketRows.filter((r) => r.status === "resolved").length,
      closed: ticketRows.filter((r) => r.status === "closed").length,
    },
    messages: { total: msgResult.count ?? 0 },
    knowledge: {
      active: kbRows.filter((r) => r.is_active).length,
      inactive: kbRows.filter((r) => !r.is_active).length,
    },
    recentConvs: recentConvs.data ?? [],
    recentTickets: recentTickets.data ?? [],
  };
}

// ── Shared UI ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  href?: string;
}) {
  const content = (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground leading-snug">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight tabular-nums">
          {value.toLocaleString()}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

const STATUS_PILL: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-destructive",
};

// ── Page ──────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const s = await getStats();

  return (
    <div className="flex flex-col gap-6 max-w-6xl [&>div]:outline-none">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live support metrics for FileShare AI.
        </p>
      </div>

      {/* ── Conversations row ── */}
      <div className="outline-none">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Conversations
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total"
            value={s.conversations.total}
            icon={MessageSquare}
            iconColor="bg-primary/10 text-primary"
            href="/admin/assistant/conversations"
          />
          <StatCard
            label="Web chatbot"
            value={s.conversations.web}
            icon={Globe}
            iconColor="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
            sub="browser widget"
          />
          <StatCard
            label="Telegram"
            value={s.conversations.telegram}
            icon={Send}
            iconColor="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400"
            sub="telegram bot"
          />
        </div>
      </div>

      {/* ── Tickets row ── */}
      <div className="outline-none">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tickets
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total"
            value={s.tickets.total}
            icon={Ticket}
            iconColor="bg-primary/10 text-primary"
            href="/admin/assistant/tickets"
          />
          <StatCard
            label="Open"
            value={s.tickets.open}
            icon={AlertCircle}
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
            sub="needs attention"
            href="/admin/assistant/tickets"
          />
          <StatCard
            label="In progress"
            value={s.tickets.inProgress}
            icon={Clock}
            iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
          />
          <StatCard
            label="Resolved / Closed"
            value={s.tickets.resolved + s.tickets.closed}
            icon={CheckCircle}
            iconColor="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
          />
        </div>
      </div>

      {/* ── Other stats row ── */}
      <div className="outline-none">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI & Knowledge Base
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total messages"
            value={s.messages.total}
            icon={TrendingUp}
            iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
            sub="user + AI turns"
          />
          <StatCard
            label="KB entries (active)"
            value={s.knowledge.active}
            icon={BookOpen}
            iconColor="bg-primary/10 text-primary"
            href="/admin/assistant/knowledge"
          />
          <StatCard
            label="KB entries (inactive)"
            value={s.knowledge.inactive}
            icon={BookOpen}
            iconColor="bg-muted text-muted-foreground"
            href="/admin/assistant/knowledge"
          />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2 outline-none">
        {/* Recent conversations */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold">Recent Conversations</h2>
            <Link
              href="/admin/assistant/conversations"
              className="text-xs text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {s.recentConvs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {s.recentConvs.map((c) => (
                <li key={c.id as string}>
                  <Link
                    href={`/admin/assistant/conversations?id=${c.id}`}
                    className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0
                        ${
                          (c.channel as string) === "telegram"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {(c.channel as string) === "telegram" ? "TG" : "W"}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {(c.id as string).slice(0, 8)}…
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(c.updated_at as string)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent tickets */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold">Recent Tickets</h2>
            <Link
              href="/admin/assistant/tickets"
              className="text-xs text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {s.recentTickets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tickets yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {s.recentTickets.map((t) => (
                <li key={t.id as string}>
                  <Link
                    href={`/admin/assistant/tickets/${t.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    {/* Priority dot */}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority as string] ?? "bg-muted"}`}
                    />
                    {/* Status pill */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${STATUS_PILL[t.status as string] ?? ""}`}
                    >
                      {(t.status as string).replace("_", " ")}
                    </span>
                    {/* Ticket ID */}
                    <span className="font-mono text-xs font-semibold truncate">
                      {t.ticket_id as string}
                    </span>
                    {/* Date */}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDate(t.created_at as string)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
