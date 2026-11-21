/**
 * POST /api/assistant/chat
 *
 * Accepts a user message, runs it through the support pipeline, and returns
 * the AI reply. Creates or resumes a conversation identified by a server-set
 * HttpOnly session cookie.
 *
 * Request body:
 *   { message: string }
 *
 * Response:
 *   { conversationId, reply, rateLimited?, error? }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { chatLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import {
  getOrCreateWebConversation,
  sendMessage,
  MAX_MESSAGE_LENGTH,
} from "@/lib/assistant/support";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const chatSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty.")
    .max(
      MAX_MESSAGE_LENGTH,
      `Message must be ${MAX_MESSAGE_LENGTH} characters or less.`,
    ),
});

// Session cookie name and config
const SESSION_COOKIE = "fs_chat_session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit ──────────────────────────────────────────
    const ip = getClientIp(req);
    const { success: chatOk } = await chatLimit.limit(ip);
    if (!chatOk) {
      return NextResponse.json(
        {
          error:
            "You've sent too many messages. Please wait a moment before trying again.",
          rateLimited: true,
        },
        { status: 429 },
      );
    }

    // ── Parse body ──────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { message } = parsed.data;

    // ── Session cookie ──────────────────────────────────────
    // Read the existing session ID from the HttpOnly cookie, or generate a
    // new one. The browser never controls this value directly.
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? "";

    // Validate that the cookie value looks like a UUID (not tampered)
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(sessionId)) {
      sessionId = crypto.randomUUID();
    }

    // ── Optional auth ───────────────────────────────────────
    let userId: string | undefined;
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      // Auth failure is non-fatal for chat — anonymous is fine
    }

    // ── Conversation ────────────────────────────────────────
    const conversationId = await getOrCreateWebConversation(sessionId, userId);

    // ── Process message ─────────────────────────────────────
    const result = await sendMessage(conversationId, message);

    // ── Build response ──────────────────────────────────────
    const response = NextResponse.json({
      conversationId: result.conversationId,
      reply: result.assistantMessage,
      ...(result.rateLimited && { rateLimited: true }),
      ...(result.error && { error: true }),
    });

    // Set / refresh the session cookie on the response
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Chat API] Unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
