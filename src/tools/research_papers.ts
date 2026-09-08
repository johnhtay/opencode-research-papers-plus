import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { PaperResult, PluginOptions, SourceType } from "../types.js";
import { searchArxiv } from "../sources/arxiv.js";
import { searchOpenAlex } from "../sources/openalex.js";
import { searchBiorxiv } from "../sources/biorxiv.js";
import { searchPubmed } from "../sources/pubmed.js";
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
      "Search for latest, trending, or top-cited research papers. Sources: arXiv (CS/physics/math preprints), OpenAlex (broad scholarly metadata with citation counts), bioRxiv (bioRxiv+medRxiv biology/health preprints), PubMed (biomedical literature). Returns a formatted list with titles, authors, dates, PDF links, and citation counts. For best recall, expand acronyms and abbreviations in the user's request into the full technical terms used in paper titles and abstracts (e.g., 'MTP in LLMs' should be passed as 'Multi-Token Prediction in Large Language Models'). Pick source 'biorxiv' or 'pubmed' for biology, medicine, and health queries.",
    args: {
      query: tool.schema.string().describe("The research field or topic using full technical terms. Expand acronyms and abbreviations (e.g., 'Multi-Token Prediction in Large Language Models' instead of 'MTP in LLMs')."),
      source: tool.schema.enum(["arxiv", "openalex", "biorxiv", "pubmed", "semantic_scholar", "auto"]).default(defaultSource).describe("Which source(s) to query. 'semantic_scholar' is a deprecated alias for 'openalex'."),
      filter: tool.schema.enum(["latest", "trending", "top_cited"]).default("latest").describe("Sorting/filtering strategy"),
      max_results: tool.schema.number().min(1).max(50).default(defaultMaxResults).describe("Maximum number of papers to return"),
      date_range: tool.schema.enum(["week", "month", "year", "all"]).optional().describe("Restrict results to a time window"),
      strict: tool.schema.boolean().default(false).describe("When true, applies anchor + concept-group filtering to reduce loosely matched results."),
    },
    execute: async (args, _context) => {
      const maxResults = args.max_results;
      const dateRange = args.date_range ?? "all";
      const fetchMultiplier = dateRange !== "all" ? 3 : 1;
      const normalizedSource = normalizeSource(args.source);
      const routing = resolveRouting(normalizedSource, args.filter);

      const searchThunks = buildSearchThunks(routing.priority, {
        query: args.query,
        maxResults,
        fetchMultiplier,
        dateRange,
        filter: args.filter,
        pubmedEmail: options.pubmedEmail,
      });

      const settled = await Promise.allSettled(searchThunks.map((thunk) => thunk()));

      const resultsBySource = new Map<SourceType, PaperResult[]>();
      const errorsBySource = new Map<SourceType, string>();
      routing.priority.forEach((source, i) => {
        const outcome = settled[i];
        if (outcome.status === "fulfilled") {
          resultsBySource.set(source, outcome.value);
        } else {
          resultsBySource.set(source, []);
          errorsBySource.set(source, outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
        }
      });

      let merged = deduplicateOrdered(routing.priority.map((s) => resultsBySource.get(s) ?? []));

      if (dateRange !== "all") {
        merged = filterByDateRange(merged, dateRange);
      }

      annotateMatches(merged, args.query);

      if (args.strict) {
        merged = strictFilter(merged, args.query);
      }

      const limited = merged.slice(0, maxResults);

      const sourcesUsed = describeSources(routing.priority, resultsBySource, errorsBySource);
      let output = formatResults(args.query, args.filter, limited, dateRange, sourcesUsed);

      const warnings = buildWarnings(routing, resultsBySource, errorsBySource, limited.length, normalizedSource, args.source);
      if (warnings) {
        output += warnings;
      }

      return output;
    },
  });
}

interface Routing {
  priority: SourceType[];
}

const SOURCE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  openalex: "OpenAlex",
  biorxiv: "bioRxiv",
  pubmed: "PubMed",
};

function normalizeSource(source: string): string {
  if (source === "semantic_scholar") return "openalex";
  return source;
}

function resolveRouting(source: string, filter: string): Routing {
  if (source === "arxiv") return { priority: ["arxiv"] };
  if (source === "openalex") return { priority: ["openalex"] };
  if (source === "biorxiv") return { priority: ["biorxiv"] };
  if (source === "pubmed") return { priority: ["pubmed"] };

  // auto
  const citeFilter = filter === "top_cited" || filter === "trending";
  if (citeFilter) return { priority: ["openalex", "pubmed"] };
  return { priority: ["arxiv", "openalex", "pubmed"] };
}

interface SearchThunkArgs {
  query: string;
  maxResults: number;
  fetchMultiplier: number;
  dateRange: string;
  filter: string;
  pubmedEmail?: string;
}

