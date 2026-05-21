import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { deleteFromR2 } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    // Accept either Vercel's built-in cron auth header OR a secret query param
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isSecretParam = secret === process.env.CRON_SECRET;

    if (!isVercelCron && !isSecretParam) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // 1. Delete expired files
    const { data: expiredFiles, error: expiredError } = await admin
      .from("files")
      .select("id, storage_key")
      .lt("expires_at", new Date().toISOString())
      .eq("is_deleted", false);

    if (expiredError) {
      console.error("[Cleanup] Expired fetch error:", expiredError);
    }

    let deletedCount = 0;

    if (expiredFiles && expiredFiles.length > 0) {
      for (const file of expiredFiles) {
        await deleteFromR2(file.storage_key).catch((err) => {
          console.error("[Cleanup] R2 delete error:", err);
        });

        await admin
          .from("files")
          .update({ is_deleted: true })
          .eq("id", file.id);

        deletedCount++;
      }
    }

    // 2. Delete stale unconfirmed files (upload started but never completed) older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleFiles, error: staleError } = await admin
      .from("files")
      .select("id, storage_key")
      .eq("is_confirmed", false)
      .eq("is_deleted", false)
      .lt("created_at", oneHourAgo);

    if (staleError) {
      console.error("[Cleanup] Stale fetch error:", staleError);
    }

    if (staleFiles && staleFiles.length > 0) {
      for (const file of staleFiles) {
        // Attempt R2 delete in case a partial upload exists
        await deleteFromR2(file.storage_key).catch(() => {
          // Ignore — object may not exist if upload never started
        });

        await admin
          .from("files")
          .update({ is_deleted: true })
          .eq("id", file.id);

        deletedCount++;
      }
    }

    // 3. Delete files where max_downloads reached and created 7+ days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: limitFiles, error: limitError } = await admin
      .from("files")
      .select("id, storage_key, download_count, max_downloads")
      .eq("is_deleted", false)
      .not("max_downloads", "is", null)
      .lte("created_at", sevenDaysAgo.toISOString());

    if (limitError) {
      console.error("[Cleanup] Limit fetch error:", limitError);
    }

    if (limitFiles && limitFiles.length > 0) {
      for (const file of limitFiles) {
        if (
          file.max_downloads !== null &&
          file.download_count >= file.max_downloads
        ) {
          await deleteFromR2(file.storage_key).catch((err) => {
            console.error("[Cleanup] R2 delete error:", err);
          });

          await admin
            .from("files")
            .update({ is_deleted: true })
            .eq("id", file.id);

          deletedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (err) {
    console.error("[Cleanup] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
