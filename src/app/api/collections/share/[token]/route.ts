import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatBytes } from "@/lib/utils";

// GET: Public collection metadata + file list
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const admin = getSupabaseAdmin();

    const { data: collection, error } = await admin
      .from("collections")
      .select("id, name, share_token, created_at")
      .eq("share_token", token)
      .single();

    if (error || !collection) {
      return NextResponse.json(
        { error: "Collection not found." },
        { status: 404 },
      );
    }

    const { data: files } = await admin
      .from("files")
      .select(
        "share_token, original_name, mime_type, file_size, download_count, expires_at, created_at",
      )
      .eq("collection_id", collection.id)
      .eq("is_deleted", false)
      .eq("is_confirmed", true)
      .order("created_at", { ascending: false });

    const fileList = (files || []).map((f) => ({
      ...f,
      file_size_formatted: formatBytes(f.file_size),
      is_expired: f.expires_at ? new Date(f.expires_at) < new Date() : false,
    }));

    return NextResponse.json({
      collection: {
        name: collection.name,
        share_token: collection.share_token,
        created_at: collection.created_at,
        file_count: fileList.length,
      },
      files: fileList,
    });
  } catch (err) {
    console.error("[Collections/Share/GET]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
