import type { DatabaseAdapter } from "../database/DatabaseAdapter.js";

export interface ToolContext {
  db: DatabaseAdapter;
}

export type ToolRiskLevel = "read" | "write";

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  parameters: Record<string, unknown>;

  execute: (
    args: Record<string, unknown>,
    context: ToolContext
  ) => Promise<unknown>;
}