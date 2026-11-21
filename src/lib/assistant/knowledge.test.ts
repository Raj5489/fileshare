/**
 * Tests for knowledge-base retrieval helpers.
 * Uses module mocking to avoid real Supabase calls.
 */

import { describe, it, expect } from "vitest";
import { formatKnowledgeContext, type KnowledgeEntry } from "./knowledge";

// ── formatKnowledgeContext ────────────────────────────────────────────────────

describe("formatKnowledgeContext", () => {
  it("returns empty string for no entries", () => {
    expect(formatKnowledgeContext([])).toBe("");
  });

  it("includes each entry title and content", () => {
    const entries: KnowledgeEntry[] = [
      {
        id: "1",
        category: "uploading",
        title: "How to upload",
        content: "Drag and drop your file.",
        keywords: ["upload"],
      },
      {
        id: "2",
        category: "general",
        title: "What is FileShare",
        content: "A free file sharing service.",
        keywords: ["about"],
      },
    ];

    const result = formatKnowledgeContext(entries);

    expect(result).toContain("KNOWLEDGE BASE");
    expect(result).toContain("How to upload");
    expect(result).toContain("Drag and drop your file.");
    expect(result).toContain("What is FileShare");
    expect(result).toContain("A free file sharing service.");
  });

  it("includes category label for each entry", () => {
    const entries: KnowledgeEntry[] = [
      {
        id: "1",
        category: "troubleshooting",
        title: "Upload stuck",
        content: "Try refreshing.",
        keywords: [],
      },
    ];
    const result = formatKnowledgeContext(entries);
    expect(result).toContain("[troubleshooting]");
  });

  it("handles entries with empty content gracefully", () => {
    const entries: KnowledgeEntry[] = [
      {
        id: "1",
        category: "general",
        title: "Empty entry",
        content: "",
        keywords: [],
      },
    ];
    expect(() => formatKnowledgeContext(entries)).not.toThrow();
  });
});
