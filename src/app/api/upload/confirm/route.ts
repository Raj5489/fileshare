import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { readObjectRange, isExecutableMagic } from "@/lib/r2";

const confirmSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { token } = parsed.data;
    const admin = getSupabaseAdmin();

    // Use raw SQL via rpc to bypass any trigger issues and confirm atomically
    const { data, error } = await admin
      .from("files")
      .update({
        is_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", token)
      .eq("is_deleted", false)
      .select("id, is_confirmed");

    if (error) {
      console.error("[Upload/Confirm] DB error:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Failed to confirm upload.", detail: error.message },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      console.error("[Upload/Confirm] No rows updated for token:", token);
      return NextResponse.json(
        { error: "File record not found." },
        { status: 404 },
      );
    }

    console.log("[Upload/Confirm] Confirmed:", data[0]);

    // Best-effort magic-byte check: quarantine renamed executables that are
    // masked as images/documents. Fails open — never blocks a valid upload.
    try {
      const { data: fileRow } = await admin
        .from("files")
        .select("id, storage_key")
        .eq("share_token", token)
        .single();
      if (fileRow?.storage_key) {
        const head = await readObjectRange(fileRow.storage_key, 16);
        if (head && isExecutableMagic(head)) {
          await admin
            .from("files")
            .update({ scan_status: "infected" })
            .eq("id", fileRow.id);
        }
      }
    } catch (scanErr) {
      // Never fail an upload because of an optional scan.
      console.warn("[Upload/Confirm] Scan skipped:", scanErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Upload/Confirm] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Internal server error.",
      },
      { status: 500 },
    );
  }
}
