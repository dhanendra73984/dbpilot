import type { ToolDefinition } from "./toolTypes.js";

import {
  analyzeMigration,
} from "../migration/MigrationAnalyzer.js";

export const analyzeMigrationTool: ToolDefinition = {
  name: "analyze_migration",

  description:
    "Analyze the current MySQL database for migration to PostgreSQL. Inspect tables, columns, data types, indexes, primary keys, foreign keys, unique constraints, and identify compatibility issues and migration warnings.",

  riskLevel: "read",

  parameters: {
    type: "object",

    properties: {},

    additionalProperties: false,
  },

  async execute(_args, context) {
    const tables =
      await context.migration.getTables();

    const schemas =
      new Map();

    const indexes =
      new Map();

    const foreignKeys =
      new Map();

    const primaryKeys =
      new Map();

    const uniqueConstraints =
      new Map();

    for (const tableName of tables) {
      const [
        schema,
        tableIndexes,
        tableForeignKeys,
        tablePrimaryKey,
        tableUniqueConstraints,
      ] = await Promise.all([
        context.migration.getTableSchema(
          tableName
        ),

        context.migration.getIndexes(
          tableName
        ),

        context.migration.getForeignKeys(
          tableName
        ),

        context.migration.getPrimaryKey(
          tableName
        ),

        context.migration.getUniqueConstraints(
          tableName
        ),
      ]);

      schemas.set(
        tableName,
        schema
      );

      indexes.set(
        tableName,
        tableIndexes
      );

      foreignKeys.set(
        tableName,
        tableForeignKeys
      );

      primaryKeys.set(
        tableName,
        tablePrimaryKey
      );

      uniqueConstraints.set(
        tableName,
        tableUniqueConstraints
      );
    }

    return analyzeMigration(
      tables,
      schemas,
      indexes,
      foreignKeys,
      primaryKeys,
      uniqueConstraints
    );
  },
};

export const migrationTools: ToolDefinition[] = [
  analyzeMigrationTool,
];