export interface PaperResult {
  title: string;
  authors: string[];
  published: string;
  source: "arXiv" | "OpenAlex" | "bioRxiv" | "medRxiv" | "PubMed";
  pdfUrl?: string;
  codeUrl?: string;
  abstract?: string;
  citations?: number;
  arxivId?: string;
  doi?: string;
  pmid?: string;
  journal?: string;
  matchedIn?: string;
}

export interface PluginOptions {
  defaultMaxResults?: number;
  defaultSource?: SourceType;
  pubmedEmail?: string;
}

export type FilterType = "latest" | "trending" | "top_cited";
export type SourceType = "arxiv" | "openalex" | "biorxiv" | "pubmed" | "auto";
export type DateRange = "week" | "month" | "year" | "all";