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

function routing(arxivFirst: boolean) {
  return { useArxiv: true, useOpenAlex: true, arxivFirst };
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
  const arxiv: PaperResult[] = [
    makePaper({ title: "Paper A", source: "arXiv" }),
    makePaper({ title: "Paper B", source: "arXiv" }),
  ];
  const oa: PaperResult[] = [
    makePaper({ title: "Paper B", source: "OpenAlex" }),
    makePaper({ title: "Paper C", source: "OpenAlex" }),
  ];

  it("puts arXiv first when arxivFirst is true", () => {
    const merged = mergeAndDeduplicate(arxiv, oa, routing(true));

    expect(merged).toHaveLength(3);
    expect(merged[0].source).toBe("arXiv");
    expect(merged[1].source).toBe("arXiv");
    expect(merged[2].source).toBe("OpenAlex");
  });

  it("puts OpenAlex first when arxivFirst is false", () => {
    const merged = mergeAndDeduplicate(arxiv, oa, routing(false));

    expect(merged).toHaveLength(3);
    expect(merged[0].source).toBe("OpenAlex");
    expect(merged[1].source).toBe("OpenAlex");
    expect(merged[2].source).toBe("arXiv");
  });

  it("deduplicates case-insensitively", () => {
    const a: PaperResult[] = [makePaper({ title: "Deep Learning Paper", source: "arXiv" })];
    const o: PaperResult[] = [makePaper({ title: "deep learning paper", source: "OpenAlex" })];

    const merged = mergeAndDeduplicate(a, o, routing(true));
    expect(merged).toHaveLength(1);
  });

  it("deduplicates with punctuation differences", () => {
    const a: PaperResult[] = [makePaper({ title: "Deep Learning: A Survey", source: "arXiv" })];
    const o: PaperResult[] = [makePaper({ title: "Deep Learning A Survey", source: "OpenAlex" })];

    const merged = mergeAndDeduplicate(a, o, routing(true));
    expect(merged).toHaveLength(1);
  });

  it("handles empty arrays", () => {
    expect(mergeAndDeduplicate([], [], routing(true))).toHaveLength(0);

    const onlyArxiv = [makePaper({ title: "Only Paper" })];
    expect(mergeAndDeduplicate(onlyArxiv, [], routing(true))).toHaveLength(1);
  });

  it("keeps first occurrence when deduplicating", () => {
    const a: PaperResult[] = [makePaper({ title: "Same Title", source: "arXiv", published: "2023" })];
    const o: PaperResult[] = [makePaper({ title: "Same Title", source: "OpenAlex", published: "2024" })];

    const merged = mergeAndDeduplicate(a, o, routing(true));
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("arXiv");
  });
});
