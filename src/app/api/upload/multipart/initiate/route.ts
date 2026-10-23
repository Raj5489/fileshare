import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createMultipartUpload,
  getPresignedPartUrl,
} from "@/lib/r2";
import { guestUploadLimit, authUploadLimit, apiLimit } from "@/lib/rate-limit";
import {
  generateShareToken,
  generateStorageKey,
  sanitizeFileName,
  validateFileType,
  parseExpiry,
  getClientIp,
} from "@/lib/utils";

// 50 MB per chunk — small enough to survive flaky connections, well above 5 MB minimum
export const MULTIPART_CHUNK_SIZE = 50 * 1024 * 1024;

const initiateSchema = z.object({
  original_name: z.string().min(1).max(255),
  file_size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024 * 1024),
  mime_type: z.string().min(1).max(100),
  expires_in: z.enum(["1h", "24h", "7d", "30d", "never"]).optional(),
  password: z.string().min(1).max(100).optional(),
  max_downloads: z.number().int().min(1).max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success: apiOk } = await apiLimit.limit(ip);
    if (!apiOk) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const limiter = user ? authUploadLimit : guestUploadLimit;
    const limitKey = user ? user.id : ip;
    const { success: uploadOk } = await limiter.limit(limitKey);
    if (!uploadOk) {
      return NextResponse.json(
        { error: "Upload limit reached. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = initiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      original_name: rawName,
      file_size,
      mime_type,
      expires_in,
      password,
      max_downloads,
    } = parsed.data;

    const original_name = sanitizeFileName(rawName);

    const validation = validateFileType(mime_type, original_name, file_size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let effectiveExpiresIn = expires_in || "24h";
    if (!user && (effectiveExpiresIn === "never" || effectiveExpiresIn === "30d")) {
      effectiveExpiresIn = "7d";
    }
    const expires_at = parseExpiry(effectiveExpiresIn);

    let password_hash: string | null = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 8);
    }

    // Insert DB record (same retry logic as presigned route)
    const admin = getSupabaseAdmin();
    let share_token = generateShareToken();
    let storage_key = generateStorageKey(original_name);
    let dbError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        share_token = generateShareToken();
        storage_key = generateStorageKey(original_name);
      }

      const { error } = await admin.from("files").insert({
        user_id: user?.id || null,
        share_token,
        original_name,
        storage_key,
        mime_type,
        file_size,
        max_downloads: max_downloads || null,
        password_hash,
        expires_at: expires_at?.toISOString() || null,
      });

      if (!error) { dbError = null; break; }
      dbError = error;
      const isUniqueError =
        error.code === "23505" ||
        error.message?.toLowerCase().includes("unique") ||
        error.details?.toLowerCase().includes("already exists");
      if (!isUniqueError) break;
    }

    if (dbError) {
      console.error("[Upload/Multipart/Initiate] DB error:", dbError);
      return NextResponse.json(
        { error: `Failed to create file record: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Create R2 multipart upload session
    const uploadId = await createMultipartUpload(storage_key, mime_type);

    // Generate presigned URL for every part (1-indexed)
    const numParts = Math.ceil(file_size / MULTIPART_CHUNK_SIZE);
    const partUrls = await Promise.all(
      Array.from({ length: numParts }, (_, i) =>
        getPresignedPartUrl(storage_key, uploadId, i + 1, 3600).then((url) => ({
          partNumber: i + 1,
          url,
        }))
      )
    );

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    console.log(
      `[Upload/Multipart/Initiate] token=${share_token} parts=${numParts} uploadId=${uploadId}`
    );

    return NextResponse.json({
      token: share_token,
      shareUrl: `${appUrl}/f/${share_token}`,
      storageKey: storage_key,
      uploadId,
      mimeType: mime_type,
      chunkSize: MULTIPART_CHUNK_SIZE,
      partUrls,
    });
  } catch (err) {
    console.error("[Upload/Multipart/Initiate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}
