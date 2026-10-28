
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ToolDefinition } from "./toolTypes.js";
import type { MigrationAnalysis } from "../migration/MigrationAnalyzer.js";

import { analyzeMigration } from "../migration/MigrationAnalyzer.js";
import { createMigrationPlan } from "../migration/MigrationPlanner.js";
import { generateMigrationSql } from "../migration/MigrationSQLGenerator.js";

async function collectMigrationAnalysis(
  context: Parameters<ToolDefinition["execute"]>[1]
): Promise<MigrationAnalysis> {
  const tables = await context.migration.getTables();

  const schemas = new Map();
  const indexes = new Map();
  const foreignKeys = new Map();
  const primaryKeys = new Map();
  const uniqueConstraints = new Map();

  for (const tableName of tables) {
    const [
      schema,
      tableIndexes,
      tableForeignKeys,
      tablePrimaryKey,
      tableUniqueConstraints,
    ] = await Promise.all([
      context.migration.getTableSchema(tableName),
      context.migration.getIndexes(tableName),
      context.migration.getForeignKeys(tableName),
      context.migration.getPrimaryKey(tableName),
      context.migration.getUniqueConstraints(tableName),
    ]);

    schemas.set(tableName, schema);
    indexes.set(tableName, tableIndexes);
    foreignKeys.set(tableName, tableForeignKeys);
    primaryKeys.set(tableName, tablePrimaryKey);
    uniqueConstraints.set(tableName, tableUniqueConstraints);
  }

  return analyzeMigration(
    tables,
    schemas,
    indexes,
    foreignKeys,
    primaryKeys,
    uniqueConstraints
  );
}

function createMigrationReport(
  analysis: MigrationAnalysis,
  plan: ReturnType<typeof createMigrationPlan>,
  sqlWarnings: string[]
): string {
  const tableOrder = plan.tableCreationOrder
    .map((table, index) => `${index + 1}. \`${table}\``)
    .join("\n");

  const conversions = plan.columnConversions
    .map(
      (column) =>
        `| \`${column.tableName}.${column.columnName}\` | \`${column.mysqlType}\` | \`${column.postgresqlType}\` | ${column.nullable ? "Yes" : "No"} |`
    )
    .join("\n");

  const allWarnings = [
    ...new Set([
      ...plan.warnings,
      ...sqlWarnings,
    ]),
  ];

  const warningSection = allWarnings.length
    ? allWarnings.map((warning) => `- ${warning}`).join("\n")
    : "- No warnings were reported by the analyzer or SQL generator.";

  const manualActions = plan.manualActions.length
    ? plan.manualActions.map((action) => `- ${action}`).join("\n")
    : "- No manual actions were reported by the planner.";

  return `# DBPilot Migration Report

## Overview

- Source: ${analysis.sourceDatabase}
- Target: ${analysis.targetDatabase}
- Tables: ${analysis.summary.totalTables}
- Columns: ${analysis.summary.totalColumns}
- Circular dependencies detected: ${plan.summary.hasCircularDependencies ? "Yes" : "No"}

## Table Creation Order

${tableOrder || "No tables found."}

## Column Conversions

| Column | MySQL Type | PostgreSQL Type | Nullable |
|---|---|---|---|
${conversions || "| No columns | — | — | — |"}

## Migration Phases

${plan.phases
  .map(
    (phase) =>
      `### Phase ${phase.phase}: ${phase.name}\n\n${
        phase.tasks.length
          ? phase.tasks.map((task) => `- ${task}`).join("\n")
          : "- No tasks."
      }`
  )
  .join("\n\n")}

## Warnings

${warningSection}

## Manual Review Actions

${manualActions}

## Important

This report and the generated SQL are migration artifacts only.
Review the SQL and warnings, test against a disposable PostgreSQL
database, and verify data and constraints before any production use.
No SQL was executed by this export operation.
`;
}

export const analyzeMigrationTool: ToolDefinition = {
  name: "analyze_migration",

  description:
    "Analyze the current MySQL database for PostgreSQL migration compatibility, including tables, columns, data types, indexes, primary keys, foreign keys, unique constraints, and warnings.",

  riskLevel: "read",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return collectMigrationAnalysis(context);
  },
};

export const createMigrationPlanTool: ToolDefinition = {
  name: "create_migration_plan",

  description:
    "Create an ordered, read-only MySQL-to-PostgreSQL migration plan using actual schema metadata, including column conversions, dependencies, constraints, indexes, warnings, and manual review actions.",

  riskLevel: "read",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    const analysis = await collectMigrationAnalysis(context);
    return createMigrationPlan(analysis);
  },
};

export const exportMigrationArtifactsTool: ToolDefinition = {
  name: "export_migration_artifacts",

  description:
    "Generate PostgreSQL migration SQL, a JSON migration plan, and a Markdown report from the current MySQL schema. Save the files locally in the dbpilot-migration directory inside the current project. Do not execute SQL against any database.",

  riskLevel: "write",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    const analysis = await collectMigrationAnalysis(context);
    const plan = createMigrationPlan(analysis);
    const sqlResult = generateMigrationSql(analysis, plan);

    const outputDirectory = resolve(
      process.cwd(),
      "dbpilot-migration"
    );

    await mkdir(outputDirectory, { recursive: true });

    const report = createMigrationReport(
      analysis,
      plan,
      sqlResult.warnings
    );

    const sqlPath = resolve(outputDirectory, "migration.sql");
    const planPath = resolve(outputDirectory, "migration-plan.json");
    const reportPath = resolve(outputDirectory, "migration-report.md");

    await Promise.all([
      writeFile(sqlPath, sqlResult.sql, "utf8"),
      writeFile(
        planPath,
        JSON.stringify(
          {
            ...plan,
            sqlWarnings: sqlResult.warnings,
          },
          null,
          2
        ),
        "utf8"
      ),
      writeFile(reportPath, report, "utf8"),
    ]);

    return {
      message: "Migration artifacts generated successfully.",
      outputDirectory,
      files: [
        sqlPath,
        planPath,
        reportPath,
      ],
      tables: analysis.summary.totalTables,
      columns: analysis.summary.totalColumns,
      warningCount: sqlResult.warnings.length,
      executedAgainstPostgreSQL: false,
    };
  },
};

export const migrationTools: ToolDefinition[] = [
  analyzeMigrationTool,
  createMigrationPlanTool,
  exportMigrationArtifactsTool,
];
