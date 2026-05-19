import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const confirmSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // Update the file record to mark it as active (scan_status stays pending)
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("files")
      .update({ updated_at: new Date().toISOString() })
      .eq("share_token", token)
      .eq("is_deleted", false);

    if (error) {
      console.error("[Upload/Confirm] DB error:", error);
      return NextResponse.json(
        { error: "Failed to confirm upload." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Upload/Confirm] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
