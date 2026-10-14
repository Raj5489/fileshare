import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

function makeLimiter(
  prefix: string,
  requests: number,
  window: string
) {
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
          err instanceof Error ? err.message : err
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

export const guestUploadLimit = makeLimiter("guest_upload", 50, "1 h");
export const authUploadLimit = makeLimiter("auth_upload", 50, "1 h");
export const downloadLimit = makeLimiter("download", 100, "1 h");
export const apiLimit = makeLimiter("api", 200, "1 m");
export const passwordAttemptLimit = makeLimiter("password_attempt", 5, "15 m");
