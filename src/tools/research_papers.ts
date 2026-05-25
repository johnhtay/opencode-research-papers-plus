import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { PaperResult, PluginOptions } from "../types.js";
import { searchArxiv } from "../sources/arxiv.js";
import { searchOpenAlex } from "../sources/openalex.js";
import { formatResults } from "../formatters/markdown.js";

let lastArxivRequest = 0;
const ARXIV_COOLDOWN_MS = 3100;

async function throttledSearchArxiv(
  query: string,
  maxResults: number,
  sortBy: "submittedDate" | "lastUpdatedDate"
): Promise<PaperResult[]> {
  const elapsed = Date.now() - lastArxivRequest;
  if (elapsed < ARXIV_COOLDOWN_MS) {
    await new Promise((r) => setTimeout(r, ARXIV_COOLDOWN_MS - elapsed));
  }
  lastArxivRequest = Date.now();
  return searchArxiv(query, maxResults, sortBy);
}

export function createResearchPapersTool(options: PluginOptions = {}): ToolDefinition {
  const defaultMaxResults = options.defaultMaxResults ?? 10;
  const defaultSource = options.defaultSource ?? "auto";

  return tool({
    description:
      "Search for latest, trending, or top-cited research papers on a computer science topic from arXiv and OpenAlex. Returns a formatted list with titles, authors, dates, PDF links, and citation counts.",
    args: {
      query: tool.schema.string().describe("The research field or topic, e.g. 'Scene Text Recognition'"),
      source: tool.schema.enum(["arxiv", "openalex", "semantic_scholar", "auto"]).default(defaultSource).describe("Which source(s) to query. 'semantic_scholar' is a deprecated alias for 'openalex'."),
      filter: tool.schema.enum(["latest", "trending", "top_cited"]).default("latest").describe("Sorting/filtering strategy"),
      max_results: tool.schema.number().min(1).max(50).default(defaultMaxResults).describe("Maximum number of papers to return"),
      date_range: tool.schema.enum(["week", "month", "year", "all"]).optional().describe("Restrict results to a time window"),
      strict: tool.schema.boolean().default(false).describe("When true, requires query terms in the paper title (not just abstract)"),
    },
    execute: async (args, _context) => {
      const maxResults = args.max_results;
      const dateRange = args.date_range ?? "all";
      const fetchMultiplier = dateRange !== "all" ? 3 : 1;
      const normalizedSource = normalizeSource(args.source);
      const routing = resolveRouting(normalizedSource, args.filter);

      let arxivResults: PaperResult[] = [];
      let oaResults: PaperResult[] = [];
      let arxivError: string | null = null;
      let oaError: string | null = null;

      if (routing.useArxiv) {
        try {
          const sortBy = args.filter === "latest" ? "submittedDate" : "lastUpdatedDate";
          arxivResults = await throttledSearchArxiv(args.query, maxResults * fetchMultiplier, sortBy);
        } catch (err) {
          arxivError = err instanceof Error ? err.message : String(err);
        }
      }

      if (routing.useOpenAlex) {
        try {
          const oaSort = args.filter === "top_cited" || args.filter === "trending"
            ? "top_cited"
            : "latest";
          const oaYear = dateRange === "year" ? yearParam() : undefined;
          oaResults = await searchOpenAlex(args.query, maxResults, oaSort, oaYear);
        } catch (err) {
          oaError = err instanceof Error ? err.message : String(err);
        }
      }

      if (dateRange !== "all") {
        arxivResults = filterByDateRange(arxivResults, dateRange);
        oaResults = filterByDateRange(oaResults, dateRange);
      }

      annotateMatches(arxivResults, args.query);
      annotateMatches(oaResults, args.query);

      if (args.strict) {
        arxivResults = arxivResults.filter((p) => p.matchedIn?.includes("title"));
        oaResults = oaResults.filter((p) => p.matchedIn?.includes("title"));
      }

      const merged = mergeAndDeduplicate(arxivResults, oaResults, routing);
      const limited = merged.slice(0, maxResults);

      const sourcesUsed = describeSources(arxivResults, oaResults, routing, arxivError, oaError);
      let output = formatResults(args.query, args.filter, limited, dateRange, sourcesUsed);

      const warnings = buildWarnings(arxivError, oaError, routing, limited.length, normalizedSource, args.source);
      if (warnings) {
        output += warnings;
      }

      return output;
    },
  });
}

type Routing = { useArxiv: boolean; useOpenAlex: boolean; arxivFirst: boolean };

