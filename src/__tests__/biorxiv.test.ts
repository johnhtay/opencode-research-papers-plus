import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchBiorxiv, rebrand } from "../sources/biorxiv.js";
import type { PaperResult } from "../types.js";

function makePaper(overrides: Partial<PaperResult> = {}): PaperResult {
  return {
    title: "Test Paper",
    authors: ["Author One"],
    published: "2023-01-01",
    source: "OpenAlex",
    ...overrides,
  };
}

describe("rebrand", () => {
  it("labels bioRxiv papers by journal name", () => {
    const result = rebrand(makePaper({ journal: "bioRxiv (Cold Spring Harbor Laboratory)", doi: "10.1101/2024.01.01.000001" }));
    expect(result.source).toBe("bioRxiv");
  });

  it("labels medRxiv papers by journal name", () => {
    const result = rebrand(makePaper({ journal: "medRxiv", doi: "10.1101/2024.01.01.000002" }));
    expect(result.source).toBe("medRxiv");
  });

  it("detects medRxiv from PDF URL when journal missing", () => {
    const result = rebrand(makePaper({ pdfUrl: "https://www.medrxiv.org/content/10.1101/x.full.pdf" }));
    expect(result.source).toBe("medRxiv");
  });

  it("defaults to bioRxiv when no medRxiv signal", () => {
    const result = rebrand(makePaper({}));
    expect(result.source).toBe("bioRxiv");
  });

  it("constructs a PDF URL from DOI when none present", () => {
    const result = rebrand(makePaper({ journal: "bioRxiv", doi: "10.1101/2024.01.01.000001", pdfUrl: undefined }));
    expect(result.pdfUrl).toBe("https://www.biorxiv.org/content/10.1101/2024.01.01.000001v1.full.pdf");
  });

  it("constructs a medRxiv PDF URL", () => {
    const result = rebrand(makePaper({ journal: "medRxiv", doi: "10.1101/2024.01.01.000002", pdfUrl: undefined }));
    expect(result.pdfUrl).toBe("https://www.medrxiv.org/content/10.1101/2024.01.01.000002v1.full.pdf");
  });

  it("preserves existing pdfUrl", () => {
    const existing = "https://example.com/paper.pdf";
    const result = rebrand(makePaper({ journal: "bioRxiv", doi: "10.1101/2024.01.01.000001", pdfUrl: existing }));
    expect(result.pdfUrl).toBe(existing);
  });
});

describe("searchBiorxiv", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          results: [
            {
              title: "A bioRxiv Preprint",
              authorships: [{ author: { display_name: "Jane Doe" } }],
              publication_date: "2024-06-15",
              cited_by_count: 12,
              doi: "https://doi.org/10.1101/2024.06.01.000001",
              primary_location: { source: { display_name: "bioRxiv (Cold Spring Harbor Laboratory)" } },
              open_access: { oa_url: "https://www.biorxiv.org/content/10.1101/2024.06.01.000001v1.full.pdf" },
              abstract_inverted_index: { Hello: [0], world: [1] },
            },
            {
              title: "A medRxiv Preprint",
              authorships: [{ author: { display_name: "John Smith" } }],
              publication_date: "2024-06-16",
              cited_by_count: 5,
              doi: "https://doi.org/10.1101/2024.06.02.000002",
              primary_location: { source: { display_name: "medRxiv" } },
              open_access: { oa_url: "https://www.medrxiv.org/content/10.1101/2024.06.02.000002v1.full.pdf" },
              abstract_inverted_index: null,
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters OpenAlex to bioRxiv and medRxiv sources", async () => {
    await searchBiorxiv("phylogenomics", 10, "latest");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(
      `filter=${encodeURIComponent("primary_location.source.id:S4306402567|S3005729997")}`
    );
  });

  it("passes sort through for top_cited", async () => {
    await searchBiorxiv("test", 5, "top_cited");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("sort=cited_by_count%3Adesc");
  });

  it("rebrands results and preserves metadata", async () => {
    const results = await searchBiorxiv("test", 5, "latest");

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe("bioRxiv");
    expect(results[0].doi).toBe("10.1101/2024.06.01.000001");
    expect(results[0].citations).toBe(12);
    expect(results[0].abstract).toBe("Hello world");

    expect(results[1].source).toBe("medRxiv");
  });
});