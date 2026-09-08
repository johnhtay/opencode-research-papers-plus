import { XMLParser } from "fast-xml-parser";
import type { PaperResult } from "../types.js";
import { fetchWithTimeout } from "./http.js";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_TIMEOUT_MS = 15000;
const NCBI_MIN_INTERVAL_MS = 350;

let lastEutilsRequest = 0;

async function throttledFetch(url: string): Promise<Response> {
  const elapsed = Date.now() - lastEutilsRequest;
  if (elapsed < NCBI_MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, NCBI_MIN_INTERVAL_MS - elapsed));
  }
  lastEutilsRequest = Date.now();
  return fetchWithTimeout(url, PUBMED_TIMEOUT_MS);
}

export interface PubMedSearchParams {
  query: string;
  maxResults: number;
  sortBy: "pub_date" | "relevance";
  minDate?: string;
  maxDate?: string;
  email?: string;
}

export function buildEsearchUrl(params: PubMedSearchParams): string {
  const search = new URLSearchParams({
    db: "pubmed",
    term: params.query,
    retmax: String(params.maxResults),
    sort: params.sortBy,
    retmode: "json",
    tool: "opencode-research-papers-plus",
  });
  if (params.email) search.set("email", params.email);
  if (params.minDate && params.maxDate) {
    search.set("datetype", "edat");
    search.set("mindate", params.minDate);
    search.set("maxdate", params.maxDate);
  }
  return `${EUTILS_BASE}/esearch.fcgi?${search.toString()}`;
}

export function buildEfetchUrl(pmids: string[], email?: string): string {
  const search = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
    tool: "opencode-research-papers-plus",
  });
  if (email) search.set("email", email);
  return `${EUTILS_BASE}/efetch.fcgi?${search.toString()}`;
}

export async function searchPubmed(
  query: string,
  maxResults: number,
  filter: string = "latest",
  dateRange?: string,
  email?: string
): Promise<PaperResult[]> {
  const sortBy = filter === "top_cited" || filter === "trending" ? "relevance" : "pub_date";
  const { minDate, maxDate } = dateBounds(dateRange);

  const esearchUrl = buildEsearchUrl({ query, maxResults, sortBy, minDate, maxDate, email });
  const esearchResponse = await throttledFetch(esearchUrl);
  if (!esearchResponse.ok) {
    throw new Error(`PubMed ESearch ${esearchResponse.status}: ${esearchResponse.statusText}`);
  }
  const esearchData = await esearchResponse.json();
  const pmids = parseEsearchResult(esearchData);

  if (pmids.length === 0) return [];

  const efetchUrl = buildEfetchUrl(pmids, email);
  const efetchResponse = await throttledFetch(efetchUrl);
  if (!efetchResponse.ok) {
    throw new Error(`PubMed EFetch ${efetchResponse.status}: ${efetchResponse.statusText}`);
  }
  const xmlText = await efetchResponse.text();
  return parsePubmedXml(xmlText);
}

export function parseEsearchResult(data: any): string[] {
  const idlist = data?.esearchresult?.idlist;
  if (!Array.isArray(idlist)) return [];
  return idlist.filter((id: unknown) => typeof id === "string" && /^\d+$/.test(id));
}

export function parsePubmedXml(xmlText: string): PaperResult[] {
  // Inline formatting tags (italics on gene names, sub/superscripts, etc.) carry
  // no semantic value for search results and break flat text extraction, so
  // strip them before parsing. This merges nested text into a single node.
  const cleaned = xmlText.replace(/<\/?(?:i|b|em|strong|u|sub|sup|italic|bold|underline|sc)>/g, "");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });

  const parsed = parser.parse(cleaned);
  const articleSet = parsed.PubmedArticleSet;

  if (!articleSet) return [];

  const articles = Array.isArray(articleSet.PubmedArticle)
    ? articleSet.PubmedArticle
    : [articleSet.PubmedArticle];

  return articles.filter(Boolean).map((article: any) => mapArticle(article));
}

