# opencode-research-papers

[![OpenCode plugin](https://img.shields.io/badge/OpenCode-plugin-blue.svg)](https://opencode.ai/docs/plugins/)
[![npm version](https://img.shields.io/npm/v/opencode-research-papers.svg)](https://www.npmjs.com/package/opencode-research-papers)
[![CI](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml/badge.svg)](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![screenshot](./src/screenshots/screenshot.jpg)

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool. This is an AI-facing tool, not a slash command — ask the AI to search for papers and it will call the tool for you.

Install. Restart. Ask for papers. It works.

## Features

- No API keys required. Uses arXiv for fresh preprints and OpenAlex for broader scholarly metadata, citation counts, and open-access links.
- Smart `auto` source routing — arXiv for `latest`, OpenAlex for `top_cited` and `trending`, both merged when available.
- Output is markdown with title, authors, date, PDF link, abstract, and citation count where available.
- Filter by `latest`, `trending`, or `top_cited`.
- Narrow results to the past week, month, or year — uses server-side filtering where the API supports it, with client-side fallback.
- `strict` mode applies anchor + concept-group filtering to reduce loosely matched results.
- Respects arXiv's rate limit (one request per 3 seconds).
- Source routing with fallback: if one source fails or is rate-limited, the other handles the request transparently.

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

### Updating

Opencode caches plugin packages and does not auto-update them on restart. When a new version is published, clear the cache before restarting:

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\opencode-research-papers@latest"
```

**macOS / Linux:**
```bash
rm -rf ~/.cache/opencode/packages/opencode-research-papers@latest
```

Then restart opencode and it will pull the latest version.

## Usage

This is an AI tool — you don't type `/research-papers`. Instead, ask the AI naturally:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

## Configuration

You can pass options as a tuple:

```json
["opencode-research-papers", {
  "defaultMaxResults": 15,
  "defaultSource": "auto"
}]
```

| Option | Default | What it does |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | How many results to return (1 to 50) |
| `defaultSource` | `"auto"` | Source routing: `auto`, `arxiv`, or `openalex` |

### Source routing

The `auto` default picks the best source for each filter:

| Filter | Primary source | Fallback |
|--------|---------------|----------|
| `latest` | arXiv | OpenAlex |
| `top_cited` | OpenAlex | arXiv |
| `trending` | OpenAlex | arXiv |

You can override with `source: "arxiv"` or `source: "openalex"` to force a single source.

## Data Sources

### arXiv

Used for fresh preprints, especially AI, CS, math, and physics. Provides direct PDF links and clean metadata. No signup required. The plugin enforces arXiv's public API rate limit of one request per 3 seconds.

### OpenAlex

Used for broader scholarly search, citation counts, DOI metadata, and open-access links. Basic search works without an API key at 10 requests per second.

## Error Handling

If one source is down or rate limited, the plugin shows what the other source returned along with the specific HTTP error. If both fail, you get a single consolidated message. No crashes.

## License

MIT

## Roadmap

Potential future additions (no timeline committed):

- **GitHub paper-list repos**: Search for curated repository lists (e.g. `scene-text-detection-recognition-papers`) alongside paper results — useful for finding community-maintained paper collections on a topic.
- **Duplicate detection**: Deduplicate papers that appear in both arXiv and OpenAlex results more intelligently than title normalization.
- **Synonym expansion**: Expand query terms (e.g. GAN → cGAN, WGAN, StyleGAN) for stricter query matching.
- **Semantic similarity scoring**: Use embeddings or cross-encoder reranking for stricter mode instead of keyword matching.
- **OpenAlex abstract retrieval for arXiv IDs**: Cross-reference arXiv papers with OpenAlex to get citation counts for arXiv-sourced results.