function normalizeSource(source: string): string {
  if (source === "semantic_scholar") return "openalex";
  return source;
}

function resolveRouting(source: string, filter: string): Routing {
  if (source === "arxiv") return { useArxiv: true, useOpenAlex: false, arxivFirst: true };
  if (source === "openalex") return { useArxiv: false, useOpenAlex: true, arxivFirst: false };

  // auto
  const citeFilter = filter === "top_cited" || filter === "trending";
  return {
    useArxiv: true,
    useOpenAlex: true,
    arxivFirst: !citeFilter,
  };
}

function buildWarnings(
  arxivError: string | null,
  oaError: string | null,
  routing: Routing,
  resultCount: number,
  normalizedSource: string,
  originalSource: string,
): string {
  const parts: string[] = [];

  if (originalSource === "semantic_scholar") {
    parts.push(`\n\n_ℹ️ 'semantic_scholar' is deprecated — using OpenAlex instead._`);
  }

  if (arxivError && oaError && routing.useArxiv && routing.useOpenAlex) {
    parts.push(`\n\n_⚠️ Both sources failed._`);
    parts.push(`\n- arXiv: ${arxivError}`);
    parts.push(`\n- OpenAlex: ${oaError}`);
    if (resultCount === 0) {
      parts.push(`\n\n_Try a different query or wait before retrying._`);
    }
  } else {
    if (arxivError && routing.useArxiv) {
      parts.push(`\n\n_⚠️ arXiv unavailable (${arxivError}).`);
      if (routing.useOpenAlex) parts.push(" Showing OpenAlex results only._");
      else parts.push("_");
    }
    if (oaError && routing.useOpenAlex) {
      parts.push(`\n\n_⚠️ OpenAlex unavailable (${oaError}).`);
      if (routing.useArxiv) parts.push(" Showing arXiv results only._");
      else parts.push("_");
    }
  }

  return parts.join("");
}

export function mergeAndDeduplicate(
  arxiv: PaperResult[],
  oa: PaperResult[],
  routing: Routing,
): PaperResult[] {
  const seen = new Set<string>();
  const merged: PaperResult[] = [];

  const addUnique = (papers: PaperResult[]) => {
    for (const paper of papers) {
      const key = normalizeTitle(paper.title);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(paper);
      }
    }
  };

  if (routing.arxivFirst) {
    addUnique(arxiv);
    addUnique(oa);
  } else {
    addUnique(oa);
    addUnique(arxiv);
  }

  return merged;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function describeSources(
  arxivResults: PaperResult[],
  oaResults: PaperResult[],
  routing: Routing,
  arxivError: string | null,
  oaError: string | null,
): string | undefined {
  const arxivOk = routing.useArxiv && !arxivError && arxivResults.length > 0;
  const oaOk = routing.useOpenAlex && !oaError && oaResults.length > 0;

  if (arxivOk && oaOk) return "arXiv + OpenAlex";
  if (arxivOk) return "arXiv";
  if (oaOk) return "OpenAlex";
  return undefined;
}

function filterByDateRange(papers: PaperResult[], dateRange: string): PaperResult[] {
  if (!dateRange || dateRange === "all") return papers;

  const cutoff = new Date();

  switch (dateRange) {
    case "week":
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    default:
      return papers;
  }

  return papers.filter((paper) => {
    const pub = paper.published;
    if (pub === "Unknown") return true;

    if (pub.length === 4) {
      return parseInt(pub) >= cutoff.getFullYear();
    }

    try {
      return new Date(pub) >= cutoff;
    } catch {
      return true;
    }
  });
}

function annotateMatches(papers: PaperResult[], query: string): void {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

  for (const paper of papers) {
    const ti = paper.title.toLowerCase();
    const ab = (paper.abstract || "").toLowerCase();
    const fields: string[] = [];
    const matchedTerms: string[] = [];

    for (const term of terms) {
      if (ti.includes(term)) { fields.push("title"); matchedTerms.push(term); }
      else if (ab.includes(term)) { fields.push("abstract"); matchedTerms.push(term); }
    }

    const uniqueFields = [...new Set(fields)];
    const uniqueTerms = [...new Set(matchedTerms)];
    if (uniqueFields.length > 0) {
      paper.matchedIn = uniqueFields.join(", ") + " (" + uniqueTerms.join(", ") + ")";
    }
  }
}

function yearParam(): string {
  const y = new Date().getFullYear();
  return `${y - 1}-${y}`;
}
