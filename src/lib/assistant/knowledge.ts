/**
 * Knowledge-base retrieval layer.
 *
 * Retrieves relevant entries from assistant_knowledge before each AI call.
 * Uses keyword overlap and PostgreSQL full-text search — no paid vector DB.
 * The retrieval layer is designed to be replaced with embeddings/RAG later
 * without changing the calling code in support.ts.
 *
 * SERVER-ONLY.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
}

// Maximum number of KB entries injected into a single prompt.
// Keeps token usage predictable on free-tier limits.
const MAX_ENTRIES = 4;

/**
 * Retrieve the most relevant knowledge-base entries for a user question.
 *
 * Strategy (in order of precedence):
 * 1. Full-text search using PostgreSQL tsvector on title + content.
 * 2. Keyword array overlap (any keyword substring-matches the question).
 * 3. Deduplicate by id and return up to MAX_ENTRIES results.
 *
 * Returns an empty array on any error — the AI will still respond, just
 * without KB context (it will acknowledge the limitation).
 */
export async function retrieveKnowledge(
  userMessage: string,
): Promise<KnowledgeEntry[]> {
  try {
    const admin = getSupabaseAdmin();
    const normalised = userMessage.toLowerCase().trim().slice(0, 300);

    // ── Full-text search ──────────────────────────────────────
    // Build a tsquery from significant words (skip short words).
    const words = normalised
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 10);

    let ftsResults: KnowledgeEntry[] = [];

    if (words.length > 0) {
      const tsquery = words.join(" | "); // OR query — broad match

      const { data: ftsData, error: ftsError } = await admin
        .from("assistant_knowledge")
        .select("id, category, title, content, keywords")
        .eq("is_active", true)
        .textSearch("title", tsquery, {
          type: "plain",
          config: "english",
        })
        .limit(MAX_ENTRIES);

      if (!ftsError && ftsData) {
        ftsResults = ftsData as KnowledgeEntry[];
      }

      // If title search is empty, try content column
      if (ftsResults.length === 0) {
        const { data: contentData } = await admin
          .from("assistant_knowledge")
          .select("id, category, title, content, keywords")
          .eq("is_active", true)
          .textSearch("content", tsquery, {
            type: "plain",
            config: "english",
          })
          .limit(MAX_ENTRIES);

        if (contentData) {
          ftsResults = contentData as KnowledgeEntry[];
        }
      }
    }

    // ── Keyword overlap ──────────────────────────────────────
    // Pull all active entries and score them by how many keyword phrases
    // appear as substrings of the user message. Cheap — KB is small.
    const { data: allEntries, error: allError } = await admin
      .from("assistant_knowledge")
      .select("id, category, title, content, keywords")
      .eq("is_active", true);

    let keywordResults: KnowledgeEntry[] = [];

    if (!allError && allEntries) {
      const scored = (allEntries as KnowledgeEntry[])
        .map((entry) => {
          const score = entry.keywords.reduce((s, kw) => {
            return s + (normalised.includes(kw.toLowerCase()) ? 1 : 0);
          }, 0);
          return { entry, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.entry)
        .slice(0, MAX_ENTRIES);

      keywordResults = scored;
    }

    // ── Merge and deduplicate ────────────────────────────────
    const seen = new Set<string>();
    const merged: KnowledgeEntry[] = [];

    for (const entry of [...ftsResults, ...keywordResults]) {
      if (!seen.has(entry.id) && merged.length < MAX_ENTRIES) {
        seen.add(entry.id);
        merged.push(entry);
      }
    }

    return merged;
  } catch (err) {
    console.error("[Knowledge] Retrieval error:", err);
    return [];
  }
}

/**
 * Format retrieved knowledge entries into a compact context block
 * suitable for injection into the system prompt.
 */
export function formatKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return "";

  const lines = entries.map(
    (e) => `### ${e.title} [${e.category}]\n${e.content}`,
  );

  return (
    "KNOWLEDGE BASE (use these facts to answer; do not invent information beyond this):\n\n" +
    lines.join("\n\n")
  );
}

/**
 * Returns ALL active knowledge entries for a given category.
 * Used by the admin dashboard and for seeding suggested questions.
 */
export async function getKnowledgeByCategory(
  category: string,
): Promise<KnowledgeEntry[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("assistant_knowledge")
      .select("id, category, title, content, keywords")
      .eq("is_active", true)
      .eq("category", category)
      .order("title");

    if (error || !data) return [];
    return data as KnowledgeEntry[];
  } catch {
    return [];
  }
}
