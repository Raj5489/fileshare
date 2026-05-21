import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiLimit } from "@/lib/rate-limit";
import { getClientIp, generateShareToken } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

// GET: List user's collections
export async function GET(req: NextRequest) {
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

    const { data, error } = await getSupabaseAdmin()
      .from("collections")
      .select("id, name, share_token, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error)
      return NextResponse.json(
        { error: "Failed to fetch collections." },
        { status: 500 },
      );

    return NextResponse.json({ collections: data });
  } catch (err) {
    console.error("[Collections/GET]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// POST: Create a new collection
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("collections")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        share_token: generateShareToken(),
      })
      .select("id, name, share_token, created_at")
      .single();

    if (error)
      return NextResponse.json(
        { error: "Failed to create collection." },
        { status: 500 },
      );

    return NextResponse.json({ collection: data });
  } catch (err) {
    console.error("[Collections/POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
