import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchOpenAlex, parseOAResponse } from "../sources/openalex.js";

const mockResponse = {
  results: [
    {
      title: "Deep Learning for Image Recognition",
      authorships: [
        { author: { display_name: "Alice Smith" } },
        { author: { display_name: "Bob Jones" } },
      ],
      publication_date: "2023-06-15",
      cited_by_count: 150,
      open_access: { oa_url: "https://example.com/paper.pdf" },
      abstract_inverted_index: {
        This: [0], is: [1], an: [2], abstract: [3],
      },
    },
    {
      title: "Transformer Networks in NLP",
      authorships: [{ author: { display_name: "Carol White" } }],
      publication_date: "2022-03-01",
      cited_by_count: 200,
      abstract_inverted_index: null,
    },
  ],
};

describe("parseOAResponse", () => {
  it("parses a valid OpenAlex response", () => {
    const results = parseOAResponse(mockResponse);

    expect(results).toHaveLength(2);

    expect(results[0].title).toBe("Deep Learning for Image Recognition");
    expect(results[0].authors).toEqual(["Alice Smith", "Bob Jones"]);
    expect(results[0].published).toBe("2023-06-15");
    expect(results[0].source).toBe("OpenAlex");
    expect(results[0].citations).toBe(150);
    expect(results[0].pdfUrl).toBe("https://example.com/paper.pdf");
    expect(results[0].abstract).toBe("This is an abstract");

    expect(results[1].title).toBe("Transformer Networks in NLP");
    expect(results[1].citations).toBe(200);
    expect(results[1].abstract).toBeUndefined();
  });

  it("reconstructs abstract from inverted index", () => {
    const results = parseOAResponse({
      results: [{
        title: "Test",
        authorships: [],
        publication_date: "2023-01-01",
        abstract_inverted_index: { Hello: [0], world: [1] },
      }],
    });

    expect(results[0].abstract).toBe("Hello world");
  });

  it("handles empty inverted index", () => {
    const results = parseOAResponse({
      results: [{
        title: "Test",
        authorships: [],
        publication_date: "2023-01-01",
        abstract_inverted_index: {},
      }],
    });

    expect(results[0].abstract).toBeUndefined();
  });

  it("returns empty array for empty results", () => {
    expect(parseOAResponse({ results: [] })).toHaveLength(0);
  });

  it("returns empty array for invalid data", () => {
    expect(parseOAResponse(null)).toHaveLength(0);
    expect(parseOAResponse(undefined)).toHaveLength(0);
    expect(parseOAResponse({})).toHaveLength(0);
  });
});

describe("searchOpenAlex", () => {
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

  it("constructs URL with search and sort params", async () => {
    await searchOpenAlex("deep learning", 10, "latest");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("search=deep%20learning");
    expect(url).toContain("per_page=10");
    expect(url).toContain("sort=publication_date%3Adesc");
  });

  it("expands acronyms in the search query", async () => {
    await searchOpenAlex("MTP in LLMs", 10, "latest");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("search=multi-token%20prediction%20large%20language%20models");
  });

  it("uses cited_by_count:desc sort for top_cited", async () => {
    await searchOpenAlex("test", 5, "top_cited");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sort=cited_by_count%3Adesc");
  });

  it("uses cited_by_count:desc sort for trending", async () => {
    await searchOpenAlex("test", 5, "trending");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sort=cited_by_count%3Adesc");
  });

  it("includes year filter when provided", async () => {
    await searchOpenAlex("test", 10, "latest", "2025-2026");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("filter=publication_year:2025-2026");
  });

  it("throws with status code on error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({}),
    });

    await expect(searchOpenAlex("test", 10)).rejects.toThrow("OpenAlex API 500");
  });
});
