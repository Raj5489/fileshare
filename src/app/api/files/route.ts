import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // Fetch files + stats + collections in parallel
    const admin = getSupabaseAdmin();
    const [filesResult, profileResult, collectionsResult] = await Promise.all([
      supabase
        .from("files")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      admin
        .from("profiles")
        .select("storage_used, file_count")
        .eq("id", user.id)
        .single(),
      admin
        .from("collections")
        .select("id, name, share_token")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (filesResult.error) {
      console.error("[Files/List] DB error:", filesResult.error);
      return NextResponse.json(
        { error: "Failed to fetch files." },
        { status: 500 },
      );
    }

    const files = filesResult.data || [];
    const count = filesResult.count || 0;

    // Compute total downloads from current page — for accurate total we sum all files
    const { data: allFiles } = await admin
      .from("files")
      .select("download_count")
      .eq("user_id", user.id)
      .eq("is_deleted", false);

    const totalDownloads =
      allFiles?.reduce((sum, f) => sum + (f.download_count || 0), 0) || 0;

    return NextResponse.json({
      files,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      stats: {
        file_count: profileResult.data?.file_count || 0,
        storage_used: profileResult.data?.storage_used || 0,
        total_downloads: totalDownloads,
      },
      collections: collectionsResult.data || [],
    });
  } catch (err) {
    console.error("[Files/List] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
