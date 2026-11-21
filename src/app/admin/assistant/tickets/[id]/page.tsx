"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";

interface TicketDetail {
  id: string;
  ticket_id: string;
  channel: string;
  customer_name: string | null;
  customer_email: string | null;
  category: string;
  description: string;
  status: string;
  priority: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

const STATUS_PILL: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  closed: "bg-muted text-muted-foreground",
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Editable fields
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assistant/admin/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        router.push("/admin/assistant/tickets");
        return;
      }
      setTicket(data.ticket);
      setMessages(data.messages ?? []);
      setStatus(data.ticket.status);
      setPriority(data.ticket.priority);
      setAdminNotes(data.ticket.admin_notes ?? "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setToast("");
    try {
      const res = await fetch(`/api/assistant/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, admin_notes: adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Save failed.");
        return;
      }
      setTicket((t) => (t ? { ...t, ...data.ticket } : t));
      setToast("Saved successfully.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  if (!ticket) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/assistant/tickets"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-mono text-lg font-bold">{ticket.ticket_id}</h1>
          <p className="text-xs text-muted-foreground">
            Created {formatDate(ticket.created_at)} · {ticket.channel}
          </p>
        </div>
        <span
          className={cn(
            "ml-auto rounded-full px-3 py-1 text-xs font-medium",
            STATUS_PILL[ticket.status] ?? "",
          )}
        >
          {ticket.status.replace("_", " ")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: ticket detail + edit */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Issue description */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Description
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          {/* Customer info */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Customer
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Name", ticket.customer_name ?? "—"],
                ["Email", ticket.customer_email ?? "—"],
                ["Channel", ticket.channel],
                ["Category", ticket.category.replace(/_/g, " ")],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation thread */}
          {messages.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Conversation ({messages.length} messages)
              </p>
              <div className="flex flex-col gap-2 p-4 max-h-[400px] overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col gap-0.5",
                      m.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                        m.role === "user"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                    </div>
                    <span className="px-1 text-[9px] text-muted-foreground">
                      {m.role} · {formatDate(m.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Update ticket
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Internal notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Notes visible only to admins…"
                  className="resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {toast && (
                <p
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs",
                    toast.includes("failed") || toast.includes("error")
                      ? "bg-destructive/10 text-destructive"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                  )}
                >
                  {toast}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <p>Last updated: {formatDate(ticket.updated_at)}</p>
            {ticket.conversation_id && (
              <p className="mt-1 font-mono">
                Conv: {ticket.conversation_id.slice(0, 8)}…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
