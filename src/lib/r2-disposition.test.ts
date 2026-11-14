import { describe, it, expect } from "vitest";
import { buildContentDisposition } from "./r2";

describe("buildContentDisposition", () => {
  it("defaults to attachment (downloads)", () => {
    expect(buildContentDisposition("report.pdf")).toMatch(/^attachment; filename="/);
  });

  it("supports inline for previews", () => {
    expect(buildContentDisposition("photo.png", "inline")).toMatch(/^inline; filename="/);
  });

  it("escapes double quotes in filenames", () => {
    expect(buildContentDisposition(`a"b.txt`)).toContain('filename="a\\"b.txt"');
  });

  it("includes UTF-8 filename fallback", () => {
    const cd = buildContentDisposition("café.jpg", "inline");
    expect(cd).toContain("filename*=UTF-8''caf%C3%A9.jpg");
  });

  it("is a well-formed header with both fallbacks", () => {
    const cd = buildContentDisposition("my photo.png", "inline");
    expect(cd).toMatch(
      /^inline; filename="my photo.png"; filename\*=UTF-8''my%20photo\.png$/,
    );
  });
});
