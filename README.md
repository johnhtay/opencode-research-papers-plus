# opencode-research-papers

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool, letting you discover the latest, trending, and top-cited research papers from **arXiv** and **Semantic Scholar** by simply describing a computer science field.

## Features

- **Zero API keys required** — both data sources offer free, unauthenticated search endpoints
- **One natural-language command:** *"Find me trending papers on Scene Text Recognition"*
- **Multi-source search:** Queries both arXiv and Semantic Scholar simultaneously
- **Smart merging:** Deduplicates results and surfaces the best papers from each source
- **Structured output:** Clean markdown with title, authors, date, PDF link, abstract snippet, and citation count
- **Flexible filters:** `latest`, `trending`, or `top_cited`
- **Date range filtering:** Restrict to papers from the last week, month, year, or all time

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": [
    "opencode-research-papers"
  ]
}
```

Then **restart opencode** for the plugin to load.

## Usage

Once installed, ask opencode naturally:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers from arXiv only"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

## Configuration

You can pass options via the tuple form in `opencode.json`:

```json
["opencode-research-papers", {
  "defaultMaxResults": 15,
  "defaultSource": "both"
}]
```

| Option | Default | Description |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | Default result cap (1–50) |
| `defaultSource` | `"both"` | Default data source (`arxiv`, `semantic_scholar`, `both`) |

## Data Sources

### arXiv
Uses the public [arXiv Atom API](http://export.arxiv.org/api/query) to search by keyword and sort by submission date. No authentication required.

### Semantic Scholar
Uses the public [Semantic Scholar Graph API](https://api.semanticscholar.org/) to search with citation counts and open-access PDF links. No authentication required for basic usage.

> **Note:** Semantic Scholar's unauthenticated endpoint has a low rate limit. If you see frequent 429 errors, you can request a free API key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api) and the plugin will support it in a future update.

## Error Handling

If one source is unavailable (network error or rate limit), the plugin gracefully falls back to the other and includes a warning note in the output. You will never get a hard crash.

## License

MIT
