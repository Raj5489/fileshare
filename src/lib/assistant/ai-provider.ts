/**
 * AI Provider abstraction layer.
 *
 * All AI calls go through `generateAIResponse()`. Switching providers later
 * only requires adding a new implementation of `AIProvider` and updating the
 * factory — no changes to callers.
 *
 * Current default: Groq (free tier, no credit card required).
 * Configured via GROQ_API_KEY and GROQ_MODEL environment variables.
 *
 * SERVER-ONLY. Never import this in client components.
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  /** true when a quota/rate-limit error was returned by the provider */
  rateLimited: boolean;
  /** true when any error occurred and a fallback message is returned */
  error: boolean;
}

export interface AIProvider {
  generateResponse(messages: AIMessage[]): Promise<AIResponse>;
  name: string;
}

// ── Groq provider ────────────────────────────────────────────────────────────

class GroqProvider implements AIProvider {
  readonly name = "groq";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint =
    "https://api.groq.com/openai/v1/chat/completions";

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateResponse(messages: AIMessage[]): Promise<AIResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25 s hard timeout

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 512,
          temperature: 0.3, // lower temp = more factual, less hallucination
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Rate limit / quota
      if (res.status === 429) {
        console.warn("[AI] Groq rate limit hit (429)");
        return {
          content: QUOTA_MESSAGE,
          rateLimited: true,
          error: false,
        };
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[AI] Groq error ${res.status}:`, body.slice(0, 200));
        return { content: ERROR_MESSAGE, rateLimited: false, error: true };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        console.error("[AI] Groq returned empty content");
        return { content: ERROR_MESSAGE, rateLimited: false, error: true };
      }

      return { content, rateLimited: false, error: false };
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof Error && err.name === "AbortError") {
        console.error("[AI] Groq request timed out");
        return { content: TIMEOUT_MESSAGE, rateLimited: false, error: true };
      }

      console.error("[AI] Groq fetch error:", err);
      return { content: ERROR_MESSAGE, rateLimited: false, error: true };
    }
  }
}

// ── Fallback messages ────────────────────────────────────────────────────────

const QUOTA_MESSAGE =
  "I'm receiving a lot of requests right now and can't respond immediately. " +
  "Please try again in a moment, or create a support ticket and our team will help you.";

const ERROR_MESSAGE =
  "I'm having trouble connecting to my AI service right now. " +
  "Please try again in a moment, or create a support ticket if the issue persists.";

const TIMEOUT_MESSAGE =
  "My response is taking longer than expected. " +
  "Please try again, or create a support ticket if you need immediate help.";

// ── Factory ──────────────────────────────────────────────────────────────────

function createProvider(): AIProvider {
  const apiKey = process.env.GROQ_API_KEY;
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

  if (!apiKey) {
    console.warn(
      "[AI] GROQ_API_KEY is not set. AI responses will return an error message.",
    );
    // Return a no-op provider that always returns an error message.
    return {
      name: "unconfigured",
      async generateResponse(): Promise<AIResponse> {
        return {
          content:
            "The AI assistant is not configured yet. Please contact the site administrator.",
          rateLimited: false,
          error: true,
        };
      },
    };
  }

  return new GroqProvider(apiKey, model);
}

// Singleton — created once per serverless function cold start.
let _provider: AIProvider | null = null;

function getProvider(): AIProvider {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate an AI response given an array of messages.
 *
 * Always returns an AIResponse — never throws.
 * Callers check `.error` and `.rateLimited` to decide how to present the result.
 */
export async function generateAIResponse(
  messages: AIMessage[],
): Promise<AIResponse> {
  return getProvider().generateResponse(messages);
}

/**
 * Returns the name of the currently configured AI provider and model.
 * Safe to expose in admin settings UI.
 */
export function getProviderInfo(): { provider: string; model: string; configured: boolean } {
  const configured = Boolean(process.env.GROQ_API_KEY);
  return {
    provider: "groq",
    model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
    configured,
  };
}
