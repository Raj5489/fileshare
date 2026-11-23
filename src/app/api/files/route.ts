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
    const [filesResult, profileResult, collectionsResult, allFilesResult] =
      await Promise.all([
        supabase
          .from("files")
          .select("*", { count: "exact" })
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
        admin
          .from("profiles")
          .select("storage_used, file_count, total_downloads")
          .eq("id", user.id)
          .single(),
        admin
          .from("collections")
          .select("id, name, share_token")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        // Fetch all file sizes for accurate storage calculation when profile is stale
        admin
          .from("files")
          .select("file_size, download_count")
          .eq("user_id", user.id)
          .eq("is_deleted", false),
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
    const allFilesData = allFilesResult.data ?? [];

    // If profile stats are stale (file_count=0 but files exist), calculate
    // directly from actual file data as a reliable fallback.
    const profileFileCount = profileResult.data?.file_count ?? 0;
    const profileStorageUsed = profileResult.data?.storage_used ?? 0;

    const actualStorageUsed =
      profileFileCount === 0 && count > 0
        ? allFilesData.reduce(
            (sum: number, f: { file_size: number }) => sum + (f.file_size || 0),
            0,
          )
        : profileStorageUsed;

    const finalFileCount =
      profileFileCount === 0 && count > 0 ? count : profileFileCount;

    // Always sum all download counts from actual data — most reliable
    const totalDownloads =
      allFilesData.length > 0
        ? allFilesData.reduce(
            (sum: number, f: { download_count: number }) =>
              sum + (f.download_count || 0),
            0,
          )
        : typeof profileResult.data?.total_downloads === "number"
          ? profileResult.data.total_downloads
          : 0;

    return NextResponse.json({
      files,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      stats: {
        file_count: finalFileCount,
        storage_used: actualStorageUsed,
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
