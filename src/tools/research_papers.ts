import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { PaperResult, PluginOptions } from "../types.js";
import { searchArxiv } from "../sources/arxiv.js";
import { searchSemanticScholar } from "../sources/semantic-scholar.js";
import { formatResults } from "../formatters/markdown.js";

export function createResearchPapersTool(options: PluginOptions = {}): ToolDefinition {
  const defaultMaxResults = options.defaultMaxResults ?? 10;
  const defaultSource = options.defaultSource ?? "both";
  const s2ApiKey = options.semanticScholarApiKey;

  return tool({
    description:
      "Search for latest, trending, or top-cited research papers on a computer science topic from arXiv and Semantic Scholar. Returns a formatted list with titles, authors, dates, PDF links, and citation counts.",
    args: {
      query: tool.schema.string().describe("The research field or topic, e.g. 'Scene Text Recognition'"),
      source: tool.schema.enum(["arxiv", "semantic_scholar", "both"]).default(defaultSource).describe("Which source(s) to query"),
      filter: tool.schema.enum(["latest", "trending", "top_cited"]).default("latest").describe("Sorting/filtering strategy"),
      max_results: tool.schema.number().min(1).max(50).default(defaultMaxResults).describe("Maximum number of papers to return"),
      date_range: tool.schema.enum(["week", "month", "year", "all"]).optional().describe("Restrict results to a time window"),
    },
    execute: async (args, _context) => {
      const maxResults = args.max_results;
      const source = args.source;
      const dateRange = args.date_range ?? "all";

      const fetchMultiplier = dateRange !== "all" ? 3 : 1;

      let arxivResults: PaperResult[] = [];
      let s2Results: PaperResult[] = [];
      let arxivError: string | null = null;
      let s2Error: string | null = null;

      try {
        if (source === "arxiv" || source === "both") {
          const sortBy = args.filter === "latest" ? "submittedDate" : "lastUpdatedDate";
          arxivResults = await searchArxiv(args.query, maxResults * fetchMultiplier, sortBy);
        }
      } catch (err) {
        arxivError = err instanceof Error ? err.message : String(err);
      }

      try {
        if (source === "semantic_scholar" || source === "both") {
          const s2Year = dateRange === "year" ? yearParam() : undefined;
          s2Results = await searchSemanticScholar(args.query, maxResults, args.filter, undefined, s2Year, s2ApiKey);
        }
      } catch (err) {
        s2Error = err instanceof Error ? err.message : String(err);
      }

      if (dateRange !== "all") {
        arxivResults = filterByDateRange(arxivResults, dateRange);
        s2Results = filterByDateRange(s2Results, dateRange);
      }

      const merged = mergeAndDeduplicate(arxivResults, s2Results, args.filter);
      const limited = merged.slice(0, maxResults);

      let output = formatResults(args.query, args.filter, limited, dateRange);

      const warnings = buildWarnings(arxivError, s2Error, source, limited.length);
      if (warnings) {
        output += warnings;
      }

      return output;
    },
  });
}

function buildWarnings(
  arxivError: string | null,
  s2Error: string | null,
  source: string,
  resultCount: number,
): string {
  const parts: string[] = [];

  const arxivRequested = source === "arxiv" || source === "both";
  const s2Requested = source === "semantic_scholar" || source === "both";

  if (arxivError && s2Error && source === "both") {
    parts.push(`\n\n_⚠️ Both sources failed.`);
    parts.push(`\n- arXiv: ${arxivError}`);
    parts.push(`\n- Semantic Scholar: ${s2Error}`);
    if (resultCount === 0) {
      parts.push(`\n\nTry a different query or wait before retrying._`);
    }
  } else {
    if (arxivError && arxivRequested) {
      parts.push(`\n\n_⚠️ arXiv unavailable (${arxivError}).`);
      if (s2Requested) parts.push(" Showing Semantic Scholar results only._");
      else parts.push("_");
    }
    if (s2Error && s2Requested) {
      parts.push(`\n\n_⚠️ Semantic Scholar unavailable (${s2Error}).`);
      if (arxivRequested) parts.push(" Showing arXiv results only._");
      else parts.push("_");
    }
  }

  return parts.join("");
}

export function mergeAndDeduplicate(
  arxiv: PaperResult[],
  s2: PaperResult[],
  filter: string
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

  if (filter === "trending" || filter === "top_cited") {
    addUnique(s2);
    addUnique(arxiv);
  } else {
    addUnique(arxiv);
    addUnique(s2);
  }

  return merged;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function filterByDateRange(papers: PaperResult[], dateRange: string): PaperResult[] {
  if (!dateRange || dateRange === "all") return papers;

  const now = new Date();
  const cutoff = new Date();

  switch (dateRange) {
    case "week":
      cutoff.setDate(now.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(now.getFullYear() - 1);
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

function yearParam(): string {
  const y = new Date().getFullYear();
  return `${y - 1}-${y}`;
}
