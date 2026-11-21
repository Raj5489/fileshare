import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

function makeLimiter(prefix: string, requests: number, window: string) {
  if (!redis) {
    return {
      limit: async () => ({
        success: true,
        limit: requests,
        remaining: requests,
        reset: 0,
      }),
    };
  }
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as `${number} s`),
    prefix: `ratelimit:${prefix}`,
  });

  return {
    limit: async (identifier: string) => {
      try {
        return await ratelimit.limit(identifier);
      } catch (err) {
        console.warn(
          `[RateLimit] Redis error for "${prefix}", failing open:`,
          err instanceof Error ? err.message : err,
        );
        return {
          success: true,
          limit: requests,
          remaining: requests,
          reset: 0,
        };
      }
    },
  };
}

// Upload limits: count per-user DAILY quotas instead of per-file requests so
// batch uploads of many files don't exhaust the budget and fail mid-way.
export const guestUploadLimit = makeLimiter("guest_upload", 200, "24 h");
export const authUploadLimit = makeLimiter("auth_upload", 1000, "24 h");
export const downloadLimit = makeLimiter("download", 500, "1 h");
export const apiLimit = makeLimiter("api", 600, "1 m");
export const passwordAttemptLimit = makeLimiter("password_attempt", 5, "15 m");

// ── AI Assistant limits ──────────────────────────────────────────────────────
// Intentionally conservative to stay within Groq free tier.
// 10 chat messages per minute per IP — prevents spam/abuse.
export const chatLimit = makeLimiter("chat", 10, "1 m");
// 3 ticket submissions per hour per IP — prevents ticket spam.
export const ticketLimit = makeLimiter("ticket", 3, "1 h");

// ── Guest storage quota (Redis/IP-based) ────────────────────────────────

const GUEST_STORAGE_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB / IP / day
const GUEST_BYTES_PREFIX = "ratelimit:guest_bytes";

/**
 * Tracks how many bytes a guest IP has uploaded today and rejects uploads that
 * would exceed the daily quota. Fails open when Redis is unavailable.
 */
export async function checkGuestStorageQuota(
  bytes: number,
  ip: string,
): Promise<{ success: boolean }> {
  if (!redis) return { success: true };
  const day = new Date().toISOString().slice(0, 10);
  const key = `${GUEST_BYTES_PREFIX}:${day}:${ip}`;
  try {
    const used = await redis.get<number>(key);
    const current = typeof used === "number" ? used : 0;
    if (current + bytes > GUEST_STORAGE_QUOTA) {
      return { success: false };
    }
    const firstWrite = current === 0;
    await redis.incrby(key, Math.round(bytes));
    if (firstWrite) {
      // Let the key expire well past the day window (48h).
      await redis.expire(key, 60 * 60 * 48);
    }
    return { success: true };
  } catch {
    return { success: true };
  }
}
