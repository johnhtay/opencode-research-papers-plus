# opencode-research-papers

[![OpenCode plugin](https://img.shields.io/badge/OpenCode-plugin-blue.svg)](https://opencode.ai/docs/plugins/)
[![npm version](https://img.shields.io/npm/v/opencode-research-papers.svg)](https://www.npmjs.com/package/opencode-research-papers)
[![CI](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml/badge.svg)](https://github.com/saim-x/opencode-research-papers/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![screenshot](./src/screenshots/screenshot.jpg)

An [opencode](https://opencode.ai) plugin that adds a `research_papers` tool. You do not type a slash command — you ask the AI naturally and it calls the tool for you.

Install. Restart. Ask for papers. It works.

## Features

- No API keys needed. arXiv covers fresh preprints, OpenAlex covers broader scholarly metadata, citation counts, and open-access links.
- Smart source routing — arXiv for `latest` papers, OpenAlex for `top_cited` and `trending`. Both run together with duplicates merged.
- Markdown output with title, authors, date, PDF link, abstract, and citation counts where available.
- Filter by recency (`latest`, `trending`) or citation impact (`top_cited`).
- Narrow results to the past week, month, or year.
- `strict` mode uses anchor + concept-group filtering to cut down loosely matched results.
- If one source goes down or gets rate-limited, the other keeps going.
- arXiv requests are spaced 3 seconds apart to respect their public API terms.

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

Opencode caches plugin packages and does not pull new versions on restart. After updating, clear the cache first:

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\opencode-research-papers@latest"
```

**macOS / Linux:**
```bash
rm -rf ~/.cache/opencode/packages/opencode-research-papers@latest
```

Then restart opencode.

## Usage

This is a tool the AI calls — you do not invoke it directly. Just ask naturally:

> "Find the latest papers on Image Segmentation"

> "Show me trending Scene Text Recognition papers"

> "Get top-cited Retinal Vessel Segmentation papers"

> "Find 20 latest papers on Generative Adversarial Networks from the last month"

## Configuration

Options as a tuple:

```json
["opencode-research-papers", {
  "defaultMaxResults": 15,
  "defaultSource": "auto"
}]
```

| Option | Default | What it does |
|--------|---------|-------------|
| `defaultMaxResults` | `10` | How many results to return (1 to 50) |
| `defaultSource` | `"auto"` | Source: `auto`, `arxiv`, or `openalex` |

### Source routing

The `auto` default picks the best source for each filter:

| Filter | Primary | Fallback |
|--------|---------|----------|
| `latest` | arXiv | OpenAlex |
| `top_cited` | OpenAlex | arXiv |
| `trending` | OpenAlex | arXiv |

Force a single source with `source: "arxiv"` or `source: "openalex"`.

## Data Sources

### arXiv

Fresh preprints in AI, CS, math, and physics. Direct PDF links, clean metadata, no signup required. The plugin spaces out requests to respect arXiv's public API terms.

### OpenAlex

Broader scholarly search — citation counts, DOI metadata, open-access links. Works at 10 requests per second with no API key.

## Error Handling

If one source is down or rate-limited, the plugin shows what the other returned and tells you which error occurred. If both fail, you get one consolidated message. Nothing crashes.

## License

MIT

## Roadmap

Things I might add eventually:

- **GitHub paper-list repos** — Find curated repository lists on a topic (e.g. `scene-text-detection-recognition-papers`) alongside paper results. Useful for community-maintained collections.
- **Better deduplication** — Title normalization is rough; something smarter could avoid showing the same paper twice.
- **Synonym expansion** — Query expansion for common terms (GAN → cGAN, WGAN, StyleGAN) to improve recall in `strict` mode.
- **Semantic strict mode** — Use embeddings or cross-encoder reranking instead of keyword matching for better relevance filtering.
- **Citation counts for arXiv papers** — Cross-reference arXiv results with OpenAlex to pull citation data.