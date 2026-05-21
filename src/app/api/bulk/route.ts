import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { deleteFromR2 } from "@/lib/r2";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp, parseExpiry } from "@/lib/utils";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    tokens: z.array(z.string().min(1)).min(1).max(100),
  }),
  z.object({
    action: z.literal("set_expiry"),
    tokens: z.array(z.string().min(1)).min(1).max(100),
    expires_in: z.enum(["1h", "24h", "7d", "30d", "never"]),
  }),
  z.object({
    action: z.literal("move_to_collection"),
    tokens: z.array(z.string().min(1)).min(1).max(100),
    collection_id: z.string().uuid().nullable(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success } = await apiLimit.limit(ip);
    if (!success)
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { action, tokens } = parsed.data;

    if (action === "delete") {
      // Fetch storage keys for all tokens owned by this user
      const { data: files } = await admin
        .from("files")
        .select("share_token, storage_key")
        .in("share_token", tokens)
        .eq("user_id", user.id)
        .eq("is_deleted", false);

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: "No matching files found." },
          { status: 404 },
        );
      }

      // Delete from R2 in parallel
      await Promise.allSettled(files.map((f) => deleteFromR2(f.storage_key)));

      // Soft delete in DB
      const { error } = await admin
        .from("files")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in(
          "share_token",
          files.map((f) => f.share_token),
        )
        .eq("user_id", user.id);

      if (error)
        return NextResponse.json(
          { error: "Failed to delete files." },
          { status: 500 },
        );

      return NextResponse.json({ success: true, affected: files.length });
    }

    if (action === "set_expiry") {
      const expires_at = parseExpiry(parsed.data.expires_in);

      const { error } = await admin
        .from("files")
        .update({
          expires_at: expires_at?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
        })
        .in("share_token", tokens)
        .eq("user_id", user.id)
        .eq("is_deleted", false);

      if (error)
        return NextResponse.json(
          { error: "Failed to update expiry." },
          { status: 500 },
        );

      return NextResponse.json({ success: true });
    }

    if (action === "move_to_collection") {
      const { collection_id } = parsed.data;

      // If moving to a collection, verify it belongs to the user
      if (collection_id) {
        const { data: col } = await admin
          .from("collections")
          .select("id")
          .eq("id", collection_id)
          .eq("user_id", user.id)
          .single();

        if (!col)
          return NextResponse.json(
            { error: "Collection not found." },
            { status: 404 },
          );
      }

      const { error } = await admin
        .from("files")
        .update({ collection_id })
        .in("share_token", tokens)
        .eq("user_id", user.id)
        .eq("is_deleted", false);

      if (error)
        return NextResponse.json(
          { error: "Failed to move files." },
          { status: 500 },
        );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[Bulk/POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
