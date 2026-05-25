import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchSemanticScholar, parseS2Response } from "../sources/semantic-scholar.js";

const mockResponse = {
  data: [
    {
      title: "Deep Learning for Image Recognition",
      authors: [{ name: "Alice Smith" }, { name: "Bob Jones" }],
      year: 2023,
      citationCount: 150,
      openAccessPdf: { url: "https://example.com/paper.pdf" },
      abstract: "This paper presents a novel approach to image recognition using deep learning.",
      externalIds: { ArXiv: "2301.00001" },
    },
    {
      title: "Transformer Networks in NLP",
      authors: [{ name: "Carol White" }],
      year: 2022,
      citationCount: 200,
      abstract: "A comprehensive survey of transformer architectures.",
    },
  ],
};

const mockEmptyResponse = { data: [] };
const mockNullResponse = {};

describe("parseS2Response", () => {
  it("parses a valid Semantic Scholar response", () => {
    const results = parseS2Response(mockResponse);

    expect(results).toHaveLength(2);

    expect(results[0].title).toBe("Deep Learning for Image Recognition");
    expect(results[0].authors).toEqual(["Alice Smith", "Bob Jones"]);
    expect(results[0].published).toBe("2023");
    expect(results[0].source).toBe("Semantic Scholar");
    expect(results[0].citations).toBe(150);
    expect(results[0].pdfUrl).toBe("https://example.com/paper.pdf");
    expect(results[0].abstract).toBe("This paper presents a novel approach to image recognition using deep learning.");
    expect(results[0].arxivId).toBe("2301.00001");

    expect(results[1].title).toBe("Transformer Networks in NLP");
    expect(results[1].citations).toBe(200);
    expect(results[1].pdfUrl).toBeUndefined();
    expect(results[1].arxivId).toBeUndefined();
  });

  it("returns empty array for empty data", () => {
    expect(parseS2Response(mockEmptyResponse)).toHaveLength(0);
  });

  it("returns empty array for null/invalid data", () => {
    expect(parseS2Response(mockNullResponse)).toHaveLength(0);
    expect(parseS2Response(null)).toHaveLength(0);
    expect(parseS2Response(undefined)).toHaveLength(0);
  });

  it("handles missing optional fields gracefully", () => {
    const results = parseS2Response({
      data: [{ title: "Minimal Paper", authors: [], year: null }],
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Minimal Paper");
    expect(results[0].authors).toEqual([]);
    expect(results[0].published).toBe("Unknown");
    expect(results[0].citations).toBeUndefined();
  });
});

describe("searchSemanticScholar", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs URL with query, limit, and sort params", async () => {
    await searchSemanticScholar("deep learning", 10, "latest");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("query=deep%20learning");
    expect(url).toContain("limit=10");
    expect(url).toContain("sort=publicationDate%3Adesc");
  });

  it("uses citationCount:desc sort for top_cited filter", async () => {
    await searchSemanticScholar("transformers", 5, "top_cited");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sort=citationCount%3Adesc");
  });

  it("uses citationCount:desc sort for trending filter", async () => {
    await searchSemanticScholar("transformers", 5, "trending");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sort=citationCount%3Adesc");
  });

  it("includes fields parameter", async () => {
    await searchSemanticScholar("test", 10);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("fields=title%2Cauthors%2Cyear%2CcitationCount%2CopenAccessPdf%2Cabstract%2CexternalIds");
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: () => Promise.resolve({}),
    });

    await expect(searchSemanticScholar("test", 10)).rejects.toThrow("Semantic Scholar API error");
  });

  it("sets Accept header for JSON", async () => {
    await searchSemanticScholar("test", 10);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({ Accept: "application/json" });
  });
});
