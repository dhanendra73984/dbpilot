import { openai } from "./openaiClient.js";
import { convertToolsForOpenAI } from "./openaiTools.js";
import { ToolRegistry } from "./toolRegistry.js";

import type { ToolContext } from "../tools/toolTypes.js";
import type { ToolDefinition } from "../tools/toolTypes.js";

export class DatabaseAgent {
  private readonly tools;
  private readonly toolRegistry;

  constructor(
    tools: ToolDefinition[],
    private readonly context: ToolContext
  ) {
    this.tools = convertToolsForOpenAI(tools);
    this.toolRegistry = new ToolRegistry(tools);
  }

  async run(userQuestion: string): Promise<string> {
    const messages: any[] = [
      {
        role: "system",
        content:
          "You are DBPilot, a database performance assistant. Use the available database tools when you need real database information. Analyze the database carefully and provide clear, practical answers.",
      },
      {
        role: "user",
        content: userQuestion,
      },
    ];

    while (true) {
      const response =
        await openai.chat.completions.create({
          model: "gemini-3.7-flash",
          messages,
          tools: this.tools,
          tool_choice: "auto",
        });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error(
          "Gemini returned an empty response"
        );
      }

      if (!message.tool_calls?.length) {
        return message.content ?? "";
      }

      messages.push(message);

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }

        const toolName = toolCall.function.name;

        const toolArguments = JSON.parse(
          toolCall.function.arguments
        );

        console.log(
          `\n🔧 ${toolName}(${JSON.stringify(toolArguments)})`
        );

        const tool =
          this.toolRegistry.getTool(toolName);

        const result = await tool.execute(
          toolArguments,
          this.context
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }
  }
}