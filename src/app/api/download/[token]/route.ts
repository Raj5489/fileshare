import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSignedDownloadUrl } from "@/lib/r2";
import {
  downloadLimit,
  passwordAttemptLimit,
  apiLimit,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

const downloadSchema = z.object({
  password: z.string().optional(),
  verify_only: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const ip = getClientIp(req);

    const { success: apiOk } = await apiLimit.limit(ip);
    if (!apiOk) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );
    }

    const { success: dlOk } = await downloadLimit.limit(ip);
    if (!dlOk) {
      return NextResponse.json(
        { error: "Download limit reached. Try again later." },
        { status: 429 },
      );
    }

    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { password, verify_only } = parsed.data;

    const admin = getSupabaseAdmin();
    const { data: file, error } = await admin
      .from("files")
      .select(
        "id, storage_key, original_name, mime_type, file_size, password_hash, expires_at, max_downloads, download_count, is_deleted, scan_status",
      )
      .eq("share_token", token)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (file.is_deleted) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (file.scan_status === "infected") {
      return NextResponse.json(
        { error: "This file has been blocked for safety reasons." },
        { status: 403 },
      );
    }

    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This link has expired." },
        { status: 410 },
      );
    }

    if (
      file.max_downloads !== null &&
      file.download_count >= file.max_downloads
    ) {
      return NextResponse.json(
        { error: "Download limit reached." },
        { status: 410 },
      );
    }

    // Password check
    if (file.password_hash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required.", requiresPassword: true },
          { status: 403 },
        );
      }

      const { success: pwOk } = await passwordAttemptLimit.limit(ip);
      if (!pwOk) {
        return NextResponse.json(
          { error: "Too many password attempts. Try again later." },
          { status: 429 },
        );
      }

      const valid = await bcrypt.compare(password, file.password_hash);
      if (!valid) {
        return NextResponse.json(
          { error: "Incorrect password." },
          { status: 403 },
        );
      }
    }

    // If verify_only, just return success without generating URL or incrementing
    if (verify_only) {
      return NextResponse.json({ success: true });
    }

    // Generate signed download URL (15 minutes)
    const download_url = await getSignedDownloadUrl(
      file.storage_key,
      file.original_name,
      900,
    );

    // Increment download count atomically using DB-level increment
    await admin.rpc("increment_download_count", { file_id: file.id });

    return NextResponse.json({
      download_url,
      filename: file.original_name,
      content_type: file.mime_type,
    });
  } catch (err) {
    console.error("[Download] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
