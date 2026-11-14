import { describe, it, expect } from "vitest";
import { isExecutableMagic } from "./r2";

describe("isExecutableMagic", () => {
  it("detects Windows PE (MZ)", () => {
    expect(
      isExecutableMagic(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])),
    ).toBe(true);
  });

  it("detects ELF", () => {
    expect(
      isExecutableMagic(new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02])),
    ).toBe(true);
  });

  it("detects Mach-O", () => {
    expect(
      isExecutableMagic(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe])),
    ).toBe(true);
  });

  it("returns false for innocent bytes", () => {
    expect(
      isExecutableMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), // PNG
    ).toBe(false);
    expect(isExecutableMagic(new Uint8Array([]))).toBe(false);
    expect(isExecutableMagic(new Uint8Array([0x4d]))).toBe(false); // too short
  });
});
