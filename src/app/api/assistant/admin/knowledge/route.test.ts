/**
 * Tests for admin knowledge-base endpoints.
 * Verifies auth enforcement, create, update, and soft-delete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/assistant/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, email: "admin@test.com" }),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

function makeQueryBuilder(data: unknown, count = 0) {
  const q: Record<string, unknown> = {};
  const methods = ["select","insert","update","eq","order","range","ilike","or","single"] as const;
  for (const m of methods) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  (q["range"]  as ReturnType<typeof vi.fn>).mockResolvedValue({ data, count, error: null });
  (q["single"] as ReturnType<typeof vi.fn>).mockResolvedValue({ data, error: null });
  // Bare await (then-able)
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve);
  return q;
}

function req(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const BASE = "http://localhost/api/assistant/admin/knowledge";

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/assistant/admin/knowledge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with entries", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(makeQueryBuilder([
        { id: "k1", category: "general", title: "What is FileShare", is_active: true },
      ], 1)),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { GET } = await import("./route");
    const res  = await GET(req(BASE));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("returns 401 without admin auth", async () => {
    const adminAuth = await import("@/lib/assistant/admin-auth");
    const { NextResponse } = await import("next/server");
    vi.mocked(adminAuth.requireAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const res = await GET(req(BASE));
    expect(res.status).toBe(401);
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/assistant/admin/knowledge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new entry and returns 201", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeQueryBuilder({ id: "k-new", category: "general", title: "New Entry", is_active: true, created_at: new Date().toISOString() }),
      ),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { POST } = await import("./route");
    const res = await POST(req(BASE, "POST", {
      category: "general",
      title: "New Entry",
      content: "This is the content of the new entry.",
      keywords: ["new", "entry"],
    }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.entry.title).toBe("New Entry");
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(req(BASE, "POST", {
      category: "general",
      content: "Content without a title.",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(req(BASE, "POST", {
      category: "general",
      title: "Title without content",
    }));
    expect(res.status).toBe(400);
  });
});

// ── PATCH/DELETE ──────────────────────────────────────────────────────────────

describe("PATCH /api/assistant/admin/knowledge/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates is_active and returns entry", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeQueryBuilder({ id: "k1", category: "general", title: "Entry", is_active: false, updated_at: new Date().toISOString() }),
      ),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { PATCH } = await import("./[id]/route");
    const res  = await PATCH(req(`${BASE}/k1`, "PATCH", { is_active: false }), { params: Promise.resolve({ id: "k1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entry.is_active).toBe(false);
  });

  it("returns 400 when no fields provided", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(req(`${BASE}/k1`, "PATCH", {}), { params: Promise.resolve({ id: "k1" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/assistant/admin/knowledge/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes by setting is_active=false", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: updateMock }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { DELETE } = await import("./[id]/route");
    const res  = await DELETE(req(`${BASE}/k1`, "DELETE"), { params: Promise.resolve({ id: "k1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
  });
});
