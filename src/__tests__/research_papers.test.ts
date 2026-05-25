import { describe, it, expect } from "vitest";
import { mergeAndDeduplicate, normalizeTitle } from "../tools/research_papers.js";
import type { PaperResult } from "../types.js";

function makePaper(overrides: Partial<PaperResult> = {}): PaperResult {
  return {
    title: "Test Paper",
    authors: ["Author One"],
    published: "2023-01-01",
    source: "arXiv",
    ...overrides,
  };
}

describe("normalizeTitle", () => {
  it("lowercases the title", () => {
    expect(normalizeTitle("Deep Learning")).toBe("deeplearning");
  });

  it("removes punctuation and special characters", () => {
    expect(normalizeTitle("Hello, World!")).toBe("helloworld");
  });

  it("removes whitespace", () => {
    expect(normalizeTitle("  Multiple   Spaces  ")).toBe("multiplespaces");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(normalizeTitle("GPT-4 Paper")).toBe("gpt4paper");
  });
});

describe("mergeAndDeduplicate", () => {
  it("merges two arrays and deduplicates by title", () => {
    const arxiv: PaperResult[] = [
      makePaper({ title: "Paper A", source: "arXiv" }),
      makePaper({ title: "Paper B", source: "arXiv" }),
    ];
    const s2: PaperResult[] = [
      makePaper({ title: "Paper B", source: "Semantic Scholar" }),
      makePaper({ title: "Paper C", source: "Semantic Scholar" }),
    ];

    const merged = mergeAndDeduplicate(arxiv, s2, "latest");

    expect(merged).toHaveLength(3);
    expect(merged[0].title).toBe("Paper A");
    expect(merged[1].title).toBe("Paper B");
    expect(merged[2].title).toBe("Paper C");
  });

  it("deduplicates case-insensitively", () => {
    const arxiv: PaperResult[] = [
      makePaper({ title: "Deep Learning Paper", source: "arXiv", published: "2023" }),
    ];
    const s2: PaperResult[] = [
      makePaper({ title: "deep learning paper", source: "Semantic Scholar", published: "2023" }),
    ];

    const merged = mergeAndDeduplicate(arxiv, s2, "latest");

    expect(merged).toHaveLength(1);
  });

  it("keeps first occurrence on dedup (arXiv first for 'latest')", () => {
    const arxiv: PaperResult[] = [
      makePaper({ title: "Same Title", source: "arXiv", published: "2023-01-01" }),
    ];
    const s2: PaperResult[] = [
      makePaper({ title: "Same Title", source: "Semantic Scholar", published: "2024-01-01" }),
    ];

    const merged = mergeAndDeduplicate(arxiv, s2, "latest");

    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("arXiv");
  });

  it("puts S2 first for trending/top_cited filters", () => {
    const arxiv: PaperResult[] = [
      makePaper({ title: "Paper X", source: "arXiv" }),
    ];
    const s2: PaperResult[] = [
      makePaper({ title: "Paper Y", source: "Semantic Scholar" }),
    ];

    const trending = mergeAndDeduplicate(arxiv, s2, "trending");
    expect(trending[0].source).toBe("Semantic Scholar");

    const topCited = mergeAndDeduplicate(arxiv, s2, "top_cited");
    expect(topCited[0].source).toBe("Semantic Scholar");

    const latest = mergeAndDeduplicate(arxiv, s2, "latest");
    expect(latest[0].source).toBe("arXiv");
  });

  it("handles empty arrays", () => {
    expect(mergeAndDeduplicate([], [], "latest")).toHaveLength(0);

    const onlyArxiv = [makePaper({ title: "Only Paper" })];
    expect(mergeAndDeduplicate(onlyArxiv, [], "latest")).toHaveLength(1);
  });

  it("deduplicates with punctuation differences", () => {
    const arxiv: PaperResult[] = [
      makePaper({ title: "Deep Learning: A Survey", source: "arXiv" }),
    ];
    const s2: PaperResult[] = [
      makePaper({ title: "Deep Learning A Survey", source: "Semantic Scholar" }),
    ];

    const merged = mergeAndDeduplicate(arxiv, s2, "latest");

    expect(merged).toHaveLength(1);
  });
});
