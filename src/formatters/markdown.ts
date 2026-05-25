import type { PaperResult } from "../types.js";

export function formatResults(
  query: string,
  filter: string,
  results: PaperResult[],
  dateRange?: string
): string {
  if (results.length === 0) {
    const dateMsg = dateRange && dateRange !== "all" ? ` from the past ${dateRange}` : "";
    return `No research papers found for **${query}**${dateMsg} with filter **${filter}**. Try broadening your query or changing the time range.`;
  }

  const lines: string[] = [];
  lines.push(`## Research Papers: ${query}`);
  lines.push("");
  const filterLine = dateRange && dateRange !== "all"
    ? `**Filter:** ${filter} | **Range:** past ${dateRange} | **Results:** ${results.length}`
    : `**Filter:** ${filter} | **Results:** ${results.length}`;
  lines.push(filterLine);
  lines.push("");

  for (let i = 0; i < results.length; i++) {
    const paper = results[i];
    lines.push(`### ${i + 1}. ${paper.title}`);
    lines.push("");

    const authorText =
      paper.authors.length > 3
        ? `${paper.authors.slice(0, 3).join(", ")}, et al.`
        : paper.authors.join(", ");

    lines.push(`- **Authors:** ${authorText || "N/A"}`);
    lines.push(`- **Published:** ${paper.published}`);
    lines.push(`- **Source:** ${paper.source}`);
    if (paper.citations !== undefined) {
      lines.push(`- **Citations:** ${paper.citations}`);
    }
    if (paper.arxivId) {
      lines.push(`- **arXiv ID:** ${paper.arxivId}`);
    }
    if (paper.pdfUrl) {
      lines.push(`- **PDF:** ${paper.pdfUrl}`);
    }
    if (paper.codeUrl) {
      lines.push(`- **Code:** ${paper.codeUrl}`);
    }
    if (paper.abstract) {
      const snippet =
        paper.abstract.length > 300
          ? paper.abstract.slice(0, 300) + "..."
          : paper.abstract;
      lines.push(`- **Abstract:** ${snippet}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
