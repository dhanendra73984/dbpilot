import type { DatabaseAdapter } from "../database/DatabaseAdapter.js";
import type { SecurityAdapter } from "../security/SecurityAdapter.js";
import type { MigrationAdapter } from "../migration/MigrationAdapter.js";

export interface ToolContext {
  db: DatabaseAdapter;
  security: SecurityAdapter;
  migration: MigrationAdapter;
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