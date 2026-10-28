
import type {
  MigrationAnalysis,
  MigrationTableAnalysis,
} from "./MigrationAnalyzer.js";

import type {
  MigrationPlan,
} from "./MigrationPlanner.js";

export interface MigrationSQLResult {
  sql: string;
  warnings: string[];
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function qualifiedTable(
  tableName: string
): string {
  return quoteIdentifier(tableName);
}

function mapColumnType(
  mysqlType: string,
  fallbackPostgreSQLType: string,
  warnings: string[],
  columnLabel: string
): string {
  const type = mysqlType.toLowerCase().trim();

  // Preserve source lengths and numeric precision.
  const varcharMatch = type.match(/^varchar\((\d+)\)/);
  if (varcharMatch) {
    return `VARCHAR(${varcharMatch[1]})`;
  }

  const charMatch = type.match(/^char\((\d+)\)/);
  if (charMatch) {
    return `CHAR(${charMatch[1]})`;
  }

  const decimalMatch = type.match(
    /^(?:decimal|numeric)\((\d+)(?:,(\d+))?\)/
  );

  if (decimalMatch) {
    const precision = decimalMatch[1];
    const scale = decimalMatch[2];

    return scale === undefined
      ? `NUMERIC(${precision})`
      : `NUMERIC(${precision}, ${scale})`;
  }

  // MySQL unsigned integers may need a wider PostgreSQL type.
  if (/^bigint\s+unsigned/.test(type)) {
    warnings.push(
      `${columnLabel}: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.`
    );
    return "NUMERIC(20,0)";
  }

  if (/^int(?:eger)?\s+unsigned/.test(type)) {
    return "BIGINT";
  }

  if (/^mediumint\s+unsigned/.test(type)) {
    return "INTEGER";
  }

  if (/^smallint\s+unsigned/.test(type)) {
    return "INTEGER";
  }

  if (/^tinyint\s+unsigned/.test(type)) {
    return "SMALLINT";
  }

  if (/^tinyint(?:\(\d+\))?/.test(type)) {
    warnings.push(
      `${columnLabel}: TINYINT maps to SMALLINT. Review whether this column should be BOOLEAN.`
    );
    return "SMALLINT";
  }

  if (/^mediumint/.test(type)) {
    return "INTEGER";
  }

  if (/^bigint/.test(type)) {
    return "BIGINT";
  }

  if (/^(?:int|integer)(?:\(\d+\))?/.test(type)) {
    return "INTEGER";
  }

  if (/^smallint/.test(type)) {
    return "SMALLINT";
  }

  if (/^decimal|^numeric/.test(type)) {
    return "NUMERIC";
  }

  if (/^double/.test(type)) {
    return "DOUBLE PRECISION";
  }

  if (/^float/.test(type)) {
    return "REAL";
  }

  if (/^(?:bool|boolean)/.test(type)) {
    return "BOOLEAN";
  }

  if (/^longtext|^mediumtext|^tinytext|^text/.test(type)) {
    return "TEXT";
  }

  if (/^datetime/.test(type)) {
    return "TIMESTAMP";
  }

  if (/^timestamp/.test(type)) {
    return "TIMESTAMP";
  }

  if (/^date/.test(type)) {
    return "DATE";
  }

  if (/^time/.test(type)) {
    return "TIME";
  }

  if (/^year/.test(type)) {
    warnings.push(
      `${columnLabel}: MySQL YEAR is mapped to INTEGER. Verify the desired year representation.`
    );
    return "INTEGER";
  }

  if (/^json/.test(type)) {
    return "JSONB";
  }

  if (/^(?:tinyblob|mediumblob|longblob|blob|varbinary|binary)/.test(type)) {
    return "BYTEA";
  }

  if (/^enum/.test(type)) {
    warnings.push(
      `${columnLabel}: MySQL ENUM is mapped to TEXT. Add validation or a PostgreSQL ENUM if required.`
    );
    return "TEXT";
  }

  if (/^set/.test(type)) {
    warnings.push(
      `${columnLabel}: MySQL SET is mapped to TEXT. Review value validation and conversion.`
    );
    return "TEXT";
  }

  warnings.push(
    `${columnLabel}: Source type '${mysqlType}' was not explicitly recognized. Using '${fallbackPostgreSQLType}' from the analyzer; review this mapping.`
  );

  return fallbackPostgreSQLType;
}

function formatDefaultValue(
  value: unknown,
  columnLabel: string,
  warnings: string[]
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      warnings.push(
        `${columnLabel}: Non-finite default value was omitted.`
      );
      return undefined;
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  const raw = String(value).trim();

  if (!raw) {
    return "''";
  }

  if (/^null$/i.test(raw)) {
    return "NULL";
  }

  if (/^(true|false)$/i.test(raw)) {
    return raw.toUpperCase();
  }

  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return raw;
  }

