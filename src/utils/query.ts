const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "as", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "can", "shall", "and", "or", "but",
  "not", "no", "using", "via", "based", "new", "recent", "latest",
]);

const ACRONYMS: Record<string, string> = {
  mtp: "multi-token prediction",
  llm: "large language model",
  llms: "large language models",
  gan: "generative adversarial network",
  gans: "generative adversarial networks",
  cv: "computer vision",
  nlp: "natural language processing",
  rl: "reinforcement learning",
  vit: "vision transformer",
  vits: "vision transformers",
  bert: "bidirectional encoder representations from transformers",
  gpt: "generative pre-trained transformer",
  cnn: "convolutional neural network",
  cnns: "convolutional neural networks",
  rnn: "recurrent neural network",
  rnns: "recurrent neural networks",
  transformers: "transformer",
  sts: "scene text",
  str: "scene text recognition",
  ocr: "optical character recognition",
  qa: "question answering",
  ml: "machine learning",
  dl: "deep learning",
  ai: "artificial intelligence",
};

export function expandAcronym(term: string): string {
  return ACRONYMS[term.toLowerCase()] ?? term;
}

export function extractSignificantTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function buildArxivSearchQuery(query: string): string {
  const terms = extractSignificantTerms(query);
  if (terms.length === 0) {
    // Fallback to the original trimmed query if no significant terms remain
    return `all:"${query.trim()}"`;
  }

  const clauses: string[] = [];
  for (const term of terms) {
    const expanded = expandAcronym(term);
    if (expanded !== term) {
      // Include both the acronym and its expanded form, plus hyphenated variant
      clauses.push(`all:"${expanded}"`);
      clauses.push(`all:"${expanded.replace(/\s+/g, "-")}"`);
      clauses.push(`all:${term}`);
    } else {
      clauses.push(`all:${term}`);
    }
  }

  return clauses.join(" OR ");
}

export function buildOpenAlexSearchQuery(query: string): string {
  const terms = extractSignificantTerms(query);
  if (terms.length === 0) {
    return query.trim();
  }

  // Replace acronyms with their expanded form for better recall on OpenAlex
  return terms.map((term) => expandAcronym(term)).join(" ");
}

export function getSearchTerms(query: string): string[] {
  const terms = extractSignificantTerms(query);
  const expanded = terms.map((term) => expandAcronym(term));
  return [...new Set([...terms, ...expanded])];
}
