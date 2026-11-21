/**
 * Tests for POST /api/assistant/ticket
 * Covers: validation, rate limiting, success path, DB failure handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  ticketLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("@/lib/assistant/support", () => ({
  createSupportTicket: vi.fn().mockResolvedValue({
    ok: true,
    ticketId: "TKT-20250601-0001",
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/assistant/ticket", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  channel: "web",
  category: "upload_issue",
  description: "My upload is stuck at 50% and will not complete.",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/assistant/ticket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with ticketId on valid submission", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ticketId).toBe("TKT-20250601-0001");
  });

  it("passes channel and category to createSupportTicket", async () => {
    const support = await import("@/lib/assistant/support");
    const { POST } = await import("./route");

    await POST(makeRequest({ ...VALID_BODY, customerEmail: "user@test.com" }));

    expect(vi.mocked(support.createSupportTicket)).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "web",
        category: "upload_issue",
        customerEmail: "user@test.com",
      }),
    );
  });

  it("returns 400 when description is too short", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ ...VALID_BODY, description: "short" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at least 10/i);
  });

  it("returns 400 when channel is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ ...VALID_BODY, channel: "fax" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ ...VALID_BODY, category: "unknown_thing" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const { POST } = await import("./route");
    const { description: _desc, ...body } = VALID_BODY;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/assistant/ticket", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const rateLimit = await import("@/lib/rate-limit");
    vi.mocked(rateLimit.ticketLimit.limit).mockResolvedValueOnce({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 3600000,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
  });

  it("returns 500 when createSupportTicket fails", async () => {
    const support = await import("@/lib/assistant/support");
    vi.mocked(support.createSupportTicket).mockResolvedValueOnce({
      ok: false,
      error: "DB write failed.",
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("DB write failed.");
  });

  it("includes conversationId when provided", async () => {
    const support = await import("@/lib/assistant/support");
    const { POST } = await import("./route");

    const convId = crypto.randomUUID();
    await POST(makeRequest({ ...VALID_BODY, conversationId: convId }));

    expect(vi.mocked(support.createSupportTicket)).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: convId }),
    );
  });
});
