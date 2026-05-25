import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchArxiv, parseArxivAtom } from "../sources/arxiv.js";

const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>Test Paper One: A Novel Approach</title>
    <author><name>Jane Doe</name></author>
    <author><name>John Smith</name></author>
    <published>2023-01-15T00:00:00Z</published>
    <summary>This is a test abstract for paper one.</summary>
    <link href="http://arxiv.org/pdf/2301.00001v1" type="application/pdf"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.00002v1</id>
    <title>Test Paper Two</title>
    <author><name>Alice Johnson</name></author>
    <published>2023-02-20T00:00:00Z</published>
    <summary>This is a test abstract for paper two.</summary>
  </entry>
</feed>`;

const mockEmptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>`;

const mockSingleAuthorXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00003v1</id>
    <title>Solo Author Paper</title>
    <author><name>Single Author</name></author>
    <published>2023-03-01T00:00:00Z</published>
    <summary>Abstract text.</summary>
  </entry>
</feed>`;

describe("parseArxivAtom", () => {
  it("parses a valid Atom response into PaperResult objects", () => {
    const results = parseArxivAtom(mockXml);

    expect(results).toHaveLength(2);

    expect(results[0].title).toBe("Test Paper One: A Novel Approach");
    expect(results[0].authors).toEqual(["Jane Doe", "John Smith"]);
    expect(results[0].published).toBe("2023-01-15");
    expect(results[0].source).toBe("arXiv");
    expect(results[0].pdfUrl).toBe("http://arxiv.org/pdf/2301.00001v1");
    expect(results[0].abstract).toBe("This is a test abstract for paper one.");
    expect(results[0].arxivId).toBe("2301.00001");

    expect(results[1].title).toBe("Test Paper Two");
    expect(results[1].authors).toEqual(["Alice Johnson"]);
    expect(results[1].pdfUrl).toBeUndefined();
  });

  it("returns empty array for feeds with no entries", () => {
    const results = parseArxivAtom(mockEmptyXml);
    expect(results).toHaveLength(0);
  });

  it("handles a single author entry", () => {
    const results = parseArxivAtom(mockSingleAuthorXml);
    expect(results).toHaveLength(1);
    expect(results[0].authors).toEqual(["Single Author"]);
  });

  it("returns empty array for invalid XML", () => {
    const results = parseArxivAtom("not xml");
    expect(results).toHaveLength(0);
  });
});

describe("searchArxiv", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(mockXml),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs URL with correct parameters", async () => {
    await searchArxiv("deep learning", 5, "submittedDate");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("search_query=all%3Adeep%20learning");
    expect(url).toContain("sortBy=submittedDate");
    expect(url).toContain("sortOrder=descending");
    expect(url).toContain("max_results=5");
  });

  it("does not include date filter in query", async () => {
    await searchArxiv("test", 10, "submittedDate");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("submittedDate:");
  });

  it("uses lastUpdatedDate sort when specified", async () => {
    await searchArxiv("test", 5, "lastUpdatedDate");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sortBy=lastUpdatedDate");
  });

  it("throws with status code in error message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(""),
    });

    await expect(searchArxiv("test", 10)).rejects.toThrow("arXiv API 500: Internal Server Error");
  });

  it("sets Accept header for Atom XML", async () => {
    await searchArxiv("test", 10);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({ Accept: "application/atom+xml" });
  });
});
