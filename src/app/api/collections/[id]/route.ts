import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

const renameSchema = z.object({ name: z.string().min(1).max(100) });

// PATCH: Rename collection
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const body = await req.json();
    const parsed = renameSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const { error } = await getSupabaseAdmin()
      .from("collections")
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json(
        { error: "Failed to rename collection." },
        { status: 500 },
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Collections/PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// DELETE: Delete collection (files become uncollected, not deleted)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Step 1: Verify the collection belongs to this user
    const { data: collection, error: fetchError } = await admin
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !collection) {
      return NextResponse.json(
        { error: "Collection not found." },
        { status: 404 },
      );
    }

    // Step 2: Explicitly unlink all files from this collection
    // (the FK ON DELETE SET NULL also handles this, but we do it
    // explicitly first to ensure files are never accidentally deleted)
    const { error: unlinkError } = await admin
      .from("files")
      .update({ collection_id: null })
      .eq("collection_id", id);

    if (unlinkError) {
      console.error("[Collections/DELETE] Unlink error:", unlinkError);
      return NextResponse.json(
        { error: "Failed to unlink files from collection." },
        { status: 500 },
      );
    }

    // Step 3: Delete the collection
    const { error } = await admin
      .from("collections")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Collections/DELETE] Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete collection." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Collections/DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
