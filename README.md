# opencode-research-papers

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool. Describe a computer science field and it pulls the latest, trending, or most cited papers from arXiv and Semantic Scholar.

## Features

- No API keys needed. Both sources have free, public search endpoints.
- Asks both arXiv and Semantic Scholar at the same time and merges the results, skipping duplicates.
- Output is markdown with title, authors, date, PDF link, abstract, and citation count where available.
- Filter by `latest`, `trending`, or `top_cited`.
- Narrow results to the past week, month, or year.

## Installation

Add this to your `opencode.json`:

```json
{
  "plugin": [
    "opencode-research-papers"
  ]
}
```

Restart opencode. The `research_papers` tool should show up in your tool list.

## Usage

Try something like:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers from arXiv only"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

## Configuration

You can pass options as a tuple:

```json
["opencode-research-papers", {
  "defaultMaxResults": 15,
  "defaultSource": "both"
}]
```

| Option | Default | What it does |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | How many results to return (1 to 50) |
| `defaultSource` | `"both"` | Which source to search (`arxiv`, `semantic_scholar`, `both`) |

## Data Sources

### arXiv

Uses the public [arXiv Atom API](http://export.arxiv.org/api/query). Searches by keyword and sorts by submission date. No signup required.

### Semantic Scholar

Uses the public [Semantic Scholar Graph API](https://api.semanticscholar.org/). Returns citation counts and open-access PDF links where the data is available.

The unauthenticated endpoint has a tight rate limit. If you start seeing 429 errors, you can get a free API key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api).

## Error Handling

If one source is down or rate limited, the plugin shows what the other source returned and adds a note at the bottom. No crashes, no dropped responses.

## License

MIT
