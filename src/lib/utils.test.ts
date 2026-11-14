import { describe, it, expect } from "vitest";
import {
  sanitizeFileName,
  validateFileType,
  formatBytes,
  parseExpiry,
  generateStorageKey,
  generateShareToken,
} from "./utils";

describe("sanitizeFileName", () => {
  it("strips path separators and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFileName("report (f).pdf")).toBe("report__f_.pdf");
  });

  it("caps length at 255", () => {
    const long = "a".repeat(300) + ".txt";
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(255);
  });
});

describe("validateFileType", () => {
  it("accepts allowed types within size", () => {
    expect(validateFileType("image/png", "x.png", 1024)).toEqual({
      valid: true,
    });
  });

  it("rejects unknown MIME types", () => {
    const res = validateFileType("application/x-unknown", "x.bin", 1);
    expect(res.valid).toBe(false);
  });

  it("rejects oversized files", () => {
    const res = validateFileType("image/png", "x.png", 11 * 1024 ** 3);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/maximum size/i);
  });
});

describe("formatBytes", () => {
  it("formats zero", () => expect(formatBytes(0)).toBe("0 B"));
  it("formats KB", () => expect(formatBytes(1024)).toBe("1 KB"));
  it("formats GB", () => expect(formatBytes(5 * 1024 ** 3)).toBe("5 GB"));
});

describe("parseExpiry", () => {
  it("returns null for never", () => {
    expect(parseExpiry("never")).toBeNull();
  });

  it("adds hours", () => {
    const now = Date.now();
    const h = parseExpiry("24h")!.getTime();
    expect(h).toBeGreaterThan(now);
    expect(h - now).toBeCloseTo(24 * 3600 * 1000, -3);
  });

  it("adds days", () => {
    const now = Date.now();
    const d = parseExpiry("7d")!.getTime();
    expect(d - now).toBeCloseTo(7 * 24 * 3600 * 1000, -3);
  });
});

describe("generateStorageKey", () => {
  it("scopes under uploads/YYYY/MM with an extension", () => {
    expect(generateStorageKey("photo.png")).toMatch(
      /^uploads\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/,
    );
  });
});

describe("generateShareToken", () => {
  it("produces 8-char alphanumeric tokens", () => {
    expect(generateShareToken()).toMatch(/^[0-9a-z]{8}$/);
  });
});