function buildSearchThunks(priority: SourceType[], args: SearchThunkArgs): Array<() => Promise<PaperResult[]>> {
  const oaYear = args.dateRange === "year" ? yearParam() : undefined;
  const oaSort = args.filter === "top_cited" || args.filter === "trending" ? "top_cited" : "latest";

  return priority.map((source) => {
    switch (source) {
      case "arxiv":
        return () => {
          const sortBy = args.filter === "latest" ? "submittedDate" : "lastUpdatedDate";
          return throttledSearchArxiv(args.query, args.maxResults * args.fetchMultiplier, sortBy);
        };
      case "openalex":
        return () => searchOpenAlex(args.query, args.maxResults, oaSort, oaYear);
      case "biorxiv":
        return () => searchBiorxiv(args.query, args.maxResults, oaSort, oaYear);
      case "pubmed":
        return () => searchPubmed(args.query, args.maxResults, oaSort, args.dateRange, args.pubmedEmail);
      default:
        return () => Promise.resolve([]);
    }
  });
}

function buildWarnings(
  routing: Routing,
  resultsBySource: Map<SourceType, PaperResult[]>,
  errorsBySource: Map<SourceType, string>,
  resultCount: number,
  normalizedSource: string,
  originalSource: string,
): string {
  const parts: string[] = [];

  if (originalSource === "semantic_scholar") {
    parts.push(`\n\n_ℹ️ 'semantic_scholar' is deprecated — using OpenAlex instead._`);
  }

  const requested = routing.priority;
  const activeErrors = requested.filter((s) => errorsBySource.has(s));
  const allFailed = activeErrors.length === requested.length && requested.length > 0;

  if (allFailed) {
    parts.push(`\n\n_⚠️ All requested sources failed._`);
    for (const source of requested) {
      parts.push(`\n- ${SOURCE_LABELS[source]}: ${errorsBySource.get(source)}`);
    }
    if (resultCount === 0) {
      parts.push(`\n\n_Try a different query or wait before retrying._`);
    }
  } else {
    for (const source of activeErrors) {
      const others = requested.filter((s) => s !== source && (resultsBySource.get(s)?.length ?? 0) > 0);
      parts.push(`\n\n_⚠️ ${SOURCE_LABELS[source]} unavailable (${errorsBySource.get(source)}).`);
      if (others.length > 0) parts.push(` Showing results from ${others.map((s) => SOURCE_LABELS[s]).join(" + ")}. _`);
      else parts.push("_");
    }
  }

  return parts.join("");
}

export function deduplicateOrdered(groups: PaperResult[][]): PaperResult[] {
  const seen = new Set<string>();
  const merged: PaperResult[] = [];

  for (const papers of groups) {
    for (const paper of papers) {
      const key = dedupKey(paper);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(paper);
      }
    }
  }

  return merged;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dedupKey(paper: PaperResult): string {
  const doi = paper.doi?.toLowerCase().replace(/^https?:\/\/doi\.org\//, "");
  if (doi) return `doi:${doi}`;
  return `title:${normalizeTitle(paper.title)}`;
}

function describeSources(
  priority: SourceType[],
  resultsBySource: Map<SourceType, PaperResult[]>,
  errorsBySource: Map<SourceType, string>,
): string | undefined {
  const active = priority.filter(
    (s) => !errorsBySource.has(s) && (resultsBySource.get(s)?.length ?? 0) > 0
  );
  if (active.length === 0) return undefined;
  return active.map((s) => SOURCE_LABELS[s]).join(" + ");
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

function strictFilter(papers: PaperResult[], query: string): PaperResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return papers;

  const anchorSynonyms: Record<string, string[]> = {
    retinal: ["retinal", "fundus", "retina", "ophthalmic", "eye"],
    brain: ["brain", "cerebral", "neural", "neuro"],
    medical: ["medical", "clinical", "healthcare"],
    graph: ["graph", "gnn", "graph neural"],
    remote: ["remote", "satellite", "aerial", "sensing"],
    scene: ["scene", "scene text", "text detection"],
  };

  const anchorGroup = anchorSynonyms[terms[0]] ?? [terms[0]];
  const minTotal = Math.max(1, Math.ceil(terms.length * 0.66));

  return papers.filter((paper) => {
    const ti = paper.title.toLowerCase();
    const ab = (paper.abstract || "").toLowerCase();

    let anchorMatched = false;
    let totalMatched = 0;

    for (const term of terms) {
      if (ti.includes(term) || ab.includes(term)) {
        totalMatched++;
        if (anchorGroup.includes(term)) anchorMatched = true;
      }
    }

    if (terms.length >= 3) {
      return anchorMatched && totalMatched >= minTotal;
    }

    return totalMatched >= minTotal;
  });
}

function yearParam(): string {
  const y = new Date().getFullYear();
  return `${y - 1}-${y}`;
}