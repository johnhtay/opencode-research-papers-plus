export interface PaperResult {
  title: string;
  authors: string[];
  published: string; // ISO date YYYY-MM-DD
  source: "arXiv" | "Papers with Code";
  pdfUrl?: string;
  codeUrl?: string;
  abstract?: string;
  citations?: number;
  arxivId?: string;
}

export interface PluginOptions {
  defaultMaxResults?: number;
  defaultSource?: "arxiv" | "paperswithcode" | "both";
  arxivRateLimitMs?: number;
  cacheTtlMinutes?: number;
}

export type FilterType = "latest" | "trending" | "top_cited";
export type SourceType = "arxiv" | "semantic_scholar" | "both";
export type DateRange = "week" | "month" | "year" | "all";
