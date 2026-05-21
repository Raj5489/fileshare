import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSignedDownloadUrl } from "@/lib/r2";
import { apiLimit } from "@/lib/rate-limit";
import { formatBytes, getClientIp, parseExpiry } from "@/lib/utils";

// GET: Public file metadata
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const admin = getSupabaseAdmin();
    const { data: file, error } = await admin
      .from("files")
      .select(
        "id, share_token, original_name, mime_type, file_size, download_count, max_downloads, expires_at, is_deleted, password_hash, created_at, storage_key",
      )
      .eq("share_token", token)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (file.is_deleted) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const is_expired = file.expires_at
      ? new Date(file.expires_at) < new Date()
      : false;
    const is_download_limit_reached =
      file.max_downloads !== null && file.download_count >= file.max_downloads;

    let preview_url: string | null = null;
    if (
      !is_expired &&
      !is_download_limit_reached &&
      !file.is_deleted &&
      (file.mime_type.startsWith("image/") ||
        file.mime_type === "application/pdf" ||
        file.mime_type.startsWith("video/") ||
        file.mime_type.startsWith("audio/"))
    ) {
      preview_url = await getSignedDownloadUrl(
        file.storage_key,
        file.original_name,
        3600,
      );
    }

    return NextResponse.json({
      token: file.share_token,
      original_name: file.original_name,
      mime_type: file.mime_type,
      file_size: file.file_size,
      file_size_formatted: formatBytes(file.file_size),
      download_count: file.download_count,
      expires_at: file.expires_at,
      has_password: !!file.password_hash,
      is_expired,
      is_download_limit_reached,
      preview_url,
      created_at: file.created_at,
    });
  } catch (err) {
    console.error("[Files/Token] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// PATCH: Extend expiry (authenticated owner only)
const patchSchema = z.object({
  expires_in: z.enum(["1h", "24h", "7d", "30d", "never"]),
});

export async function PATCH(
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

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { token } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { expires_in } = parsed.data;
    const expires_at = parseExpiry(expires_in);

    const { error } = await getSupabaseAdmin()
      .from("files")
      .update({
        expires_at: expires_at?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", token)
      .eq("user_id", user.id)
      .eq("is_deleted", false);

    if (error) {
      console.error("[Files/Token] PATCH error:", error);
      return NextResponse.json(
        { error: "Failed to update file." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, expires_at });
  } catch (err) {
    console.error("[Files/Token] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// DELETE: Delete file (authenticated owner only)
export async function DELETE(
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

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { token } = await params;

    // Fetch file to get storage key
    const { data: file, error: fetchError } = await getSupabaseAdmin()
      .from("files")
      .select("storage_key")
      .eq("share_token", token)
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { error: "File not found or access denied." },
        { status: 404 },
      );
    }

    // Delete from R2 (fire and forget, will retry via cleanup if fails)
    const { deleteFromR2 } = await import("@/lib/r2");
    await deleteFromR2(file.storage_key).catch((err) => {
      console.error("[Files/Delete] R2 delete error:", err);
    });

    // Soft delete in DB
    const { error: updateError } = await getSupabaseAdmin()
      .from("files")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("share_token", token)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[Files/Delete] DB update error:", updateError);
      return NextResponse.json(
        { error: "Failed to delete file." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Files/Token] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
