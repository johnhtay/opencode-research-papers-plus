import type { PaperResult } from "../types.js";

const PWC_API_URL = "https://paperswithcode.com/api/v1/papers/";

export async function searchPapersWithCode(
  query: string,
  maxResults: number,
  ordering: "-stars" | "-date" = "-date"
): Promise<PaperResult[]> {
  const url = `${PWC_API_URL}?q=${encodeURIComponent(query)}&ordering=${ordering}&page_size=${maxResults}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Papers with Code API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parsePWCResponse(data);
}

function parsePWCResponse(data: any): PaperResult[] {
  if (!data || !data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.map((item: any) => ({
    title: item.title || "Unknown Title",
    authors: item.authors ? item.authors.split(", ") : [],
    published: item.published ? item.published.slice(0, 10) : "Unknown",
    source: "Papers with Code",
    pdfUrl: item.url_abs || item.url,
    codeUrl: item.github_url,
    abstract: item.abstract,
    citations: item.citation_count,
    arxivId: extractArxivIdFromUrl(item.url_abs || item.url || ""),
  }));
}

function extractArxivIdFromUrl(url: string): string | undefined {
  const match = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
  return match ? match[1] : undefined;
}
