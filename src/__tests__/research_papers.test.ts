import { describe, it, expect } from "vitest";
import { deduplicateOrdered, normalizeTitle } from "../tools/research_papers.js";
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

describe("deduplicateOrdered", () => {
  const arxiv: PaperResult[] = [
    makePaper({ title: "Paper A", source: "arXiv" }),
    makePaper({ title: "Paper B", source: "arXiv" }),
  ];
  const oa: PaperResult[] = [
    makePaper({ title: "Paper B", source: "OpenAlex" }),
    makePaper({ title: "Paper C", source: "OpenAlex" }),
  ];

  it("keeps group order (arxiv first)", () => {
    const merged = deduplicateOrdered([arxiv, oa]);

    expect(merged).toHaveLength(3);
    expect(merged[0].source).toBe("arXiv");
    expect(merged[1].source).toBe("arXiv");
    expect(merged[2].source).toBe("OpenAlex");
  });

  it("keeps group order (openalex first)", () => {
    const merged = deduplicateOrdered([oa, arxiv]);

    expect(merged).toHaveLength(3);
    expect(merged[0].source).toBe("OpenAlex");
    expect(merged[1].source).toBe("OpenAlex");
    expect(merged[2].source).toBe("arXiv");
  });

  it("deduplicates case-insensitively", () => {
    const a: PaperResult[] = [makePaper({ title: "Deep Learning Paper", source: "arXiv" })];
    const o: PaperResult[] = [makePaper({ title: "deep learning paper", source: "OpenAlex" })];

    const merged = deduplicateOrdered([a, o]);
    expect(merged).toHaveLength(1);
  });

  it("deduplicates with punctuation differences", () => {
    const a: PaperResult[] = [makePaper({ title: "Deep Learning: A Survey", source: "arXiv" })];
    const o: PaperResult[] = [makePaper({ title: "Deep Learning A Survey", source: "OpenAlex" })];

    const merged = deduplicateOrdered([a, o]);
    expect(merged).toHaveLength(1);
  });

  it("deduplicates by DOI across sources", () => {
    const a: PaperResult[] = [makePaper({ title: "Molecular Paper", source: "PubMed", doi: "10.1101/2024.01.01.000001" })];
    const o: PaperResult[] = [makePaper({ title: "A Completely Different Title", source: "OpenAlex", doi: "https://doi.org/10.1101/2024.01.01.000001" })];

    const merged = deduplicateOrdered([a, o]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("PubMed");
  });

  it("does not deduplicate papers with different DOIs but identical titles", () => {
    const a: PaperResult[] = [makePaper({ title: "Same Title", doi: "10.1/aaa" })];
    const o: PaperResult[] = [makePaper({ title: "Same Title", doi: "10.1/bbb" })];

    const merged = deduplicateOrdered([a, o]);
    expect(merged).toHaveLength(2);
  });

  it("falls back to title matching when either paper lacks a DOI", () => {
    const a: PaperResult[] = [makePaper({ title: "Same Title", source: "arXiv", published: "2023" })];
    const o: PaperResult[] = [makePaper({ title: "Same Title", source: "OpenAlex", published: "2024" })];

    const merged = deduplicateOrdered([a, o]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("arXiv");
  });

  it("handles empty arrays", () => {
    expect(deduplicateOrdered([[], []])).toHaveLength(0);

    const onlyArxiv = [makePaper({ title: "Only Paper" })];
    expect(deduplicateOrdered([onlyArxiv, []])).toHaveLength(1);
  });

  it("merges four sources in priority order", () => {
    const merged = deduplicateOrdered([
      [makePaper({ title: "A", source: "arXiv" })],
      [makePaper({ title: "B", source: "OpenAlex" })],
      [makePaper({ title: "C", source: "bioRxiv" })],
      [makePaper({ title: "D", source: "PubMed" })],
    ]);

    expect(merged).toHaveLength(4);
    expect(merged.map((p) => p.source)).toEqual(["arXiv", "OpenAlex", "bioRxiv", "PubMed"]);
  });
});