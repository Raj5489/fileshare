/**
 * POST /api/assistant/telegram
 *
 * Telegram Bot webhook endpoint.
 *
 * Security:
 *   - Validates the X-Telegram-Bot-Api-Secret-Token header on every request.
 *   - The secret is set when registering the webhook (TELEGRAM_WEBHOOK_SECRET).
 *
 * Supported commands:
 *   /start  — welcome message
 *   /help   — list available commands
 *   /ticket — start ticket creation flow
 *
 * All other text is forwarded to the shared AI support pipeline.
 *
 * Always returns 200 to Telegram immediately (even on errors) to prevent
 * Telegram's retry mechanism from flooding the endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateTelegramConversation,
  sendMessage,
  createSupportTicket,
} from "@/lib/assistant/support";

// ── Telegram types (minimal — only what we need) ─────────────────────────────

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ── Telegram Bot API helpers ─────────────────────────────────────────────────

async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not set.");
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[Telegram] sendMessage failed ${res.status}:`,
        body.slice(0, 200),
      );
    }
  } catch (err) {
    console.error("[Telegram] sendMessage error:", err);
  }
}

// ── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Validate webhook secret ─────────────────────────────
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (incoming !== webhookSecret) {
      console.warn("[Telegram] Invalid webhook secret.");
      // Return 200 to avoid Telegram retry storms; just don't process it.
      return NextResponse.json({ ok: true });
    }
  }

  // ── Parse update ────────────────────────────────────────
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    console.error("[Telegram] Failed to parse update body.");
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message || !message.text) {
    // Non-text updates (photos, stickers, etc.) — ignore silently.
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name ?? "there";

  try {
    // ── Command routing ──────────────────────────────────
    if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        `👋 Hello, <b>${escapeHtml(firstName)}</b>! I'm the FileShare support assistant.\n\n` +
          `I can help you with:\n` +
          `• Uploading and downloading files\n` +
          `• Sharing files and folders\n` +
          `• File expiry and password protection\n` +
          `• Account and troubleshooting questions\n\n` +
          `Just type your question, or use /help to see available commands.`,
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>FileShare Support Bot</b>\n\n` +
          `Available commands:\n` +
          `/start — Welcome message\n` +
          `/help — Show this message\n` +
          `/ticket — Create a support ticket\n\n` +
          `Or just type your question and I'll do my best to help!\n\n` +
          `Visit <a href="https://file-share.in">file-share.in</a> to upload and share files.`,
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/ticket") {
      // Simple one-shot ticket from Telegram — description is the next message.
      // For now, prompt them to describe their issue in the next message.
      await sendTelegramMessage(
        chatId,
        `📋 To create a support ticket, please reply with:\n\n` +
          `<b>Your name, email (optional), and a description of your issue.</b>\n\n` +
          `Example:\n` +
          `<i>John, john@email.com — My upload is stuck at 50% and won't complete.</i>\n\n` +
          `Or visit <a href="https://file-share.in">file-share.in</a> and use the chat widget for a guided ticket form.`,
      );
      return NextResponse.json({ ok: true });
    }

    // Detect "name, email — description" pattern from /ticket prompt
    // Using [\s\S] instead of the s flag for ES2017 compatibility
    const ticketPattern = /^(.+?),\s*(.+?@.+?)\s*[—–-]\s*([\s\S]+)$/;
    const ticketMatch = text.match(ticketPattern);

    if (ticketMatch) {
      const [, name, email, description] = ticketMatch;
      const convId = await getOrCreateTelegramConversation(chatId);
      const ticket = await createSupportTicket({
        conversationId: convId,
        channel: "telegram",
        customerName: name.trim(),
        customerEmail: email.trim(),
        category: "other",
        description: description.trim(),
      });

      if (ticket.ok) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>Support ticket created!</b>\n\n` +
            `Ticket ID: <code>${ticket.ticketId}</code>\n\n` +
            `Our team will review your issue and get back to you. ` +
            `Please save your ticket ID for reference.`,
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ Sorry, I couldn't create your ticket right now. Please try again or visit file-share.in for support.`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── AI support reply ──────────────────────────────────
    const conversationId = await getOrCreateTelegramConversation(chatId);
    const result = await sendMessage(conversationId, text);

    let replyText = result.assistantMessage;

    // Append ticket prompt if AI indicated it couldn't help
    if (
      result.error ||
      replyText.toLowerCase().includes("support ticket") ||
      replyText.toLowerCase().includes("don't have that information")
    ) {
      replyText +=
        "\n\n💬 To create a support ticket, type /ticket and follow the instructions.";
    }

    await sendTelegramMessage(chatId, escapeHtml(replyText));
  } catch (err) {
    console.error("[Telegram] Processing error:", err);
    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong. Please try again or visit file-share.in for support.",
    );
  }

  return NextResponse.json({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escape HTML special chars for Telegram HTML parse mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