function mapArticle(article: any): PaperResult {
  const citation = article.MedlineCitation ?? {};
  const pmArticle = citation.Article ?? {};
  const journal = pmArticle.Journal ?? {};
  const pubmedData = article.PubmedData ?? {};

  const pmid = text(citation.PMID);
  const articleIds = {
    ...extractArticleIds(pubmedData?.ArticleIdList?.ArticleId),
    ...extractArticleIds(pmArticle?.ArticleIdList?.ArticleId),
  };
  const authors = extractAuthors(pmArticle?.AuthorList?.Author);
  const pubDate = extractPubDate(journal);
  const abstract = extractAbstract(pmArticle?.Abstract?.AbstractText);
  const doi = articleIds.doi;
  const pmcid = articleIds.pmc;

  const pdfUrl = pmcid
    ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`
    : doi
      ? `https://doi.org/${doi}`
      : pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : undefined;

  return {
    title: text(pmArticle.ArticleTitle) || "Unknown Title",
    authors,
    published: pubDate,
    source: "PubMed",
    pdfUrl,
    abstract: abstract || undefined,
    doi,
    pmid: pmid || undefined,
    journal: text(journal.Title) || undefined,
  };
}

function text(value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return sanitize(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value["#text"] !== undefined) return sanitize(String(value["#text"]));
    return sanitize(flattenNestedText(value));
  }
  return String(value);
}

function flattenNestedText(value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenNestedText).join("");
  if (typeof value === "object") {
    if (value["#text"] !== undefined) return String(value["#text"]);
    return Object.entries(value)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, v]) => flattenNestedText(v))
      .join("");
  }
  return "";
}

function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractAuthors(authorData: any): string[] {
  if (!authorData) return [];
  const authors = Array.isArray(authorData) ? authorData : [authorData];
  return authors
    .map((a: any) => {
      const name = text(a?.CollectiveName);
      if (name) return name;
      const lastName = text(a?.LastName);
      const foreName = text(a?.ForeName);
      return `${lastName} ${foreName}`.trim();
    })
    .filter(Boolean);
}

function extractArticleIds(idData: any): { doi?: string; pmc?: string } {
  if (!idData) return {};
  const ids = Array.isArray(idData) ? idData : [idData];
  const result: { doi?: string; pmc?: string } = {};
  for (const id of ids) {
    const type = id?.["@_IdType"];
    const value = text(id);
    if (type === "doi") result.doi = value;
    if (type === "pmc") result.pmc = value;
  }
  return result;
}

function extractPubDate(journal: any): string {
  const date = journal?.JournalIssue?.PubDate ?? {};
  const year = text(date.Year);
  const month = text(date.Month);
  const day = text(date.Day);

  if (!year && !month) {
    const medlineDate = text(date.MedlineDate);
    return medlineDate || "Unknown";
  }

  const monthIndex = monthName(month);
  const mm = monthIndex !== undefined ? String(monthIndex + 1).padStart(2, "0") : "01";
  const dd = /^\d+$/.test(day) ? String(day).padStart(2, "0") : "01";

  if (!year) return "Unknown";
  return `${year}-${mm}-${dd}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthName(month: string): number | undefined {
  const idx = MONTHS.indexOf(month.toLowerCase().slice(0, 3));
  return idx >= 0 ? idx : undefined;
}

function extractAbstract(abstractData: any): string {
  if (!abstractData) return "";
  const sections = Array.isArray(abstractData) ? abstractData : [abstractData];
  const parts = sections
    .map((section: any) => {
      const label = typeof section?.["@_Label"] === "string" ? section["@_Label"] : "";
      const body = text(section);
      return label ? `${label}: ${body}` : body;
    })
    .filter(Boolean);
  return sanitize(parts.join(" "));
}

export function dateBounds(dateRange?: string): { minDate?: string; maxDate?: string } {
  if (!dateRange || dateRange === "all") return {};
  const now = new Date();
  const min = new Date(now);
  switch (dateRange) {
    case "week":
      min.setDate(min.getDate() - 7);
      break;
    case "month":
      min.setMonth(min.getMonth() - 1);
      break;
    case "year":
      min.setFullYear(min.getFullYear() - 1);
      break;
    default:
      return {};
  }
  return {
    minDate: formatDateParam(min),
    maxDate: formatDateParam(now),
  };
}

function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}