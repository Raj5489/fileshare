/**
 * /admin/assistant — Overview
 * Server component: data fetched server-side, streams instantly.
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

// ── Data ─────────────────────────────────────────────────────────────────────

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

// ── Components ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
      {children}
    </p>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconFg,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconFg: string;
  href?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/70 leading-tight">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className={`h-4 w-4 ${iconFg}`} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight tabular-nums leading-none">
          {value.toLocaleString()}
        </p>
        {sub && (
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
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
  low: "bg-muted-foreground/30",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const s = await getStats();

  return (
    <div className="flex flex-col gap-7 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live support metrics for FileShare AI.
        </p>
      </div>

      {/* ── Conversations ── */}
      <div>
        <SectionLabel>Conversations</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total"
            value={s.conversations.total}
            icon={MessageSquare}
            iconBg="bg-indigo-100 dark:bg-indigo-900/40"
            iconFg="text-indigo-600 dark:text-indigo-400"
            href="/admin/assistant/conversations"
          />
          <StatCard
            label="Web Chatbot"
            value={s.conversations.web}
            sub="browser widget"
            icon={Globe}
            iconBg="bg-violet-100 dark:bg-violet-900/40"
            iconFg="text-violet-600 dark:text-violet-400"
          />
          <StatCard
            label="Telegram"
            value={s.conversations.telegram}
            sub="telegram bot"
            icon={Send}
            iconBg="bg-sky-100 dark:bg-sky-900/40"
            iconFg="text-sky-600 dark:text-sky-400"
          />
        </div>
      </div>

      {/* ── Tickets ── */}
      <div>
        <SectionLabel>Tickets</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total"
            value={s.tickets.total}
            icon={Ticket}
            iconBg="bg-indigo-100 dark:bg-indigo-900/40"
            iconFg="text-indigo-600 dark:text-indigo-400"
            href="/admin/assistant/tickets"
          />
          <StatCard
            label="Open"
            value={s.tickets.open}
            sub="needs attention"
            icon={AlertCircle}
            iconBg="bg-blue-100 dark:bg-blue-900/40"
            iconFg="text-blue-600 dark:text-blue-400"
            href="/admin/assistant/tickets"
          />
          <StatCard
            label="In Progress"
            value={s.tickets.inProgress}
            icon={Clock}
            iconBg="bg-amber-100 dark:bg-amber-900/40"
            iconFg="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Resolved / Closed"
            value={s.tickets.resolved + s.tickets.closed}
            icon={CheckCircle}
            iconBg="bg-green-100 dark:bg-green-900/40"
            iconFg="text-green-600 dark:text-green-400"
          />
        </div>
      </div>

      {/* ── AI & Knowledge Base ── */}
      <div>
        <SectionLabel>AI & Knowledge Base</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Messages"
            value={s.messages.total}
            sub="user + AI turns"
            icon={TrendingUp}
            iconBg="bg-emerald-100 dark:bg-emerald-900/40"
            iconFg="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="KB Active"
            value={s.knowledge.active}
            sub="active entries"
            icon={BookOpen}
            iconBg="bg-indigo-100 dark:bg-indigo-900/40"
            iconFg="text-indigo-600 dark:text-indigo-400"
            href="/admin/assistant/knowledge"
          />
          <StatCard
            label="KB Inactive"
            value={s.knowledge.inactive}
            sub="deactivated entries"
            icon={BookOpen}
            iconBg="bg-muted"
            iconFg="text-muted-foreground"
            href="/admin/assistant/knowledge"
          />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent conversations */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent Conversations</h2>
            <Link
              href="/admin/assistant/conversations"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {s.recentConvs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <ul>
              {s.recentConvs.map((c) => (
                <li
                  key={c.id as string}
                  className="border-b border-border last:border-0"
                >
                  <Link
                    href={`/admin/assistant/conversations?id=${c.id}`}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0
                        ${
                          (c.channel as string) === "telegram"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
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
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent Tickets</h2>
            <Link
              href="/admin/assistant/tickets"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {s.recentTickets.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No tickets yet.
            </p>
          ) : (
            <ul>
              {s.recentTickets.map((t) => (
                <li
                  key={t.id as string}
                  className="border-b border-border last:border-0"
                >
                  <Link
                    href={`/admin/assistant/tickets/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority as string] ?? "bg-muted"}`}
                    />
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${STATUS_PILL[t.status as string] ?? ""}`}
                    >
                      {(t.status as string).replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground truncate">
                      {t.ticket_id as string}
                    </span>
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
