/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  readObjectRange: vi.fn(),
  isExecutableMagic: vi.fn(),
}));

import { POST } from "./route";
import { getSupabaseAdmin } from "@/lib/supabase";
import { readObjectRange, isExecutableMagic } from "@/lib/r2";

function makeAdminChain() {
  const state = {
    mainData: [{ id: "f1", is_confirmed: true }],
    scanData: { id: "f1", storage_key: "uploads/2026/k1.bin" },
  };
  // A chainable query builder that behaves like the Supabase query builder.
  const q: Record<string, any> = {
    _mode: "main",
    update: (val: any) => {
      q._mode = "main";
      q._update = val;
      return q;
    },
    select: (cols: string) => {
      if (typeof cols === "string" && cols.includes("storage_key")) {
        q._mode = "scan";
      }
      return q;
    },
    eq: () => q,
    single: async () => ({ data: state.scanData, error: null }),
    then(resolve: any, reject: any) {
      const payload =
        q._mode === "scan"
          ? { data: state.scanData, error: null }
          : { data: state.mainData, error: null };
      return Promise.resolve(payload).then(resolve, reject);
    },
  };
  return q;
}

function post(token: string) {
  return POST(
    new NextRequest("http://localhost/api/upload/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
}

describe("POST /api/upload/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getSupabaseAdmin as any).mockReturnValue({
      from: vi.fn(() => makeAdminChain()),
    });
  });

  it("confirms a file and returns success", async () => {
    (readObjectRange as any).mockResolvedValue(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
    (isExecutableMagic as any).mockReturnValue(false);

    const res = await post("abc123");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(readObjectRange).toHaveBeenCalledTimes(1);
    expect(isExecutableMagic).toHaveBeenCalledTimes(1);
  });

  it("quarantines when magic bytes indicate an executable", async () => {
    (readObjectRange as any).mockResolvedValue(
      new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
    );
    (isExecutableMagic as any).mockReturnValue(true);

    const res = await post("abc123");
    expect(res.status).toBe(200);
    expect(isExecutableMagic).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an invalid request", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/upload/confirm", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});
