import { describe, it, expect } from "vitest";
import {
  expandAcronym,
  extractSignificantTerms,
  buildArxivSearchQuery,
  buildOpenAlexSearchQuery,
  getSearchTerms,
} from "../utils/query.js";

describe("expandAcronym", () => {
  it("expands MTP", () => {
    expect(expandAcronym("MTP")).toBe("multi-token prediction");
  });

  it("expands LLMs", () => {
    expect(expandAcronym("LLMs")).toBe("large language models");
  });

  it("is case-insensitive", () => {
    expect(expandAcronym("mtp")).toBe("multi-token prediction");
    expect(expandAcronym("llm")).toBe("large language model");
  });

  it("returns unknown terms unchanged", () => {
    expect(expandAcronym("transformer")).toBe("transformer");
  });
});

describe("extractSignificantTerms", () => {
  it("removes stop words", () => {
    expect(extractSignificantTerms("MTP in LLMs")).toEqual(["mtp", "llms"]);
  });

  it("ignores punctuation", () => {
    expect(extractSignificantTerms("GANs, and VAEs!")).toEqual(["gans", "vaes"]);
  });

  it("filters out short tokens", () => {
    expect(extractSignificantTerms("a an the in on")).toEqual([]);
  });
});

describe("buildArxivSearchQuery", () => {
  it("builds OR query for significant terms", () => {
    const q = buildArxivSearchQuery("deep learning");
    expect(q).toBe("all:deep OR all:learning");
  });

  it("expands acronyms and includes hyphenated variants", () => {
    const q = buildArxivSearchQuery("MTP in LLMs");
    expect(q).toContain('all:"multi-token prediction"');
    expect(q).toContain('all:"multi-token-prediction"');
    expect(q).toContain("all:mtp");
    expect(q).toContain('all:"large language models"');
    expect(q).toContain("all:llms");
  });

  it("falls back to phrase query when no significant terms", () => {
    const q = buildArxivSearchQuery("a an the");
    expect(q).toBe('all:"a an the"');
  });
});

describe("buildOpenAlexSearchQuery", () => {
  it("expands acronyms for OpenAlex", () => {
    const q = buildOpenAlexSearchQuery("MTP in LLMs");
    expect(q).toBe("multi-token prediction large language models");
  });

  it("keeps non-acronym terms as-is", () => {
    const q = buildOpenAlexSearchQuery("deep learning");
    expect(q).toBe("deep learning");
  });
});

describe("getSearchTerms", () => {
  it("returns both original and expanded terms", () => {
    const terms = getSearchTerms("MTP in LLMs");
    expect(terms).toContain("mtp");
    expect(terms).toContain("multi-token prediction");
    expect(terms).toContain("llms");
    expect(terms).toContain("large language models");
  });

  it("deduplicates terms", () => {
    const terms = getSearchTerms("deep learning deep");
    expect(terms).toEqual(["deep", "learning"]);
  });
});
