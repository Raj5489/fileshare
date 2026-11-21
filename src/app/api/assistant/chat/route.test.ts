/**
 * Tests for POST /api/assistant/chat
 *
 * Mocks:
 *  - rate-limit module (always allow unless testing 429 path)
 *  - support module (avoid real DB / AI calls)
 *  - supabase-server (no real auth)
 *  - next/headers cookies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Shared mock factories ─────────────────────────────────────────────────────

function makeRequest(body: unknown, sessionCookie?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "1.2.3.4",
  };
  if (sessionCookie) {
    headers["cookie"] = `fs_chat_session=${sessionCookie}`;
  }
  return new NextRequest("http://localhost/api/assistant/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ── Module mocks (hoisted before imports) ─────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  chatLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
  apiLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("@/lib/assistant/support", () => ({
  MAX_MESSAGE_LENGTH: 1000,
  getOrCreateWebConversation: vi.fn().mockResolvedValue("conv-123"),
  sendMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-123",
    assistantMessage: "Here is a helpful answer.",
    rateLimited: false,
    error: false,
  }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/assistant/chat", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-apply default mock implementations after clearing
    const rateLimit = vi.mocked(
      (await import("@/lib/rate-limit")) as typeof import("@/lib/rate-limit"),
    );
    rateLimit.chatLimit.limit = vi.fn().mockResolvedValue({ success: true });
  });

  it("returns 200 with AI reply on a valid message", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ message: "How do I upload a file?" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reply).toBe("Here is a helpful answer.");
    expect(json.conversationId).toBe("conv-123");
  });

  it("returns 400 when message is empty", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ message: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 400 when message exceeds max length", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ message: "a".repeat(1001) });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing the message field", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ notMessage: "hello" });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/assistant/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: "not json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    // Override rate limit mock for this test only
    const rateLimit = await import("@/lib/rate-limit");
    vi.mocked(rateLimit.chatLimit.limit).mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const { POST } = await import("./route");
    const req = makeRequest({ message: "hello" });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.rateLimited).toBe(true);
  });

  it("sets the session cookie on response", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ message: "hello" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Cookie is set via NextResponse.cookies — present in Set-Cookie header
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("fs_chat_session");
    expect(setCookie).toContain("HttpOnly");
  });
});
