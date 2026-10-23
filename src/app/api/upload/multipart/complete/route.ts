import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/r2";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

const completeSchema = z.object({
  token: z.string().min(1),
  storageKey: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success: apiOk } = await apiLimit.limit(ip);
    if (!apiOk) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, storageKey, uploadId, parts } = parsed.data;

    // Finalize the multipart upload in R2
    await completeMultipartUpload(
      storageKey,
      uploadId,
      parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
    );

    // Mark the file record as confirmed in the DB
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("files")
      .update({ is_confirmed: true, updated_at: new Date().toISOString() })
      .eq("share_token", token)
      .eq("is_deleted", false);

    if (error) {
      console.error("[Upload/Multipart/Complete] DB confirm error:", error);
      // R2 object is already finalized — log but don't fail the response
    }

    console.log(`[Upload/Multipart/Complete] Completed token=${token}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Upload/Multipart/Complete] Error:", err);

    // Best-effort abort — clean up the dangling multipart session
    try {
      const body = await req.json().catch(() => ({}));
      if (body.storageKey && body.uploadId) {
        await abortMultipartUpload(body.storageKey, body.uploadId);
      }
    } catch {
      // ignore abort errors
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}
