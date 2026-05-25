# opencode-research-papers

[![OpenCode plugin](https://img.shields.io/badge/OpenCode-plugin-blue.svg)](https://opencode.ai/docs/plugins/)
[![npm version](https://img.shields.io/npm/v/opencode-research-papers.svg)](https://www.npmjs.com/package/opencode-research-papers)
[![CI](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml/badge.svg)](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub tag](https://img.shields.io/github/v/tag/saim-x/opencode-research-papers.svg)](https://github.com/saim-x/opencode-research-papers/tags)

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool. This is an AI-facing tool, not a slash command — ask the AI to search for papers and it will call the tool for you.

## Features

- No API keys needed. Both sources have free, public search endpoints.
- Queries arXiv and Semantic Scholar in parallel and merges results, skipping duplicates.
- Output is markdown with title, authors, date, PDF link, abstract, and citation count where available.
- Filter by `latest`, `trending`, or `top_cited`.
- Narrow results to the past week, month, or year (client-side filtering).
- Retries with exponential backoff when Semantic Scholar rate-limits.

## Installation

Add this to your `opencode.json`:

```json
{
  "plugin": [
    "opencode-research-papers"
  ]
}
```

Restart opencode. The tool registers automatically.

## Usage

This is an AI tool — you don't type `/research-papers`. Instead, ask the AI naturally:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers from arXiv only"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

## Configuration

You can pass options as a tuple:

```json
["opencode-research-papers", {
  "defaultMaxResults": 15,
  "defaultSource": "both",
  "semanticScholarApiKey": "your-api-key-here"
}]
```

| Option | Default | What it does |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | How many results to return (1 to 50) |
| `defaultSource` | `"both"` | Which source to search (`arxiv`, `semantic_scholar`, `both`) |
| `semanticScholarApiKey` | — | Free API key from semanticscholar.org — bypasses the rate limit |

## Data Sources

### arXiv

Uses the public [arXiv Atom API](http://export.arxiv.org/api/query). Searches by keyword and sorts by submission date. No signup required.

### Semantic Scholar

Uses the public [Semantic Scholar Graph API](https://api.semanticscholar.org/). Returns citation counts and open-access PDF links where the data is available.

The free tier has a tight rate limit (1 req/s). If you see frequent 429 errors, get a free API key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api) and pass it via the `semanticScholarApiKey` config option. With an API key the limit jumps to 100 req/s.

## Error Handling

If one source is down or rate limited, the plugin shows what the other source returned along with the specific HTTP error (e.g., `Semantic Scholar API 429: Too Many Requests`). If both fail, you get a single consolidated message with the error from each. No crashes, no dropped responses.

Semantic Scholar returns 429s aggressively on the free tier. The plugin retries up to two times with a 1s/2s backoff, but heavy usage will still hit the limit.

## License

MIT
