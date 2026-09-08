import type { PaperResult } from "../types.js";
import { fetchWithTimeout } from "./http.js";

const OA_API_URL = "https://api.openalex.org/works";
const OA_TIMEOUT_MS = 15000;

function sortByFilter(filter: string): string {
  switch (filter) {
    case "top_cited":
    case "trending":
      return "cited_by_count:desc";
    case "latest":
    default:
      return "publication_date:desc";
  }
}

export async function searchOpenAlex(
  query: string,
  maxResults: number,
  filter: string = "latest",
  year?: string,
  sourceFilter?: string
): Promise<PaperResult[]> {
  const sort = sortByFilter(filter);
  let url = `${OA_API_URL}?search=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&per_page=${maxResults}`;

  const filterClauses: string[] = [];
  if (sourceFilter) filterClauses.push(`primary_location.source.id:${sourceFilter}`);
  if (year) filterClauses.push(`publication_year:${year}`);
  if (filterClauses.length > 0) {
    url += `&filter=${encodeURIComponent(filterClauses.join(","))}`;
  }

  const response = await fetchWithTimeout(url, OA_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`OpenAlex API ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseOAResponse(data);
}

export function parseOAResponse(data: any): PaperResult[] {
  if (!data || !data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.map((item: any) => ({
    title: item.title || "Unknown Title",
    authors: (item.authorships || []).map((a: any) => a.author?.display_name || "").filter(Boolean),
    published: item.publication_date || "Unknown",
    source: "OpenAlex",
    pdfUrl: item.open_access?.oa_url || item.best_oa_location?.landing_page_url || undefined,
    abstract: reconstructAbstract(item.abstract_inverted_index),
    citations: typeof item.cited_by_count === "number" ? item.cited_by_count : undefined,
    doi: extractDoi(item.doi),
    journal: item.primary_location?.source?.display_name || undefined,
    arxivId: undefined,
  }));
}

function extractDoi(doiField: string | undefined | null): string | undefined {
  if (!doiField || typeof doiField !== "string") return undefined;
  const match = doiField.match(/10\.\d{4,9}\/[^\s"<>]+/);
  return match ? match[0] : undefined;
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string | undefined {
  if (!invertedIndex) return undefined;

  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }

  const text = words.join(" ");
  return text.length > 0 ? text : undefined;
}
