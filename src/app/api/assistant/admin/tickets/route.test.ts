/**
 * Tests for admin ticket endpoints.
 * Verifies authorization enforcement and basic CRUD behaviour.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Admin auth mock ───────────────────────────────────────────────────────────

vi.mock("@/lib/assistant/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, email: "admin@test.com" }),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

function makeQueryBuilder(data: unknown, count = 0) {
  const q: Record<string, unknown> = {};
  const methods = ["select","update","eq","order","range","ilike","or","single","not"] as const;
  for (const m of methods) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  (q["range"] as ReturnType<typeof vi.fn>).mockResolvedValue({ data, count, error: null });
  (q["single"] as ReturnType<typeof vi.fn>).mockResolvedValue({ data, error: null });
  return q;
}

function makeRequest(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── GET /api/assistant/admin/tickets ─────────────────────────────────────────

describe("GET /api/assistant/admin/tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with ticket list", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(makeQueryBuilder([
        { id: "t1", ticket_id: "TKT-001", status: "open", priority: "medium" },
      ], 1)),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { GET } = await import("./route");
    const res  = await GET(makeRequest("http://localhost/api/assistant/admin/tickets"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it("returns 401 when not admin", async () => {
    const adminAuth = await import("@/lib/assistant/admin-auth");
    const { NextResponse } = await import("next/server");
    vi.mocked(adminAuth.requireAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("http://localhost/api/assistant/admin/tickets"));
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/assistant/admin/tickets/[id] ───────────────────────────────────

describe("PATCH /api/assistant/admin/tickets/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates status and returns updated ticket", async () => {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeQueryBuilder({ id: "t1", ticket_id: "TKT-001", status: "resolved", priority: "medium", admin_notes: null, updated_at: new Date().toISOString() }),
      ),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const { PATCH } = await import("./[id]/route");
    const res  = await PATCH(
      makeRequest("http://localhost/api/assistant/admin/tickets/t1", "PATCH", { status: "resolved" }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ticket.status).toBe("resolved");
  });

  it("returns 400 on invalid status value", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/assistant/admin/tickets/t1", "PATCH", { status: "banana" }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body has no updatable fields", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/assistant/admin/tickets/t1", "PATCH", {}),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(400);
  });
});
