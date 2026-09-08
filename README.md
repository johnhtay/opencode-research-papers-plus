# opencode-research-papers-plus

[![OpenCode plugin](https://img.shields.io/badge/OpenCode-plugin-blue.svg)](https://opencode.ai/docs/plugins/)
[![npm version](https://img.shields.io/npm/v/opencode-research-papers-plus.svg)](https://www.npmjs.com/package/opencode-research-papers-plus)
[![CI](https://github.com/johnhtay/opencode-research-papers-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/johnhtay/opencode-research-papers-plus/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![screenshot](./src/screenshots/screenshot.jpg)

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool. This is an AI-facing tool, not a slash command — ask the AI to search for papers and it will call the tool for you.

This is a fork of [opencode-research-papers](https://github.com/saim-x/opencode-research-papers) by [saim-x](https://github.com/saim-x), extended with bioRxiv/medRxiv preprints and PubMed biomedical literature. See [Credits](#credits).

Install. Restart. Ask for papers. It works.

## Features

- No API keys required. Uses arXiv for fresh CS/physics preprints, OpenAlex for broader scholarly metadata, bioRxiv for biology/health preprints, and PubMed for biomedical literature.
- Smart `auto` source routing — arXiv + OpenAlex + PubMed for `latest`, OpenAlex + PubMed for `top_cited` and `trending`.
- Markdown output with title, authors, date, journal, DOI, PMID, PDF link, abstract, and citation count where available.
- Filter by recency (`latest`, `trending`) or citation impact (`top_cited`).
- Narrow results to the past week, month, or year.
- `strict` mode applies anchor + concept-group filtering to reduce loosely matched results.
- Source-level fallback: if one source fails or is rate-limited, the others handle the request transparently.
- arXiv requests are spaced 3 seconds apart per arXiv's public API terms; NCBI E-utilities (PubMed) requests are spaced to respect the 3 req/s limit.

## Installation

Add this to your `opencode.json`:

```json
{
  "plugin": [
    "opencode-research-papers-plus"
  ]
}
```

Restart opencode. The tool registers automatically.

### Updating

OpenCode caches plugin packages and does not auto-update on restart. After updating to a new version, clear the cache before restarting:

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\opencode-research-papers-plus@latest"
```

**macOS / Linux:**
```bash
rm -rf ~/.cache/opencode/packages/opencode-research-papers-plus@latest
```

Then restart opencode.

## Usage

This is an AI tool — you do not invoke it with a slash command. Ask naturally:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

> "Find recent bioRxiv preprints on SARS-CoV-2 evolution"

> "Search PubMed for the latest papers on CRISPR base editing"

## Configuration

Pass options as a tuple:

```json
["opencode-research-papers-plus", {
  "defaultMaxResults": 15,
  "defaultSource": "auto"
}]
```

| Option | Default | Description |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | How many results to return (1–50) |
| `defaultSource` | `"auto"` | Source routing: `auto`, `arxiv`, `openalex`, `biorxiv`, or `pubmed` |
| `pubmedEmail` | — | Optional contact email sent to NCBI E-utilities as client identification |

### Source routing

The `auto` default selects the primary sources per filter:

| Filter | Sources (in merge priority order) |
|--------|-----------------------------------|
| `latest` | arXiv → OpenAlex → PubMed |
| `top_cited` | OpenAlex → PubMed |
| `trending` | OpenAlex → PubMed |

Override with `source: "arxiv"`, `"openalex"`, `"biorxiv"`, or `"pubmed"` to use a single source. `biorxiv` is only available via explicit selection — use it for biology and health-science preprint searches.

## Data Sources

### arXiv

Provides fresh preprints across AI, CS, math, and physics. Delivers direct PDF links and clean metadata. No signup required. Requests are rate-limited to one per 3 seconds per arXiv's public API terms.

### OpenAlex

Broader scholarly search with citation counts, DOI metadata, and open-access links. Works without an API key at 10 requests per second.

### bioRxiv (and medRxiv)

Biology and health-science preprints from Cold Spring Harbor's servers. Implemented on top of OpenAlex, restricted to the bioRxiv and medRxiv repositories, so keyword search, abstracts, and citation counts all work. Results from medRxiv are labeled `medRxiv`; everything else is labeled `bioRxiv`.

### PubMed

Biomedical literature via NCBI's E-utilities (ESearch + EFetch). Supports keyword search with native date filtering. Citation counts are not available from PubMed, so `top_cited` and `trending` fall back to relevance sorting. PDF links resolve to PubMed Central when available, otherwise the DOI. Requests are throttled to respect NCBI's 3 requests/second guideline.

## Error Handling

If one source is down or rate-limited, the plugin returns the remaining sources' results with the specific error noted. If all requested sources fail, you receive a consolidated error message. The tool does not crash.

## Credits

This project is a fork of [opencode-research-papers](https://github.com/saim-x/opencode-research-papers) by [Muhammad Saim](https://github.com/saim-x), which provides the core `research_papers` tool, the arXiv and OpenAlex integrations, auto source routing, strict-mode filtering, and the release tooling. Many thanks for the solid foundation.

This fork adds:

- **bioRxiv and medRxiv preprints** — OpenAlex-backed search restricted to the Cold Spring Harbor preprint servers
- **PubMed** — biomedical literature via NCBI E-utilities (ESearch + EFetch)
- N-source routing with per-source error isolation, DOI-first cross-source deduplication
- Journal, DOI, and PMID fields in results, with an optional `pubmedEmail` for NCBI client identification

Both projects are MIT-licensed.

## License

MIT — see [LICENSE](./LICENSE). Original work Copyright (c) 2026 Muhammad Saim. Fork modifications Copyright (c) 2026 John H. Tay.

## Roadmap

Potential future additions:

- **GitHub paper-list repos** — Search curated repository lists (e.g. `scene-text-detection-recognition-papers`) alongside paper results.
- **Citation counts for PubMed** — Cross-reference PubMed results with OpenAlex via batch DOI lookup to enrich citation data and support `top_cited`.
- **Native bioRxiv mode** — Direct api.biorxiv.org queries for freshest preprints (the official API lacks keyword search, so this would be date-window based with local filtering).
- **Better deduplication** — Title normalization is a rough heuristic; smarter deduplication could avoid showing the same paper twice.
- **Synonym expansion** — Expand common terms in strict mode (e.g. GAN → cGAN, WGAN, StyleGAN) to improve recall.
- **Semantic strict mode** — Use embeddings or cross-encoder reranking instead of keyword matching for relevance filtering.
- **Citation counts for arXiv papers** — Cross-reference arXiv results with OpenAlex to retrieve citation data.