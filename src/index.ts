import type { Plugin } from "@opencode-ai/plugin";
import { createResearchPapersTool } from "./tools/research_papers.js";
import type { PluginOptions } from "./types.js";

const plugin: Plugin = async (input, options?: PluginOptions) => {
  return {
    tool: {
      research_papers: createResearchPapersTool(options),
    },
  };
};

export default plugin;
