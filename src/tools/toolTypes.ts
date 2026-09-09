import type { DatabaseAdapter } from "../database/DatabaseAdapter.js";

export interface ToolContext {
  db: DatabaseAdapter;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    context: ToolContext
  ) => Promise<unknown>;
}