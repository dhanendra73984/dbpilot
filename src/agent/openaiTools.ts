import type { ToolDefinition } from "../tools/toolTypes.js";

export function convertToolsForOpenAI(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,

    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}