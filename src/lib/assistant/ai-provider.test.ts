/**
 * Tests for the AI provider abstraction.
 * Mocks the fetch API — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Reset module registry between tests so env-var-driven singleton
// re-evaluates cleanly.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateAIResponse", () => {
  it("returns content on a successful Groq response", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "llama-3.3-70b-versatile");

    const mockResponse = {
      choices: [{ message: { content: "Here is the answer." } }],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "How do I upload?" },
    ]);

    expect(result.content).toBe("Here is the answer.");
    expect(result.error).toBe(false);
    expect(result.rateLimited).toBe(false);
  });

  it("returns rateLimited:true on HTTP 429", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limit exceeded",
    } as unknown as Response);

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.rateLimited).toBe(true);
    expect(result.error).toBe(false);
    expect(result.content).toMatch(
      /receiving a lot of requests|try again in a moment/i,
    );
  });

  it("returns error:true on HTTP 500", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "internal error",
    } as unknown as Response);

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.error).toBe(true);
    expect(result.content).toMatch(/trouble connecting|try again/i);
  });

  it("returns error:true when fetch throws (network error)", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network failure"));

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.error).toBe(true);
  });

  it("returns a configured:false message when GROQ_API_KEY is absent", async () => {
    vi.stubEnv("GROQ_API_KEY", "");

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.error).toBe(true);
    expect(result.content).toMatch(/not configured/i);
  });

  it("returns error:true on timeout (AbortError)", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";

    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.error).toBe(true);
    expect(result.content).toMatch(/longer than expected|timeout|try again/i);
  });

  it("handles empty choices array gracefully", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    } as unknown as Response);

    const { generateAIResponse } = await import("./ai-provider");
    const result = await generateAIResponse([
      { role: "user", content: "test" },
    ]);

    expect(result.error).toBe(true);
  });
});

describe("getProviderInfo", () => {
  it("returns provider name, model, and configured status", async () => {
    vi.stubEnv("GROQ_API_KEY", "some-key");
    vi.stubEnv("GROQ_MODEL", "llama-3.3-70b-versatile");

    const { getProviderInfo } = await import("./ai-provider");
    const info = getProviderInfo();

    expect(info.provider).toBe("groq");
    expect(info.model).toBe("llama-3.3-70b-versatile");
    expect(info.configured).toBe(true);
  });

  it("reports configured:false when key is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");

    const { getProviderInfo } = await import("./ai-provider");
    const info = getProviderInfo();

    expect(info.configured).toBe(false);
  });
});
