import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchPubmed,
  parseEsearchResult,
  parsePubmedXml,
  buildEsearchUrl,
  buildEfetchUrl,
  dateBounds,
} from "../sources/pubmed.js";

const mockEsearch = {
  header: { type: "esearch", version: "0.3" },
  esearchresult: {
    count: "2",
    retmax: "2",
    retstart: "0",
    idlist: ["42473636", "39026321"],
  },
};

const mockEfetchXml = `<?xml version="1.0" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2024//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_240101.dtd">
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
      <PMID Version="1">42473636</PMID>
      <Article PubModel="Electronic">
        <Journal>
          <ISSN IssnType="Electronic">2468-0427</ISSN>
          <JournalIssue CitedMedium="Internet">
            <Volume>12</Volume>
            <Issue>1</Issue>
            <PubDate>
              <Year>2027</Year>
              <Month>Mar</Month>
            </PubDate>
          </JournalIssue>
          <Title>Infectious disease modelling</Title>
          <ISOAbbreviation>Infect Dis Model</ISOAbbreviation>
        </Journal>
        <ArticleTitle>From giant components to communities: community-level insights for <i>HIV-1</i> transmission networks.</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Prior work has studied large clusters.</AbstractText>
          <AbstractText Label="METHODS">We analyzed network structure.</AbstractText>
        </Abstract>
        <AuthorList CompleteYN="Y">
          <Author ValidYN="Y">
            <LastName>Yan</LastName>
            <ForeName>Huan</ForeName>
            <Initials>H</Initials>
          </Author>
          <Author ValidYN="Y">
            <LastName>Wu</LastName>
            <ForeName>Hui</ForeName>
            <Initials>H</Initials>
          </Author>
          <Author ValidYN="Y">
            <CollectiveName>Example Consortium</CollectiveName>
          </Author>
        </AuthorList>
        <ArticleIdList>
          <ArticleId IdType="pubmed">42473636</ArticleId>
          <ArticleId IdType="pmc">PMC13380797</ArticleId>
          <ArticleId IdType="doi">10.1016/j.idm.2026.05.010</ArticleId>
          <ArticleId IdType="pii">S2468-0427(26)00061-8</ArticleId>
        </ArticleIdList>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
      <PMID Version="1">39026321</PMID>
      <Article PubModel="Print">
        <Journal>
          <ISSN IssnType="Print">0305-0270</ISSN>
          <JournalIssue CitedMedium="Print">
            <PubDate>
              <MedlineDate>2025 Jan-Feb</MedlineDate>
            </PubDate>
          </JournalIssue>
          <Title>Freshwater Biology</Title>
        </Journal>
        <ArticleTitle>A minimal record with no abstract.</ArticleTitle>
        <ArticleIdList>
          <ArticleId IdType="pubmed">39026321</ArticleId>
          <ArticleId IdType="doi">10.1111/fwb.70000</ArticleId>
        </ArticleIdList>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

describe("parseEsearchResult", () => {
  it("extracts PMIDs from a valid response", () => {
    expect(parseEsearchResult(mockEsearch)).toEqual(["42473636", "39026321"]);
  });

  it("returns empty array for missing esearchresult", () => {
    expect(parseEsearchResult({})).toEqual([]);
    expect(parseEsearchResult(null)).toEqual([]);
    expect(parseEsearchResult(undefined)).toEqual([]);
  });

  it("filters out non-numeric ids", () => {
    expect(parseEsearchResult({ esearchresult: { idlist: ["123", null, "abc", 456] } })).toEqual(["123"]);
  });
});

describe("parsePubmedXml", () => {
  it("parses full article records", () => {
    const results = parsePubmedXml(mockEfetchXml);

    expect(results).toHaveLength(2);

    expect(results[0].title).toBe("From giant components to communities: community-level insights for HIV-1 transmission networks.");
    expect(results[0].authors).toEqual(["Yan Huan", "Wu Hui", "Example Consortium"]);
    expect(results[0].published).toBe("2027-03-01");
    expect(results[0].source).toBe("PubMed");
    expect(results[0].pmid).toBe("42473636");
    expect(results[0].doi).toBe("10.1016/j.idm.2026.05.010");
    expect(results[0].journal).toBe("Infectious disease modelling");
    expect(results[0].pdfUrl).toBe("https://pmc.ncbi.nlm.nih.gov/articles/PMC13380797/");
    expect(results[0].abstract).toBe("BACKGROUND: Prior work has studied large clusters. METHODS: We analyzed network structure.");
  });

  it("uses DOI URL when PMC is missing", () => {
    const results = parsePubmedXml(mockEfetchXml);
    expect(results[1].pdfUrl).toBe("https://doi.org/10.1111/fwb.70000");
  });

  it("handles MedlineDate when structured date is missing", () => {
    const results = parsePubmedXml(mockEfetchXml);
    expect(results[1].published).toBe("2025 Jan-Feb");
  });

  it("returns empty array for empty article set", () => {
    expect(parsePubmedXml("<PubmedArticleSet></PubmedArticleSet>")).toEqual([]);
    expect(parsePubmedXml("not xml at all")).toEqual([]);
  });
});

describe("buildEsearchUrl", () => {
  it("constructs URL with term, sort, and tool params", () => {
    const url = buildEsearchUrl({ query: "phylogenomics", maxResults: 10, sortBy: "pub_date" });

    expect(url).toContain("db=pubmed");
    expect(url).toContain("term=phylogenomics");
    expect(url).toContain("retmax=10");
    expect(url).toContain("sort=pub_date");
    expect(url).toContain("retmode=json");
    expect(url).toContain("tool=opencode-research-papers-plus");
  });

  it("includes email when provided", () => {
    const url = buildEsearchUrl({ query: "test", maxResults: 5, sortBy: "relevance", email: "user@example.com" });
    expect(url).toContain("email=user%40example.com");
  });

  it("includes date bounds with edat datetype when provided", () => {
    const url = buildEsearchUrl({ query: "test", maxResults: 5, sortBy: "pub_date", minDate: "2026/08/01", maxDate: "2026/09/08" });

    expect(url).toContain("datetype=edat");
    expect(url).toContain("mindate=2026%2F08%2F01");
    expect(url).toContain("maxdate=2026%2F09%2F08");
  });

  it("omits date params when bounds absent", () => {
    const url = buildEsearchUrl({ query: "test", maxResults: 5, sortBy: "pub_date" });
    expect(url).not.toContain("mindate");
    expect(url).not.toContain("datetype");
  });
});

describe("buildEfetchUrl", () => {
  it("joins PMIDs with commas", () => {
    const url = buildEfetchUrl(["111", "222"]);
    expect(url).toContain("id=111%2C222");
    expect(url).toContain("retmode=xml");
  });
});

describe("dateBounds", () => {
  it("returns empty object for all/undefined", () => {
    expect(dateBounds(undefined)).toEqual({});
    expect(dateBounds("all")).toEqual({});
  });

  it("computes a 7-day window for week", () => {
    const { minDate, maxDate } = dateBounds("week");
    const min = new Date(minDate!.replace(/\//g, "-"));
    const max = new Date(maxDate!.replace(/\//g, "-"));
    const diffDays = (max.getTime() - min.getTime()) / 86_400_000;
    expect(diffDays).toBeCloseTo(7, 0);
  });
});

describe("searchPubmed", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockEsearch),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(mockEfetchXml),
      });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("performs ESearch then EFetch in order and parses results", async () => {
    const results = await searchPubmed("phylogenomics", 10, "latest", "all", "user@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const esearchUrl = fetchMock.mock.calls[0][0] as string;
    expect(esearchUrl).toContain("esearch.fcgi");
    expect(esearchUrl).toContain("term=phylogenomics");
    expect(esearchUrl).toContain("sort=pub_date");

    const efetchUrl = fetchMock.mock.calls[1][0] as string;
    expect(efetchUrl).toContain("efetch.fcgi");
    expect(efetchUrl).toContain("id=42473636%2C39026321");

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe("PubMed");
  }, 10000);

  it("uses relevance sort for citation-based filters", async () => {
    await searchPubmed("test", 5, "top_cited", "all");

    const esearchUrl = fetchMock.mock.calls[0][0] as string;
    expect(esearchUrl).toContain("sort=relevance");
  }, 10000);

  it("returns empty array when no hits", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ esearchresult: { idlist: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchPubmed("zzzznohits", 5, "latest", "all");
    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 10000);

  it("throws on ESearch failure", async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPubmed("test", 5, "latest", "all")).rejects.toThrow("PubMed ESearch 503");
  }, 10000);

  it("throws on EFetch failure", async () => {
    fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockEsearch),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPubmed("test", 5, "latest", "all")).rejects.toThrow("PubMed EFetch 500");
  }, 10000);

  it("sends date bounds for week range", async () => {
    await searchPubmed("test", 5, "latest", "week");

    const esearchUrl = fetchMock.mock.calls[0][0] as string;
    expect(esearchUrl).toContain("datetype=edat");
    expect(esearchUrl).toContain("mindate=");
    expect(esearchUrl).toContain("maxdate=");
  }, 10000);
});