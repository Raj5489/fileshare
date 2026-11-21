"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Ticket,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface TicketRow {
  id: string;
  ticket_id: string;
  channel: string;
  customer_name: string | null;
  customer_email: string | null;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const STATUS_PILL: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_PILL: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-destructive/10 text-destructive",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [channel, setChannel] = useState("");

  const LIMIT = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(channel && { channel }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/assistant/admin/tickets?${params}`);
      const data = await res.json();
      setTickets(data.data ?? []);
      setTotal(data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, status, priority, channel, search]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ticket ID or email…"
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {[
          {
            value: status,
            onChange: (v: string) => {
              setStatus(v);
              setPage(1);
            },
            options: ["open", "in_progress", "resolved", "closed"],
            placeholder: "Status",
          },
          {
            value: priority,
            onChange: (v: string) => {
              setPriority(v);
              setPage(1);
            },
            options: ["low", "medium", "high", "critical"],
            placeholder: "Priority",
          },
          {
            value: channel,
            onChange: (v: string) => {
              setChannel(v);
              setPage(1);
            },
            options: ["web", "telegram"],
            placeholder: "Channel",
          },
        ].map(({ value, onChange, options, placeholder }) => (
          <select
            key={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
          >
            <option value="">{placeholder}: All</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o.replace("_", " ")}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <Ticket className="h-8 w-8 opacity-30" />
            <p>No tickets found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {[
                    "Ticket ID",
                    "Status",
                    "Priority",
                    "Channel",
                    "Category",
                    "Customer",
                    "Created",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/assistant/tickets/${t.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {t.ticket_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          STATUS_PILL[t.status] ?? "",
                        )}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          PRIORITY_PILL[t.priority] ?? "",
                        )}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                      {t.channel}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.category.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.customer_name ?? t.customer_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
