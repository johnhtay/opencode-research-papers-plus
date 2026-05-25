import type { PaperResult } from "../types.js";

const S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const MAX_RETRIES = 2;

function sortByFilter(filter: string): string {
  switch (filter) {
    case "top_cited":
      return "citationCount:desc";
    case "trending":
      return "citationCount:desc";
    case "latest":
    default:
      return "publicationDate:desc";
  }
}

async function fetchWithRetry(url: string, attempt: number = 0): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    const delay = Math.pow(2, attempt) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, attempt + 1);
  }

  return response;
}

export async function searchSemanticScholar(
  query: string,
  maxResults: number,
  filter: string = "latest",
  fields: string = "title,authors,year,citationCount,openAccessPdf,abstract,externalIds"
): Promise<PaperResult[]> {
  const sort = sortByFilter(filter);
  const url = `${S2_API_URL}?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&limit=${maxResults}&sort=${encodeURIComponent(sort)}`;

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Semantic Scholar API ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseS2Response(data);
}

export function parseS2Response(data: any): PaperResult[] {
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
