import { XMLParser } from "fast-xml-parser";
import type { PaperResult } from "../types.js";

const ARXIV_API_URL = "http://export.arxiv.org/api/query";

export async function searchArxiv(
  query: string,
  maxResults: number,
  sortBy: "submittedDate" | "lastUpdatedDate" = "submittedDate",
  dateRange?: "week" | "month" | "year" | "all"
): Promise<PaperResult[]> {
  // Build search query with optional date filtering
  let searchQuery = `all:${query}`;

  if (dateRange && dateRange !== "all") {
    const now = new Date();
    const past = new Date();
    switch (dateRange) {
      case "week":
        past.setDate(now.getDate() - 7);
        break;
      case "month":
        past.setMonth(now.getMonth() - 1);
        break;
      case "year":
        past.setFullYear(now.getFullYear() - 1);
        break;
    }
    const rangeQuery = `submittedDate:[${formatDateShort(past)} TO ${formatDateShort(now)}]`;
    searchQuery = `(${searchQuery}) AND ${rangeQuery}`;
  }

  const url = `${ARXIV_API_URL}?search_query=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}&sortOrder=descending&max_results=${maxResults}`;

  const response = await fetch(url, {
    headers: { Accept: "application/atom+xml" },
  });

  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  return parseArxivAtom(xmlText);
}

export function parseArxivAtom(xmlText: string): PaperResult[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });

  const parsed = parser.parse(xmlText);
  const feed = parsed.feed;

  if (!feed || !feed.entry) {
    return [];
  }

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => {
    const authors = extractAuthors(entry.author);
    const links = extractLinks(entry.link);
    const arxivId = extractArxivId(entry.id);

    return {
      title: sanitizeText(entry.title || "Unknown Title"),
      authors,
      published: formatDate(entry.published),
      source: "arXiv",
      pdfUrl: links.pdf,
      abstract: sanitizeText(entry.summary || ""),
      arxivId,
    };
  });
}

function extractAuthors(authorData: any): string[] {
  if (!authorData) return [];
  if (Array.isArray(authorData)) {
    return authorData.map((a) => sanitizeText(a.name || "")).filter(Boolean);
  }
  if (authorData.name) {
    return [sanitizeText(authorData.name)];
  }
  return [];
}

function extractLinks(linkData: any): { pdf?: string } {
  const result: { pdf?: string } = {};
  if (!linkData) return result;

  const links = Array.isArray(linkData) ? linkData : [linkData];
  for (const link of links) {
    const href = link["@_href"] || "";
    const type = link["@_type"] || "";
    const title = link["@_title"] || "";
    if (type === "application/pdf" || title === "pdf") {
      result.pdf = href;
    }
  }
  return result;
}

function extractArxivId(idField: string | undefined): string | undefined {
  if (!idField) return undefined;
  const match = idField.match(/(\d{4}\.\d{4,5})/);
  return match ? match[1] : undefined;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Unknown";
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return "Unknown";
  }
}

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatDateShort(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
