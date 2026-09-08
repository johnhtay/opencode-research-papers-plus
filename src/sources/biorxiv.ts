import type { PaperResult } from "../types.js";
import { searchOpenAlex } from "./openalex.js";

// OpenAlex source IDs for the Cold Spring Harbor preprint servers.
// bioRxiv: https://openalex.org/S4306402567
// medRxiv: https://openalex.org/S3005729997
const BIORXIV_MEDRXIV_SOURCE_IDS = "S4306402567|S3005729997";

export async function searchBiorxiv(
  query: string,
  maxResults: number,
  filter: string = "latest",
  year?: string
): Promise<PaperResult[]> {
  const results = await searchOpenAlex(query, maxResults, filter, year, BIORXIV_MEDRXIV_SOURCE_IDS);
  return results.map(rebrand);
}

export function rebrand(paper: PaperResult): PaperResult {
  const isMedrxiv = /medrxiv/i.test(paper.journal || "") || /medrxiv/i.test(paper.pdfUrl || "");
  const doi = paper.doi;

  return {
    ...paper,
    source: isMedrxiv ? "medRxiv" : "bioRxiv",
    pdfUrl: paper.pdfUrl || (doi ? contentUrlFor(isMedrxiv, doi) : undefined),
  };
}

function contentUrlFor(isMedrxiv: boolean, doi: string): string {
  const base = isMedrxiv ? "https://www.medrxiv.org/content/" : "https://www.biorxiv.org/content/";
  return `${base}${doi}v1.full.pdf`;
}