  if (
    /^current_timestamp(?:\(\d*\))?$/i.test(raw) ||
    /^current_date$/i.test(raw) ||
    /^current_time(?:\(\d*\))?$/i.test(raw)
  ) {
    return raw.toUpperCase();
  }

  if (/^uuid\(\)$/i.test(raw)) {
    warnings.push(
      `${columnLabel}: MySQL UUID() default cannot be copied directly. Configure an appropriate PostgreSQL UUID generator.`
    );
    return undefined;
  }

  // Unknown function-like expressions should not be copied
  // blindly into PostgreSQL.
  if (/^[a-z_][a-z0-9_]*\s*\(/i.test(raw)) {
    warnings.push(
      `${columnLabel}: Default expression '${raw}' requires manual PostgreSQL conversion and was omitted.`
    );
    return undefined;
  }

  // MySQL metadata usually returns string defaults without
  // SQL quotes. Escape them as PostgreSQL string literals.
  return `'${raw.replace(/'/g, "''")}'`;
}

function getPrimaryKeyColumns(
  table: MigrationTableAnalysis
): string[] {
  if (table.primaryKey.length > 0) {
    return table.primaryKey;
  }

  return table.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => column.column);
}

function normalizeRule(
  rule: string,
  warnings: string[],
  constraintName: string,
  ruleType: "UPDATE" | "DELETE"
): string | undefined {
  const normalized = rule.toUpperCase();

  const allowedRules = new Set([
    "RESTRICT",
    "CASCADE",
    "SET NULL",
    "SET DEFAULT",
    "NO ACTION",
  ]);

  if (allowedRules.has(normalized)) {
    return normalized;
  }

  warnings.push(
    `Foreign key ${constraintName}: unsupported ON ${ruleType} rule '${rule}'. The rule was omitted for manual review.`
  );

  return undefined;
}

