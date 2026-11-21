"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, RotateCcw, Ticket, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ChatBubble, { type Message } from "./ChatBubble";
import TypingIndicator from "./TypingIndicator";
import SuggestedQuestions from "./SuggestedQuestions";
import TicketForm from "./TicketForm";

// ── Types ────────────────────────────────────────────────────

type View = "chat" | "ticket" | "ticket-success";

// ── Constants ────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 1000;

function makeWelcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Hi! I'm the FileShare support assistant. I can help you with uploading, downloading, sharing files, and more.\n\nSelect a question below or type your own.",
    timestamp: new Date(),
  };
}

// ── Component ────────────────────────────────────────────────

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<Message[]>(() => [
    makeWelcomeMessage(),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, loading, open, scrollToBottom]);

  // Show scroll-to-bottom button when user scrolls up
  function handleScroll() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowScrollBtn(!atBottom);
  }

  // Focus input when chat opens
  useEffect(() => {
    if (open && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, view]);

  // ── Send message ──────────────────────────────────────────

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      if (data.conversationId) setConversationId(data.conversationId);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          data.reply ?? "Sorry, I couldn't get a response. Please try again.",
        timestamp: new Date(),
        error: data.error === true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleClear() {
    setMessages([makeWelcomeMessage()]);
    setConversationId(null);
    setView("chat");
    setTicketId(null);
  }

  function handleTicketSuccess(id: string) {
    setTicketId(id);
    setView("ticket-success");
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          open && "rotate-90",
        )}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}

        {/* Pulse ring when closed */}
        {!open && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-50" />
        )}
      </button>

      {/* ── Chat window ── */}
      <div
        role="dialog"
        aria-label="FileShare Support Chat"
        aria-hidden={!open}
        className={cn(
          // Position + size
          "fixed bottom-24 right-5 z-50 flex w-[calc(100vw-2.5rem)] flex-col overflow-hidden",
          "sm:w-[380px]",
          // Visual
          "rounded-2xl border border-border bg-card shadow-2xl shadow-black/20",
          // Animate in/out
          "transition-all duration-300 ease-out",
          open
            ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
            : "translate-y-4 scale-95 opacity-0 pointer-events-none",
        )}
        style={{ maxHeight: "min(600px, calc(100dvh - 7rem))" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-4 w-4 text-primary" />
              {/* Online indicator */}
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">
                FileShare Support
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                AI assistant · Usually instant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {view === "chat" && (
              <>
                <button
                  onClick={() => setView("ticket")}
                  title="Create support ticket"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Ticket className="h-4 w-4" />
                </button>
                <button
                  onClick={handleClear}
                  title="Clear conversation"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
            {view !== "chat" && (
              <button
                onClick={() => setView("chat")}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Chat view ── */}
        {view === "chat" && (
          <>
            {/* Messages scroll area */}
            <div
              ref={scrollAreaRef}
              onScroll={handleScroll}
              className="scrollbar-none flex-1 overflow-y-auto py-2"
              style={{ minHeight: 0 }}
            >
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollBtn && (
              <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2">
                <button
                  onClick={scrollToBottom}
                  className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-md hover:text-foreground"
                >
                  <ChevronDown className="h-3 w-3" />
                  Scroll to latest
                </button>
              </div>
            )}

            {/* Suggested questions — only shown before user sends first message */}
            {messages.length <= 1 && (
              <SuggestedQuestions onSelect={sendMessage} disabled={loading} />
            )}

            {/* Input area */}
            <div className="border-t border-border bg-card px-3 py-2.5">
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                  }
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  rows={1}
                  placeholder="Type a message… (Enter to send)"
                  aria-label="Chat message"
                  className={cn(
                    "scrollbar-none flex-1 resize-none rounded-xl border border-input bg-background",
                    "px-3 py-2 text-sm leading-relaxed outline-none",
                    "placeholder:text-muted-foreground",
                    "focus:border-ring focus:ring-2 focus:ring-ring/30",
                    "disabled:opacity-50",
                    "max-h-[120px] min-h-[38px]",
                  )}
                  style={{
                    height: "auto",
                    overflowY: input.split("\n").length > 4 ? "auto" : "hidden",
                  }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    "bg-primary text-primary-foreground transition-colors",
                    "hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {/* Send icon — inline SVG to avoid any lucide import issues */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                AI can make mistakes · For urgent help{" "}
                <button
                  onClick={() => setView("ticket")}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  create a ticket
                </button>
              </p>
            </div>
          </>
        )}

        {/* ── Ticket form view ── */}
        {view === "ticket" && (
          <div className="flex-1 overflow-y-auto">
            <TicketForm
              conversationId={conversationId ?? undefined}
              onSuccess={handleTicketSuccess}
              onCancel={() => setView("chat")}
            />
          </div>
        )}

        {/* ── Ticket success view ── */}
        {view === "ticket-success" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-7 w-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Ticket created!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your ticket ID is
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-primary">
                {ticketId}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Save this ID for reference. Our team will review your issue soon.
            </p>
            <button
              onClick={() => setView("chat")}
              className="mt-1 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to chat
            </button>
          </div>
        )}
      </div>
    </>
  );
}
