"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "upload_issue",   label: "Upload problem" },
  { value: "download_issue", label: "Download problem" },
  { value: "sharing_issue",  label: "Sharing / link problem" },
  { value: "account_issue",  label: "Account / login problem" },
  { value: "expiry_issue",   label: "File expiry question" },
  { value: "password_issue", label: "Password protection" },
  { value: "other",          label: "Something else" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

interface TicketFormProps {
  conversationId?: string;
  onSuccess: (ticketId: string) => void;
  onCancel: () => void;
}

export default function TicketForm({
  conversationId,
  onSuccess,
  onCancel,
}: TicketFormProps) {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [category, setCategory]   = useState<Category>("other");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (description.trim().length < 10) {
      setError("Please describe your issue in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/assistant/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          channel: "web",
          customerName: name.trim() || undefined,
          customerEmail: email.trim() || undefined,
          category,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create ticket. Please try again.");
        return;
      }

      onSuccess(data.ticketId as string);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <p className="text-sm font-medium">Create a support ticket</p>
      <p className="text-xs text-muted-foreground">
        Our team will review your issue and respond as soon as possible.
      </p>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Your name <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Alex"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Email <span className="text-muted-foreground/60">(for follow-up)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          placeholder="you@example.com"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Issue type
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Describe your issue <span className="text-destructive">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Please describe what happened and what you expected..."
          className="resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <span className="text-right text-[10px] text-muted-foreground">
          {description.length}/2000
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}