export function generateMigrationSql(
  analysis: MigrationAnalysis,
  plan: MigrationPlan
): MigrationSQLResult {
  const warnings = new Set<string>();

  const tablesByName = new Map(
    analysis.tables.map((table) => [
      table.tableName,
      table,
    ])
  );

  const statements: string[] = [];

  statements.push(
    "-- DBPilot: MySQL to PostgreSQL migration",
    "-- Generated SQL only. Review warnings before execution.",
    "",
    "BEGIN;",
    ""
  );

  // Phase 1: Create tables and their columns.
  for (const tableName of plan.tableCreationOrder) {
    const table = tablesByName.get(tableName);

    if (!table) {
      warnings.add(
        `Table '${tableName}' is in the plan but missing from the analysis.`
      );
      continue;
    }

    const columns = [...table.columns].sort(
      (a, b) =>
        a.ordinalPosition - b.ordinalPosition
    );

    const definitions: string[] = [];

    for (const column of columns) {
      const label = `${tableName}.${column.column}`;

      const sqlType = mapColumnType(
        column.mysqlType,
        column.postgresqlType,
        [...warnings],
        label
      );

      // Capture warnings produced by type mapping.
      const typeWarnings: string[] = [];
      const finalType = mapColumnType(
        column.mysqlType,
        column.postgresqlType,
        typeWarnings,
        label
      );

      for (const warning of typeWarnings) {
        warnings.add(warning);
      }

      // Use finalType, which was mapped with warning capture.
      const parts = [
        quoteIdentifier(column.column),
        finalType || sqlType,
      ];

      if (column.isAutoIncrement) {
        if (
          finalType === "SMALLINT" ||
          finalType === "INTEGER" ||
          finalType === "BIGINT"
        ) {
          parts.push("GENERATED BY DEFAULT AS IDENTITY");
        } else {
          warnings.add(
            `${label}: AUTO_INCREMENT was detected on a non-standard identity type. Review the generated definition.`
          );
        }
      }

      if (!column.nullable) {
        parts.push("NOT NULL");
      }

      const defaultValue = formatDefaultValue(
        column.defaultValue,
        label,
        [...warnings]
      );

      // Capture any default-conversion warnings.
      const defaultWarnings: string[] = [];
      const convertedDefault = formatDefaultValue(
        column.defaultValue,
        label,
        defaultWarnings
      );

      for (const warning of defaultWarnings) {
        warnings.add(warning);
      }

      if (
        convertedDefault !== undefined &&
        !column.isAutoIncrement
      ) {
        parts.push("DEFAULT", convertedDefault);
      }

      // Keep the variable used and avoid applying unsupported defaults.
      void defaultValue;

      definitions.push(`  ${parts.join(" ")}`);
    }

    const primaryKeyColumns =
      getPrimaryKeyColumns(table);

    if (primaryKeyColumns.length > 0) {
      definitions.push(
        `  PRIMARY KEY (${primaryKeyColumns
          .map(quoteIdentifier)
          .join(", ")})`
      );
    }

    statements.push(
      `CREATE TABLE ${qualifiedTable(tableName)} (\n${definitions.join(",\n")}\n);`,
      ""
    );
  }

  // Phase 2: Add unique constraints.
  for (const constraint of plan.uniqueConstraints) {
    const table = tablesByName.get(
      constraint.tableName
    );

    if (!table) {
      continue;
    }

    const primaryKeyColumns =
      getPrimaryKeyColumns(table);

    if (
      constraint.columns.length ===
        primaryKeyColumns.length &&
      constraint.columns.every(
        (column, index) =>
          column === primaryKeyColumns[index]
      )
    ) {
      continue;
    }

    statements.push(
      `ALTER TABLE ${qualifiedTable(constraint.tableName)} ADD CONSTRAINT ${quoteIdentifier(constraint.name)} UNIQUE (${constraint.columns.map(quoteIdentifier).join(", ")});`,
      ""
    );
  }

  // Phase 3: Add foreign keys after all tables exist.
  // Group rows sharing a constraint name to support composite keys.
  const groupedForeignKeys = new Map<
    string,
    typeof plan.foreignKeys
  >();

  for (const foreignKey of plan.foreignKeys) {
    const key =
      `${foreignKey.tableName}::${foreignKey.constraintName}`;

    const existing = groupedForeignKeys.get(key) ?? [];
    existing.push(foreignKey);
    groupedForeignKeys.set(key, existing);
  }

  for (const group of groupedForeignKeys.values()) {
    const first = group[0];

    if (!first) {
      continue;
    }

    const sourceColumns = group.map(
      (item) => item.columnName
    );

    const targetColumns = group.map(
      (item) => item.referencedColumn
    );

    const updateRule = normalizeRule(
      first.updateRule,
      [...warnings],
      first.constraintName,
      "UPDATE"
    );

    const deleteRule = normalizeRule(
      first.deleteRule,
      [...warnings],
      first.constraintName,
      "DELETE"
    );

    const ruleWarnings: string[] = [];

    const safeUpdateRule = normalizeRule(
      first.updateRule,
      ruleWarnings,
      first.constraintName,
      "UPDATE"
    );

    const safeDeleteRule = normalizeRule(
      first.deleteRule,
      ruleWarnings,
      first.constraintName,
      "DELETE"
    );

    for (const warning of ruleWarnings) {
      warnings.add(warning);
    }

    const clauses = [
      `ALTER TABLE ${qualifiedTable(first.tableName)}`,
      `ADD CONSTRAINT ${quoteIdentifier(first.constraintName)}`,
      `FOREIGN KEY (${sourceColumns.map(quoteIdentifier).join(", ")})`,
      `REFERENCES ${qualifiedTable(first.referencedTable)} (${targetColumns.map(quoteIdentifier).join(", ")})`,
    ];

    if (safeUpdateRule) {
      clauses.push(`ON UPDATE ${safeUpdateRule}`);
    }

    if (safeDeleteRule) {
      clauses.push(`ON DELETE ${safeDeleteRule}`);
    }

    statements.push(
      `${clauses.join("\n  ")};`,
      ""
    );

    void updateRule;
    void deleteRule;
  }

  // Phase 4: Create indexes.
  for (const index of plan.indexes) {
    const table = tablesByName.get(index.tableName);

    if (!table || index.columns.length === 0) {
      continue;
    }

    const duplicatesUniqueConstraint =
      index.unique &&
      plan.uniqueConstraints.some(
        (constraint) =>
          constraint.tableName === index.tableName &&
          constraint.columns.length === index.columns.length &&
          constraint.columns.every(
            (column, position) =>
              column === index.columns[position]
          )
      );

    if (duplicatesUniqueConstraint) {
      continue;
    }

    if (
      index.indexType.toUpperCase() !== "BTREE" &&
      index.indexType.toUpperCase() !== "HASH"
    ) {
      warnings.add(
        `Index ${index.name} on ${index.tableName} uses MySQL index type '${index.indexType}'. PostgreSQL requires manual index-type review.`
      );
      continue;
    }

    statements.push(
      `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(index.name)} ON ${qualifiedTable(index.tableName)} (${index.columns.map(quoteIdentifier).join(", ")});`,
      ""
    );
  }

  for (const warning of plan.warnings) {
    warnings.add(warning);
  }

  for (const action of plan.manualActions) {
    warnings.add(`Manual review: ${action}`);
  }

  statements.push(
    "COMMIT;",
    "",
    "-- Review all warnings and test this script against a disposable",
    "-- PostgreSQL database before using it in production.",
    ""
  );

  return {
    sql: statements.join("\n"),
    warnings: [...warnings],
  };
}
