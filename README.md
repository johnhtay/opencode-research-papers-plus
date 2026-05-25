# opencode-research-papers

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool, letting you discover the latest, trending, and top-cited research papers from **arXiv** and **Semantic Scholar** by simply describing a computer science field.

## Features

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
  "default_max_results": 15,
  "default_source": "both",
  "arxiv_rate_limit_ms": 3000,
  "cache_ttl_minutes": 60
}]
```

| Option | Default | Description |
|--------|---------|-------------|
| `default_max_results` | `10` | Default result cap |
| `default_source` | `"both"` | Default data source (`arxiv`, `semantic_scholar`, `both`) |
| `arxiv_rate_limit_ms` | `3000` | Delay between arXiv API calls |
| `cache_ttl_minutes` | `60` | How long to cache API responses |

## Data Sources

### arXiv
Uses the [arXiv Atom API](http://export.arxiv.org/api/query) to search by keyword and sort by submission date.

### Semantic Scholar
Uses the [Semantic Scholar Graph API](https://api.semanticscholar.org/) to search with citation counts and open-access PDF links.

## Error Handling

If one source is unavailable, the plugin gracefully falls back to the other and includes a warning note in the output.

## License

MIT
