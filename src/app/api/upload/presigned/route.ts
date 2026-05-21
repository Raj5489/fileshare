import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPresignedUploadUrl } from "@/lib/r2";
import { guestUploadLimit, authUploadLimit, apiLimit } from "@/lib/rate-limit";
import {
  generateShareToken,
  generateStorageKey,
  sanitizeFileName,
  validateFileType,
  parseExpiry,
  getClientIp,
} from "@/lib/utils";

const presignedSchema = z.object({
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
    // General API rate limit
    const ip = getClientIp(req);
    const { success: apiOk } = await apiLimit.limit(ip);
    if (!apiOk) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );
    }

    // Auth
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Upload rate limit
    const limiter = user ? authUploadLimit : guestUploadLimit;
    const limitKey = user ? user.id : ip;
    const { success: uploadOk } = await limiter.limit(limitKey);
    if (!uploadOk) {
      return NextResponse.json(
        { error: "Upload limit reached. Try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = presignedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 },
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

    // Validate file type and size
    const validation = validateFileType(mime_type, original_name, file_size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate token and storage key
    const share_token = generateShareToken();
    const storage_key = generateStorageKey(original_name);
    const expires_at = parseExpiry(expires_in || "24h");

    // Hash password if provided
    let password_hash: string | null = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    // Insert file record (use admin client for guest uploads)
    const admin = getSupabaseAdmin();
    const { error: dbError } = await admin.from("files").insert({
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

    if (dbError) {
      console.error(
        "[Upload] DB insert error:",
        JSON.stringify(dbError, null, 2),
      );
      return NextResponse.json(
        { error: `Failed to create file record: ${dbError.message}` },
        { status: 500 },
      );
    }

    // Generate presigned PUT URL for direct R2 upload
    const presignedUrl = await getPresignedUploadUrl(
      storage_key,
      mime_type,
      600, // 10 minutes
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${appUrl}/f/${share_token}`;

    return NextResponse.json({
      token: share_token,
      presignedUrl,
      shareUrl,
      storageKey: storage_key,
    });
  } catch (err) {
    console.error("[Upload/Presigned] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
