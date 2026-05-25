import type { PaperResult } from "../types.js";

const S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search";

export async function searchSemanticScholar(
  query: string,
  maxResults: number,
  fields: string = "title,authors,year,citationCount,openAccessPdf,abstract,externalIds"
): Promise<PaperResult[]> {
  const url = `${S2_API_URL}?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&limit=${maxResults}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseS2Response(data);
}

function parseS2Response(data: any): PaperResult[] {
  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((item: any) => ({
    title: item.title || "Unknown Title",
    authors: (item.authors || []).map((a: any) => a.name || "").filter(Boolean),
    published: item.year ? `${item.year}` : "Unknown",
    source: "Semantic Scholar",
    pdfUrl: item.openAccessPdf?.url,
    abstract: item.abstract,
    citations: typeof item.citationCount === "number" ? item.citationCount : undefined,
    arxivId: item.externalIds?.ArXiv,
  }));
}
