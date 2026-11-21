"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
interface KBEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const BLANK: Omit<KBEntry, "id" | "created_at" | "updated_at"> = {
  category: "general",
  title: "",
  content: "",
  keywords: [],
  is_active: true,
};

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [kwInput, setKwInput] = useState("");

  const LIMIT = 20;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(category && { category }),
        ...(active && { active }),
      });
      const res = await fetch(`/api/assistant/admin/knowledge?${params}`);
      const data = await res.json();
      setEntries(data.data ?? []);
      setTotal(data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, active]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openCreate() {
    setForm({ ...BLANK });
    setKwInput("");
    setEditing(null);
    setCreating(true);
  }

  function openEdit(e: KBEntry) {
    setForm({
      category: e.category,
      title: e.title,
      content: e.content,
      keywords: e.keywords,
      is_active: e.is_active,
    });
    setKwInput("");
    setEditing(e);
    setCreating(false);
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
  }

  function addKeyword() {
    const kw = kwInput.trim().toLowerCase();
    if (kw && !form.keywords.includes(kw)) {
      setForm((f) => ({ ...f, keywords: [...f.keywords, kw] }));
    }
    setKwInput("");
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("Title and content are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/assistant/admin/knowledge/${editing.id}`
        : "/api/assistant/admin/knowledge";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Save failed.");
        return;
      }
      showToast(editing ? "Entry updated." : "Entry created.");
      closeForm();
      fetchEntries();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(entry: KBEntry) {
    const res = await fetch(`/api/assistant/admin/knowledge/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !entry.is_active }),
    });
    if (res.ok) {
      showToast(entry.is_active ? "Entry deactivated." : "Entry activated.");
      fetchEntries();
    }
  }

  const isFormOpen = creating || editing !== null;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">{total} entries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEntries}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New entry
          </button>
        </div>
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
            placeholder="Search title or content…"
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
        >
          <option value="">All categories</option>
          {[
            "general",
            "uploading",
            "downloading",
            "sharing",
            "folders",
            "expiry",
            "account",
            "security",
            "troubleshooting",
            "support",
          ].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {toast && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-xs",
            toast.includes("failed") || toast.includes("required")
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
          )}
        >
          {toast}
        </p>
      )}

      {/* Create / Edit form */}
      {isFormOpen && (
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">
              {creating ? "New entry" : "Edit entry"}
            </p>
            <button
              onClick={closeForm}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
              >
                {[
                  "general",
                  "uploading",
                  "downloading",
                  "sharing",
                  "folders",
                  "expiry",
                  "account",
                  "security",
                  "troubleshooting",
                  "support",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Title *</label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                maxLength={200}
                placeholder="Entry title"
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Content *</label>
              <textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={5}
                maxLength={10000}
                placeholder="Knowledge base content…"
                className="resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">
                Keywords (press Enter to add)
              </label>
              <div className="flex gap-2">
                <input
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="e.g. upload, file size"
                  className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                />
                <button
                  onClick={addKeyword}
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {form.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary"
                    >
                      {kw}
                      <button
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            keywords: f.keywords.filter((k) => k !== kw),
                          }))
                        }
                        className="text-primary/60 hover:text-primary"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Active</label>
              <button
                onClick={() =>
                  setForm((f) => ({ ...f, is_active: !f.is_active }))
                }
              >
                {form.is_active ? (
                  <ToggleRight className="h-5 w-5 text-primary" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={closeForm}
              className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-30" />
            <p>No entries found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  !e.is_active && "opacity-50",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {e.category}
                    </span>
                    <p className="text-sm font-medium truncate">{e.title}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.content}
                  </p>
                  {e.keywords.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.keywords.slice(0, 5).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                      {e.keywords.length > 5 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{e.keywords.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(e)}
                    title="Edit"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(e)}
                    title={e.is_active ? "Deactivate" : "Activate"}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {e.is_active ? (
                      <ToggleRight className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              ← Prev
            </button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
