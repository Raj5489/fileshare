/**
 * POST /api/assistant/ticket
 *
 * Creates a support ticket from the web chatbot or Telegram.
 * Rate-limited to prevent spam.
 *
 * Request body:
 *   {
 *     conversationId?: string,
 *     channel: "web" | "telegram",
 *     customerName?: string,
 *     customerEmail?: string,
 *     category: string,
 *     description: string
 *   }
 *
 * Response (success):
 *   { ticketId: string }
 *
 * Response (error):
 *   { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ticketLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { createSupportTicket } from "@/lib/assistant/support";

const TICKET_CATEGORIES = [
  "upload_issue",
  "download_issue",
  "account_issue",
  "sharing_issue",
  "expiry_issue",
  "password_issue",
  "billing_issue",
  "other",
] as const;

const ticketSchema = z.object({
  conversationId: z.string().uuid().optional(),
  channel: z.enum(["web", "telegram"]),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email().max(200).optional(),
  category: z.enum(TICKET_CATEGORIES),
  description: z
    .string()
    .min(10, "Please describe your issue in at least 10 characters.")
    .max(2000, "Description must be 2000 characters or less."),
});

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit ──────────────────────────────────────────
    const ip = getClientIp(req);
    const { success: ticketOk } = await ticketLimit.limit(ip);
    if (!ticketOk) {
      return NextResponse.json(
        {
          error:
            "Too many ticket submissions. Please wait an hour before submitting another ticket.",
        },
        { status: 429 },
      );
    }

    // ── Parse ───────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = ticketSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request data.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = parsed.data;

    // ── Create ticket ───────────────────────────────────────
    const result = await createSupportTicket({
      conversationId: data.conversationId,
      channel: data.channel,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      category: data.category,
      description: data.description,
    });

    if (!result.ok) {
      console.error("[Ticket API] Create failed:", result.error);
      return NextResponse.json(
        { error: result.error ?? "Failed to create ticket." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ticketId: result.ticketId }, { status: 201 });
  } catch (err) {
    console.error("[Ticket API] Unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
