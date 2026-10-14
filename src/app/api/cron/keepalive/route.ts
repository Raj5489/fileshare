import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/cron/keepalive
 *
 * Runs every 3 days via Vercel Cron to prevent Supabase from pausing
 * the project due to inactivity (free tier pauses after 7 days).
 *
 * Makes a lightweight DB ping — no data is read or written.
 */
export async function GET() {
  try {
    const start = Date.now();
    const admin = getSupabaseAdmin();

    // Lightweight ping — just count rows in files table (no data returned)
    const { error } = await admin
      .from("files")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("[Keepalive] Supabase ping failed:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const latencyMs = Date.now() - start;
    console.log(`[Keepalive] Supabase ping OK — ${latencyMs}ms`);

    return NextResponse.json({
      success: true,
      message: "Supabase is alive.",
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Keepalive] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}
