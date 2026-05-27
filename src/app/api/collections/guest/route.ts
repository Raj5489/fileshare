import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp, generateShareToken } from "@/lib/utils";

const guestCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  tokens: z.array(z.string().min(1)).min(2).max(50),
});

/**
 * POST /api/collections/guest
 * Creates a collection for anonymous (non-logged-in) users.
 * Accepts an array of already-uploaded file tokens and groups them
 * under a single shareable collection link.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success } = await apiLimit.limit(ip);
    if (!success)
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );

    const body = await req.json();
    const parsed = guestCollectionSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 },
      );

    const { name, tokens } = parsed.data;
    const admin = getSupabaseAdmin();

    // Verify the tokens exist and are not deleted
    const { data: files, error: filesError } = await admin
      .from("files")
      .select("id, share_token, user_id")
      .in("share_token", tokens)
      .eq("is_deleted", false);

    if (filesError) {
      console.error("[GuestCollection/POST] Files query error:", filesError);
      return NextResponse.json(
        { error: "Failed to look up files." },
        { status: 500 },
      );
    }

    if (!files || files.length < 2) {
      console.error(
        "[GuestCollection/POST] Not enough files found. tokens:",
        tokens,
        "found:",
        files?.length ?? 0,
      );
      return NextResponse.json(
        { error: "At least 2 valid files are required." },
        { status: 404 },
      );
    }

    // Create the guest collection (user_id is null)
    const { data: collection, error: colError } = await admin
      .from("collections")
      .insert({
        user_id: null,
        name,
        share_token: generateShareToken(),
      })
      .select("id, name, share_token, created_at")
      .single();

    if (colError || !collection) {
      console.error("[GuestCollection/POST] Insert error:", colError);
      return NextResponse.json(
        { error: "Failed to create collection.", detail: colError?.message },
        { status: 500 },
      );
    }

    // Link all files to the collection
    const { error: updateError } = await admin
      .from("files")
      .update({ collection_id: collection.id })
      .in(
        "share_token",
        files.map((f) => f.share_token),
      );

    if (updateError) {
      console.error("[GuestCollection/POST] Link error:", updateError);
      // Clean up the orphaned collection
      await admin.from("collections").delete().eq("id", collection.id);
      return NextResponse.json(
        { error: "Failed to link files to collection." },
        { status: 500 },
      );
    }

    console.log(
      "[GuestCollection/POST] Created guest collection:",
      collection.share_token,
      "with",
      files.length,
      "files",
    );

    return NextResponse.json({ collection });
  } catch (err) {
    console.error("[GuestCollection/POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
