import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { abortMultipartUpload } from "@/lib/r2";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

const abortSchema = z.object({
  storageKey: z.string().min(1),
  uploadId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success: apiOk } = await apiLimit.limit(ip);
    if (!apiOk) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = abortSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { storageKey, uploadId } = parsed.data;

    await abortMultipartUpload(storageKey, uploadId);

    console.log(`[Upload/Multipart/Abort] Aborted uploadId=${uploadId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    // Best-effort — don't surface abort errors to the client
    console.error("[Upload/Multipart/Abort] Error:", err);
    return NextResponse.json({ success: false });
  }
}
