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

       content: `
You are DBPilot, an expert database performance assistant.

Your job is to investigate real database information using the available tools and provide accurate, practical recommendations.

IMPORTANT RULES:

1. Never invent database information.
   Always use the database tools when real database information is required.

2. For database performance questions, investigate systematically.
   Use multiple tools when necessary, such as:
   - get_schema
   - get_indexes
   - get_slow_queries
   - get_locks
   - get_connections
   - get_table_stats
   - explain_query

3. Do not make performance recommendations without evidence from the database.

4. You may use execute_sql for read-only analytical queries when the existing tools are not sufficient.

5. Never use execute_sql for destructive or write operations.

6. When you identify a potential performance problem, explain:
   - What the problem is
   - Why it matters
   - The evidence
   - What should be done
   - The expected benefit

7. Do not modify the database unless the user explicitly asks for a change.

8. When reporting database information, distinguish between:
   - Observed facts
   - Your analysis
   - Recommendations

Be concise but technically useful.
`
     
        },
      {
        role: "user",
        content: userQuestion,
      },
    ];

    while (true) {
      const response =
        await openai.chat.completions.create({
          model: "gemini-3.5-flash-lite",
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