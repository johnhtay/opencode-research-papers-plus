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
      source: tool.schema.enum(["arxiv", "openalex", "auto"]).default(defaultSource).describe("Which source(s) to query"),
      filter: tool.schema.enum(["latest", "trending", "top_cited"]).default("latest").describe("Sorting/filtering strategy"),
      max_results: tool.schema.number().min(1).max(50).default(defaultMaxResults).describe("Maximum number of papers to return"),
      date_range: tool.schema.enum(["week", "month", "year", "all"]).optional().describe("Restrict results to a time window"),
    },
    execute: async (args, _context) => {
      const maxResults = args.max_results;
      const dateRange = args.date_range ?? "all";
      const fetchMultiplier = dateRange !== "all" ? 3 : 1;
      const routing = resolveRouting(args.source, args.filter);

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

      const merged = mergeAndDeduplicate(arxivResults, oaResults, routing);
      const limited = merged.slice(0, maxResults);

      let output = formatResults(args.query, args.filter, limited, dateRange);

      const warnings = buildWarnings(arxivError, oaError, routing, limited.length);
      if (warnings) {
        output += warnings;
      }

      return output;
    },
  });
}

type Routing = { useArxiv: boolean; useOpenAlex: boolean; arxivFirst: boolean };

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
): string {
  const parts: string[] = [];

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

function yearParam(): string {
  const y = new Date().getFullYear();
  return `${y - 1}-${y}`;
}
