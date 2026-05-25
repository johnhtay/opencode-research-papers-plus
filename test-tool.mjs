import { createResearchPapersTool } from "./dist/tools/research_papers.js";

async function test() {
  const tool = createResearchPapersTool();
  console.log("Testing research_papers tool...");
  try {
    const result = await tool.execute({
      query: "Image Segmentation",
      source: "both",
      filter: "latest",
      max_results: 5,
    }, { sessionID: "test", messageID: "test", agent: "test", directory: ".", worktree: ".", abort: new AbortController().signal, metadata: () => {}, ask: async () => {} });
    console.log("\n--- RESULT ---\n");
    console.log(result);
  } catch (e) {
    console.error("Tool error:", e);
  }
}

test();
