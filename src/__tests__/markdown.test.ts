import { describe, it, expect } from "vitest";
import { formatResults } from "../formatters/markdown.js";
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

describe("formatResults", () => {
  it("returns empty message when no results", () => {
    const output = formatResults("computer vision", "latest", []);

    expect(output).toContain("No research papers found");
    expect(output).toContain("computer vision");
    expect(output).toContain("latest");
  });

  it("includes date range in empty message when provided", () => {
    const output = formatResults("computer vision", "latest", [], "week");

    expect(output).toContain("from the past week");
  });

  it("includes query and filter in header", () => {
    const results = [makePaper({ title: "A Great Paper" })];
    const output = formatResults("machine learning", "trending", results);

    expect(output).toContain("## Research Papers: machine learning");
    expect(output).toContain("**Filter:** trending");
    expect(output).toContain("**Results:** 1");
  });

  it("shows date range in header when provided", () => {
    const results = [makePaper({ title: "A Great Paper" })];
    const output = formatResults("ml", "latest", results, "month");

    expect(output).toContain("**Range:** past month");
  });

  it("shows matched evidence when present", () => {
    const results = [makePaper({ title: "GAN Paper", matchedIn: "title, abstract (gan, adversarial)" })];
    const output = formatResults("gan", "latest", results);

    expect(output).toContain("- **Matched:** title, abstract (gan, adversarial)");
  });

  it("omits matched line when not present", () => {
    const results = [makePaper({ title: "GAN Paper" })];
    const output = formatResults("gan", "latest", results);

    expect(output).not.toContain("Matched:");
  });

  it("shows sourced via in header when provided", () => {
    const results = [makePaper({ title: "A Paper" })];
    const output = formatResults("ml", "latest", results, undefined, "arXiv + OpenAlex");

    expect(output).toContain("**via:** arXiv + OpenAlex");
  });

  it("formats a single paper with all fields", () => {
    const results = [
      makePaper({
        title: "Deep Learning Advances",
        authors: ["Jane Doe", "John Smith"],
        published: "2024-06-15",
        source: "arXiv",
        pdfUrl: "https://arxiv.org/pdf/2406.00001",
        arxivId: "2406.00001",
        abstract: "A comprehensive study of recent advances.",
        citations: 42,
        codeUrl: "https://github.com/example/repo",
      }),
    ];
    const output = formatResults("deep learning", "latest", results);

    expect(output).toContain("### 1. Deep Learning Advances");
    expect(output).toContain("- **Authors:** Jane Doe, John Smith");
    expect(output).toContain("- **Published:** 2024-06-15");
    expect(output).toContain("- **Source:** arXiv");
    expect(output).toContain("- **Citations:** 42");
    expect(output).toContain("- **arXiv ID:** 2406.00001");
    expect(output).toContain("- **arXiv:** https://arxiv.org/abs/2406.00001");
    expect(output).toContain("- **PDF:** https://arxiv.org/pdf/2406.00001");
    expect(output).toContain("- **Code:** https://github.com/example/repo");
    expect(output).toContain("- **Abstract:** A comprehensive study of recent advances.");
  });

  it("truncates abstracts longer than 300 characters", () => {
    const longAbstract = "A".repeat(400);
    const results = [makePaper({ abstract: longAbstract })];
    const output = formatResults("test", "latest", results);

    expect(output).toContain("A".repeat(300) + "...");
    expect(output).not.toContain("A".repeat(301));
  });

  it("truncates authors list to 3 with et al", () => {
    const results = [
      makePaper({
        authors: ["Author A", "Author B", "Author C", "Author D"],
      }),
    ];
    const output = formatResults("test", "latest", results);

    expect(output).toContain("- **Authors:** Author A, Author B, Author C, et al.");
    expect(output).not.toContain("Author D");
  });

  it("shows N/A for empty authors", () => {
    const results = [makePaper({ authors: [] })];
    const output = formatResults("test", "latest", results);

    expect(output).toContain("- **Authors:** N/A");
  });

  it("renders PubMed-specific fields", () => {
    const results = [
      makePaper({
        source: "PubMed",
        pmid: "42473636",
        doi: "10.1016/j.idm.2026.05.010",
        journal: "Infectious Disease Modelling",
      }),
    ];
    const output = formatResults("epidemiology", "latest", results);

    expect(output).toContain("- **Source:** PubMed");
    expect(output).toContain("- **Journal:** Infectious Disease Modelling");
    expect(output).toContain("- **PMID:** 42473636");
    expect(output).toContain("- **PubMed:** https://pubmed.ncbi.nlm.nih.gov/42473636/");
    expect(output).toContain("- **DOI:** https://doi.org/10.1016/j.idm.2026.05.010");
  });

  it("renders bioRxiv source label", () => {
    const results = [makePaper({ source: "bioRxiv", doi: "10.1101/2024.01.01.000001" })];
    const output = formatResults("test", "latest", results);

    expect(output).toContain("- **Source:** bioRxiv");
    expect(output).toContain("- **DOI:** https://doi.org/10.1101/2024.01.01.000001");
  });

  it("omits PMID, DOI, and Journal lines when not present", () => {
    const results = [makePaper({ title: "Minimal" })];
    const output = formatResults("test", "latest", results);

    expect(output).not.toContain("PMID");
    expect(output).not.toContain("DOI");
    expect(output).not.toContain("Journal");
  });

  it("numbers multiple papers sequentially", () => {
    const results = [
      makePaper({ title: "Paper A", authors: ["A"] }),
      makePaper({ title: "Paper B", authors: ["B"] }),
      makePaper({ title: "Paper C", authors: ["C"] }),
    ];
    const output = formatResults("test", "latest", results);

    expect(output).toContain("### 1. Paper A");
    expect(output).toContain("### 2. Paper B");
    expect(output).toContain("### 3. Paper C");
    expect(output).toContain("**Results:** 3");
  });

  it("omits optional fields when not present", () => {
    const results = [
      makePaper({
        title: "Minimal Paper",
        authors: ["Solo"],
        citations: undefined,
        pdfUrl: undefined,
        arxivId: undefined,
        abstract: undefined,
        codeUrl: undefined,
      }),
    ];
    const output = formatResults("test", "latest", results);

    expect(output).not.toContain("Citations");
    expect(output).not.toContain("PDF");
    expect(output).not.toContain("arXiv ID");
    expect(output).not.toContain("Abstract");
    expect(output).not.toContain("Code");
  });
});
