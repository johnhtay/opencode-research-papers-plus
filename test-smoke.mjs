import { searchArxiv } from "./dist/sources/arxiv.js";
import { searchSemanticScholar } from "./dist/sources/semantic-scholar.js";

async function test() {
  console.log("Testing arXiv...");
  try {
    const arxivResults = await searchArxiv("Scene Text Recognition", 3);
    console.log(`arXiv returned ${arxivResults.length} papers`);
    if (arxivResults.length > 0) {
      console.log("First paper:", arxivResults[0].title);
    }
  } catch (e) {
    console.error("arXiv error:", e);
  }

  console.log("\nTesting Semantic Scholar...");
  try {
    const s2Results = await searchSemanticScholar("Scene Text Recognition", 3);
    console.log(`Semantic Scholar returned ${s2Results.length} papers`);
    if (s2Results.length > 0) {
      console.log("First paper:", s2Results[0].title, "Citations:", s2Results[0].citations);
    }
  } catch (e) {
    console.error("Semantic Scholar error:", e);
  }
}

test();
