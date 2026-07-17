import { XMLParser } from "fast-xml-parser";
import type { PaperResult } from "../types.js";
import { buildArxivSearchQuery } from "../utils/query.js";

const ARXIV_API_URL = "http://export.arxiv.org/api/query";
const ARXIV_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/atom+xml" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchArxiv(
  query: string,
  maxResults: number,
  sortBy: "submittedDate" | "lastUpdatedDate" = "submittedDate"
): Promise<PaperResult[]> {
  const searchQuery = buildArxivSearchQuery(query);

  const params = new URLSearchParams();
  params.append("search_query", searchQuery);
  params.append("sortBy", sortBy);
  params.append("sortOrder", "descending");
  params.append("max_results", String(maxResults));

  const url = `${ARXIV_API_URL}?${params.toString()}`;

  const response = await fetchWithTimeout(url, ARXIV_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`arXiv API ${response.status}: ${response.statusText}`);
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
