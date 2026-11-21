/**
 * Tests for POST /api/assistant/telegram
 * Verifies webhook validation, command routing, and AI delegation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock support module ───────────────────────────────────────────────────────

vi.mock("@/lib/assistant/support", () => ({
  getOrCreateTelegramConversation: vi
    .fn()
    .mockResolvedValue("conv-tg-456"),
  sendMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-tg-456",
    assistantMessage: "Here is help for your question.",
    rateLimited: false,
    error: false,
  }),
  createSupportTicket: vi.fn().mockResolvedValue({
    ok: true,
    ticketId: "TKT-20250601-0001",
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTelegramRequest(
  body: unknown,
  secret?: string,
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) {
    headers["x-telegram-bot-api-secret-token"] = secret;
  }
  return new NextRequest("http://localhost/api/assistant/telegram", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeUpdate(text: string, chatId = 12345): object {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: 99, first_name: "Test" },
      chat: { id: chatId },
      text,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/assistant/telegram", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "correct-secret");

    // Mock Telegram sendMessage API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    vi.clearAllMocks();

    // Re-stub fetch after clearAllMocks
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  it("returns 200 and ignores request with wrong secret", async () => {
    const { POST } = await import("./route");
    const req = makeTelegramRequest(makeUpdate("hello"), "wrong-secret");
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Should not have called sendMessage at all
    const support = await import("@/lib/assistant/support");
    expect(vi.mocked(support.sendMessage)).not.toHaveBeenCalled();
  });

  it("responds to /start command with welcome message", async () => {
    const { POST } = await import("./route");
    const req = makeTelegramRequest(makeUpdate("/start"), "correct-secret");
    await POST(req);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("sendMessage"),
      expect.objectContaining({ method: "POST" }),
    );

    const callBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(callBody.text).toMatch(/hello|welcome|FileShare/i);
  });

  it("responds to /help command", async () => {
    const { POST } = await import("./route");
    const req = makeTelegramRequest(makeUpdate("/help"), "correct-secret");
    await POST(req);

    const callBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(callBody.text).toMatch(/commands|help|ticket/i);
  });

  it("delegates non-command messages to AI support", async () => {
    const support = await import("@/lib/assistant/support");
    vi.mocked(support.sendMessage).mockResolvedValue({
      conversationId: "conv-tg-456",
      assistantMessage: "Here is help.",
      rateLimited: false,
      error: false,
    });

    const { POST } = await import("./route");
    const req = makeTelegramRequest(
      makeUpdate("My download is not working"),
      "correct-secret",
    );
    await POST(req);

    expect(vi.mocked(support.sendMessage)).toHaveBeenCalledWith(
      "conv-tg-456",
      "My download is not working",
    );
  });

  it("creates a ticket when message matches the ticket pattern", async () => {
    const support = await import("@/lib/assistant/support");

    const { POST } = await import("./route");
    const req = makeTelegramRequest(
      makeUpdate("John, john@test.com — My upload is stuck.", 99999),
      "correct-secret",
    );
    await POST(req);

    expect(vi.mocked(support.createSupportTicket)).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        customerName: "John",
        customerEmail: "john@test.com",
      }),
    );
  });

  it("always returns 200 even when processing fails", async () => {
    const support = await import("@/lib/assistant/support");
    vi.mocked(support.getOrCreateTelegramConversation).mockRejectedValueOnce(
      new Error("DB error"),
    );

    const { POST } = await import("./route");
    const req = makeTelegramRequest(
      makeUpdate("test message"),
      "correct-secret",
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("ignores updates with no message text", async () => {
    const { POST } = await import("./route");
    const req = makeTelegramRequest(
      { update_id: 1, message: { chat: { id: 1 }, message_id: 1 } },
      "correct-secret",
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
