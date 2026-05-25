import { z } from "zod";
import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { PaperResult, PluginOptions } from "../types.js";
import { searchArxiv } from "../sources/arxiv.js";
import { searchPapersWithCode } from "../sources/paperswithcode.js";
import { formatResults } from "../formatters/markdown.js";

const argsSchema = z.object({
  query: z.string().describe("The research field or topic, e.g. 'Scene Text Recognition'"),
  source: z
    .enum(["arxiv", "paperswithcode", "both"])
    .default("both")
    .describe("Which source(s) to query"),
  filter: z
    .enum(["latest", "trending", "top_cited"])
    .default("latest")
    .describe("Sorting/filtering strategy"),
  max_results: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of papers to return"),
  date_range: z
    .enum(["week", "month", "year", "all"])
    .optional()
    .describe("Restrict results to a time window"),
});

type ResearchPapersArgs = z.infer<typeof argsSchema>;

export function createResearchPapersTool(options: PluginOptions = {}) {
  const defaultMaxResults = options.defaultMaxResults ?? 10;
  const defaultSource = options.defaultSource ?? "both";

  return tool({
    description:
      "Search for latest, trending, or top-cited research papers on a computer science topic from arXiv and Papers with Code. Returns a formatted list with titles, authors, dates, PDF links, and code repository links.",
    args: {
      query: tool.schema.string().describe("The research field or topic, e.g. 'Scene Text Recognition'"),
      source: tool.schema.enum(["arxiv", "paperswithcode", "both"]).default("both").describe("Which source(s) to query"),
      filter: tool.schema.enum(["latest", "trending", "top_cited"]).default("latest").describe("Sorting/filtering strategy"),
      max_results: tool.schema.number().min(1).max(50).default(10).describe("Maximum number of papers to return"),
      date_range: tool.schema.enum(["week", "month", "year", "all"]).optional().describe("Restrict results to a time window"),
    } as any,
    execute: async (rawArgs: any, _context) => {
      // Re-validate with our known schema for type safety
      const args = argsSchema.parse(rawArgs);
      const maxResults = args.max_results ?? defaultMaxResults;
      const source = args.source ?? defaultSource;

      let arxivResults: PaperResult[] = [];
      let pwcResults: PaperResult[] = [];

      try {
        if (source === "arxiv" || source === "both") {
          const sortBy = args.filter === "latest" ? "submittedDate" : "lastUpdatedDate";
          arxivResults = await searchArxiv(
            args.query,
            maxResults,
            sortBy,
            args.date_range
          );
        }
      } catch (_err) {
        arxivResults = [];
      }

      try {
        if (source === "paperswithcode" || source === "both") {
          const ordering =
            args.filter === "trending"
              ? "-stars"
              : args.filter === "top_cited"
              ? "-stars"
              : "-date";
          pwcResults = await searchPapersWithCode(args.query, maxResults, ordering);
        }
      } catch (_err) {
        pwcResults = [];
      }

      const merged = mergeAndDeduplicate(arxivResults, pwcResults, args.filter);
      const limited = merged.slice(0, maxResults);

      let output = formatResults(args.query, args.filter, limited);

      if (arxivResults.length === 0 && (source === "arxiv" || source === "both")) {
        output +=
          "\n\n_⚠️ Note: arXiv results could not be retrieved. Showing Papers with Code results only._";
      }
      if (pwcResults.length === 0 && (source === "paperswithcode" || source === "both")) {
        output +=
          "\n\n_⚠️ Note: Papers with Code results could not be retrieved. Showing arXiv results only._";
      }

      return output;
    },
  }) as ToolDefinition;
}

function mergeAndDeduplicate(
  arxiv: PaperResult[],
  pwc: PaperResult[],
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
    addUnique(pwc);
    addUnique(arxiv);
  } else {
    addUnique(arxiv);
    addUnique(pwc);
  }

  return merged;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}
