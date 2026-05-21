import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

const schema = z.object({
  // token of the file to add/remove
  token: z.string().min(1),
  action: z.enum(["add", "remove"]),
});

// POST: Add or remove a file from a collection
export async function POST(
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
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const { token, action } = parsed.data;
    const admin = getSupabaseAdmin();

    // Verify collection belongs to user
    const { data: col } = await admin
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!col)
      return NextResponse.json(
        { error: "Collection not found." },
        { status: 404 },
      );

    const { error } = await admin
      .from("files")
      .update({ collection_id: action === "add" ? id : null })
      .eq("share_token", token)
      .eq("user_id", user.id)
      .eq("is_deleted", false);

    if (error)
      return NextResponse.json(
        { error: "Failed to update file." },
        { status: 500 },
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Collections/Files/POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
