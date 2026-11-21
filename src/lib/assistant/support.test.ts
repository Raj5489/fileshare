/**
 * Tests for the core support service.
 * Mocks Supabase admin and AI provider — no real network calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Returns chainable query builders that resolve with configurable data.

function makeQueryBuilder(resolveWith: unknown) {
  const q: Record<string, unknown> = {};
  const methods = ["select","insert","update","eq","order","limit","range","maybeSingle","single","gte","ilike","or","not","textSearch"] as const;
  for (const m of methods) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  (q["maybeSingle"] as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  (q["single"]      as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  // Allow awaiting the builder directly
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return q;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/assistant/ai-provider", () => ({
  generateAIResponse: vi.fn().mockResolvedValue({
    content: "Here is the AI answer.",
    rateLimited: false,
    error: false,
  }),
}));

vi.mock("@/lib/assistant/knowledge", () => ({
  retrieveKnowledge: vi.fn().mockResolvedValue([]),
  formatKnowledgeContext: vi.fn().mockReturnValue(""),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getOrCreateWebConversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing conversation id when found", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeQueryBuilder({ data: { id: "existing-conv-id" }, error: null }),
      ),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { getOrCreateWebConversation } = await import("./support");
    const id = await getOrCreateWebConversation("session-abc");
    expect(id).toBe("existing-conv-id");
  });

  it("creates a new conversation when none exists", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    let callCount = 0;
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: maybeSingle returns null (no existing conv)
          return makeQueryBuilder({ data: null, error: null });
        }
        // Second call: insert returns new conv
        return makeQueryBuilder({ data: { id: "new-conv-id" }, error: null });
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { getOrCreateWebConversation } = await import("./support");
    const id = await getOrCreateWebConversation("session-new");
    expect(id).toBe("new-conv-id");
  });
});

describe("sendMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists user message, calls AI, persists assistant reply", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const insertMock = vi.fn().mockReturnValue(
      makeQueryBuilder({ data: { id: "msg-id" }, error: null }),
    );
    const selectMock = vi.fn().mockReturnValue(
      makeQueryBuilder({ data: [], error: null }),
    );

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: insertMock,
        select: selectMock,
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const aiProvider = await import("@/lib/assistant/ai-provider");
    vi.mocked(aiProvider.generateAIResponse).mockResolvedValue({
      content: "Here is the answer.",
      rateLimited: false,
      error: false,
    });

    const { sendMessage } = await import("./support");
    const result = await sendMessage("conv-123", "How do I upload?");

    expect(result.assistantMessage).toBe("Here is the answer.");
    expect(result.error).toBe(false);
    expect(result.conversationId).toBe("conv-123");
  });

  it("truncates messages longer than MAX_MESSAGE_LENGTH", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const insertMock = vi.fn().mockReturnValue(
      makeQueryBuilder({ data: { id: "msg-id" }, error: null }),
    );
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { sendMessage, MAX_MESSAGE_LENGTH } = await import("./support");
    const longMessage = "x".repeat(MAX_MESSAGE_LENGTH + 500);
    const result = await sendMessage("conv-123", longMessage);

    // Should not throw and should return a response
    expect(result.conversationId).toBe("conv-123");

    // Verify the content inserted was truncated
    const insertedContent = (insertMock.mock.calls[0] as unknown[][])[0] as { content: string }[];
    if (insertedContent?.[0]?.content) {
      expect(insertedContent[0].content.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    }
  });

  it("returns error:true and a safe message when AI throws", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue(makeQueryBuilder({ data: { id: "m" }, error: null })),
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const aiProvider = await import("@/lib/assistant/ai-provider");
    vi.mocked(aiProvider.generateAIResponse).mockRejectedValueOnce(
      new Error("Unexpected AI failure"),
    );

    const { sendMessage } = await import("./support");
    const result = await sendMessage("conv-err", "test");

    expect(result.error).toBe(true);
    expect(result.assistantMessage).toBeTruthy();
  });
});

describe("createSupportTicket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a ticket ID via RPC and inserts the ticket", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const rpcMock    = vi.fn().mockResolvedValue({ data: "TKT-20250601-0001", error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc:  rpcMock,
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { createSupportTicket } = await import("./support");
    const result = await createSupportTicket({
      channel: "web",
      category: "upload_issue",
      description: "Upload stuck at 50%.",
    });

    expect(result.ok).toBe(true);
    expect(result.ticketId).toBe("TKT-20250601-0001");
    expect(rpcMock).toHaveBeenCalledWith("generate_ticket_id");
  });

  it("returns ok:false when RPC fails", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC error" } }),
      from: vi.fn(),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { createSupportTicket } = await import("./support");
    const result = await createSupportTicket({
      channel: "web",
      category: "other",
      description: "Test description here.",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ticket ID/i);
  });

  it("returns ok:false when DB insert fails", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc:  vi.fn().mockResolvedValue({ data: "TKT-20250601-0002", error: null }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "insert failed" } }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { createSupportTicket } = await import("./support");
    const result = await createSupportTicket({
      channel: "telegram",
      category: "download_issue",
      description: "Cannot download the file at all.",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
