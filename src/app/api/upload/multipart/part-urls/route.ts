import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPresignedPartUrl } from "@/lib/r2";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { MULTIPART_CHUNK_SIZE } from "../initiate/route";

// How many presigned URLs to return per batch request.
// 16 parts × 10 MB = 160 MB of headroom before the client needs to ask again.
const BATCH_SIZE = 16;

const schema = z.object({
  storageKey: z.string().min(1),
  uploadId: z.string().min(1),
  // The first part number this batch should cover (1-indexed)
  fromPart: z.number().int().min(1).max(10000),
  // Total number of parts in the whole upload — used to clamp the batch end
  totalParts: z.number().int().min(1).max(10000),
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { storageKey, uploadId, fromPart, totalParts } = parsed.data;

    // Generate presigned URLs for this batch only.
    // URLs are valid for 2 hours — plenty of time for 16 × 10 MB parts.
    const toPartInclusive = Math.min(fromPart + BATCH_SIZE - 1, totalParts);
    const count = toPartInclusive - fromPart + 1;

    const urls = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        getPresignedPartUrl(storageKey, uploadId, fromPart + i, 2 * 3600),
      ),
    );

    return NextResponse.json({
      fromPart,
      toPartInclusive,
      chunkSize: MULTIPART_CHUNK_SIZE,
      urls, // parallel array: urls[0] = presigned URL for part `fromPart`
    });
  } catch (err) {
    console.error("[Upload/Multipart/PartUrls] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 },
    );
  }
}
