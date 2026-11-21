"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface Conversation {
  id: string;
  session_id: string;
  channel: "web" | "telegram";
  telegram_chat_id: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  assistant_messages: [{ count: number }];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const LIMIT = 20;

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(channel && { channel }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/assistant/admin/conversations?${params}`);
      const data = await res.json();
      setConversations(data.data ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      // silent — keep existing data
    } finally {
      setLoading(false);
    }
  }, [page, channel, search]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  async function loadMessages(convId: string) {
    setSelected(convId);
    setMsgLoading(true);
    try {
      const res = await fetch(`/api/assistant/admin/conversations/${convId}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setMsgLoading(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button
          onClick={fetchConversations}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search session ID…"
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
        >
          <option value="">All channels</option>
          <option value="web">Web</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* List */}
        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p>No conversations found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadMessages(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                    selected === c.id ? "bg-primary/8" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "inline-flex h-5 w-12 items-center justify-center rounded-full text-[9px] font-semibold shrink-0",
                        c.channel === "telegram"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {c.channel === "telegram" ? "Telegram" : "Web"}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {c.id.slice(0, 12)}…
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(c.updated_at)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {(
                        c.assistant_messages?.[0] as unknown as {
                          count: number;
                        }
                      )?.count ?? 0}{" "}
                      messages
                    </p>
                  </div>
                </button>
              ))}
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

        {/* Message thread */}
        <div className="rounded-xl border border-border bg-card">
          {!selected ? (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p>Select a conversation to view messages.</p>
            </div>
          ) : msgLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading messages…
            </div>
          ) : (
            <div
              className="flex flex-col gap-0 overflow-y-auto"
              style={{ maxHeight: "60vh" }}
            >
              <div className="sticky top-0 border-b border-border bg-card px-4 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {messages.length} messages · ID: {selected.slice(0, 8)}…
                </p>
              </div>
              <div className="flex flex-col gap-2 p-4">
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
      </div>
    </div>
  );
}
