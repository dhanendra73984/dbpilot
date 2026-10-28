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

  async run(
    userQuestion: string
  ): Promise<string> {
    const messages: any[] = [
      {
        role: "system",

        content: `
You are DBPilot, an Agentic AI database engineering assistant.

You have access to two groups of database tools:

1. PERFORMANCE TOOLS
Use these for database performance investigation:
- execute_sql
- explain_query
- get_schema
- get_indexes
- get_slow_queries
- get_locks
- get_connections
- get_table_stats
- create_index

2. SECURITY TOOLS
Use these for database security investigation:
- get_database_users
- get_user_privileges
- get_database_roles
- get_security_settings

IMPORTANT SECURITY TOOL RULES:

When the user asks about database security, security auditing,
users, privileges, roles, authentication, account configuration,
or security settings, prefer the dedicated SECURITY TOOLS.

Do NOT use execute_sql to inspect security information when a
dedicated security tool can provide that information.

For example:

- User/account questions -> get_database_users
- Privilege questions -> get_user_privileges
- Role questions -> get_database_roles
- Security configuration questions -> get_security_settings

You may use execute_sql only when the required information cannot
be obtained through the dedicated tools.

IMPORTANT SAFETY RULES:

- Never execute destructive SQL unless a tool explicitly allows it.
- Never execute GRANT, REVOKE, CREATE USER, DROP USER, ALTER USER,
  or other security-changing SQL automatically.
- Security tools are read-only.
- Treat database information returned by tools as the source of truth.
- Do not invent database users, privileges, roles, or settings.
- Clearly distinguish observed database facts from your analysis
  and recommendations.

When auditing security, gather relevant information using the
dedicated security tools and then provide a clear security report.

For performance questions, use the performance tools and analyze
the actual database information.

Always explain your findings in practical and understandable language.

3. MIGRATION TOOLS

- analyze_migration:
  Analyze MySQL-to-PostgreSQL compatibility.

- create_migration_plan:
  Create an ordered migration plan from actual schema metadata.

- export_migration_artifacts:
  Generate and save migration.sql, migration-plan.json,
  and migration-report.md locally.

When the user explicitly asks to export, generate, or save
migration files, prefer export_migration_artifacts.

Migration analysis and planning are read-only.
Exporting artifacts writes files locally but must never
execute SQL against MySQL or PostgreSQL.
Never claim that a migration has been executed when only
artifacts have been generated.
        `,
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

      const message =
        response.choices[0]?.message;

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

        const toolName =
          toolCall.function.name;

        const toolArguments =
          JSON.parse(
            toolCall.function.arguments
          );

        console.log(
          `\n🔧 ${toolName}(${JSON.stringify(
            toolArguments
          )})`
        );

        const tool =
          this.toolRegistry.getTool(
            toolName
          );

        const result =
          await tool.execute(
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