
import type {
  MigrationColumn,
  MigrationForeignKey,
  MigrationIndex,
  MigrationUniqueConstraint,
} from "./MigrationAdapter.js";

export interface MigrationColumnAnalysis {
  column: string;
  mysqlType: string;
  postgresqlType: string;
  nullable: boolean;
  defaultValue: unknown;
  isAutoIncrement: boolean;
  isPrimaryKey: boolean;
  ordinalPosition: number;
  issues: string[];
}

export interface MigrationTableAnalysis {
  tableName: string;
  columns: MigrationColumnAnalysis[];
  indexes: MigrationIndex[];
  primaryKey: string[];
  foreignKeys: MigrationForeignKey[];
  uniqueConstraints: MigrationUniqueConstraint[];
  warnings: string[];
}

export interface MigrationAnalysis {
  sourceDatabase: string;
  targetDatabase: string;
  tables: MigrationTableAnalysis[];
  summary: {
    totalTables: number;
    totalWarnings: number;
    totalColumns: number;
  };
}

export function analyzeMigration(
  tables: string[],
  schemas: Map<string, MigrationColumn[]>,
  indexes: Map<string, MigrationIndex[]>,
  foreignKeys: Map<string, MigrationForeignKey[]>,
  primaryKeys: Map<string, string[]>,
  uniqueConstraints: Map<
    string,
    MigrationUniqueConstraint[]
  >
): MigrationAnalysis {
  const analyzedTables: MigrationTableAnalysis[] = [];

  let totalWarnings = 0;
  let totalColumns = 0;

  for (const tableName of tables) {
    const columns = schemas.get(tableName) ?? [];
    const tableIndexes = indexes.get(tableName) ?? [];
    const tableForeignKeys =
      foreignKeys.get(tableName) ?? [];
    const tablePrimaryKey =
      primaryKeys.get(tableName) ?? [];
    const tableUniqueConstraints =
      uniqueConstraints.get(tableName) ?? [];

    const columnAnalysis: MigrationColumnAnalysis[] = [];
    const warnings: string[] = [];

    for (const column of columns) {
      const analysis = analyzeColumn(
        column,
        tablePrimaryKey
      );

      columnAnalysis.push(analysis);

      if (analysis.issues.length > 0) {
        warnings.push(
          ...analysis.issues.map(
            (issue) => `${column.name}: ${issue}`
          )
        );
      }
    }

    for (const foreignKey of tableForeignKeys) {
      if (
        foreignKey.updateRule !== "NO ACTION" &&
        foreignKey.updateRule !== "RESTRICT"
      ) {
        warnings.push(
          `Foreign key ${foreignKey.constraintName} uses ON UPDATE ${foreignKey.updateRule}. Verify PostgreSQL behavior.`
        );
      }

      if (
        foreignKey.deleteRule !== "NO ACTION" &&
        foreignKey.deleteRule !== "RESTRICT"
      ) {
        warnings.push(
          `Foreign key ${foreignKey.constraintName} uses ON DELETE ${foreignKey.deleteRule}.`
        );
      }
    }

    analyzedTables.push({
      tableName,
      columns: columnAnalysis,
      indexes: tableIndexes,
      primaryKey: tablePrimaryKey,
      foreignKeys: tableForeignKeys,
      uniqueConstraints: tableUniqueConstraints,
      warnings,
    });

    totalWarnings += warnings.length;
    totalColumns += columns.length;
  }

  return {
    sourceDatabase: "MySQL",
    targetDatabase: "PostgreSQL",
    tables: analyzedTables,
    summary: {
      totalTables: tables.length,
      totalWarnings,
      totalColumns,
    },
  };
}

function analyzeColumn(
  column: MigrationColumn,
  primaryKeyColumns: string[]
): MigrationColumnAnalysis {
  const mysqlType = column.dataType.toLowerCase();
  const issues: string[] = [];

  const postgresqlType =
    mapMySqlTypeToPostgreSQL(mysqlType);

  if (mysqlType.startsWith("enum")) {
    issues.push(
      "ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type."
    );
  }

  if (mysqlType.startsWith("set")) {
    issues.push(
      "MySQL SET has no direct PostgreSQL equivalent and requires migration-specific handling."
    );
  }

  if (
    mysqlType === "tinyint(1)" ||
    mysqlType === "tinyint"
  ) {
    issues.push(
      "Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL."
    );
  }

  if (column.isAutoIncrement) {
    issues.push(
      "AUTO_INCREMENT requires PostgreSQL identity/sequence handling."
    );
  }

  if (
    column.defaultValue !== null &&
    typeof column.defaultValue === "string"
  ) {
    const defaultValue =
      column.defaultValue.toLowerCase();

    if (
      defaultValue.includes("current_timestamp()")
    ) {
      issues.push(
        "Verify CURRENT_TIMESTAMP() default syntax for PostgreSQL."
      );
    }

    if (defaultValue.includes("uuid()")) {
      issues.push(
        "UUID() is MySQL-specific and requires PostgreSQL UUID generation handling."
      );
    }
  }

  return {
    column: column.name,
    mysqlType: column.dataType,
    postgresqlType,
    nullable: column.nullable,
    defaultValue: column.defaultValue,
    isAutoIncrement: column.isAutoIncrement,
    isPrimaryKey:
      column.isPrimaryKey ||
      primaryKeyColumns.includes(column.name),
    ordinalPosition: column.ordinalPosition,
    issues,
  };
}

function mapMySqlTypeToPostgreSQL(
  mysqlType: string
): string {
  if (mysqlType.startsWith("bigint")) {
    return "BIGINT";
  }

  if (
    mysqlType.startsWith("int") ||
    mysqlType.startsWith("integer")
  ) {
    return "INTEGER";
  }

  if (mysqlType.startsWith("mediumint")) {
    return "INTEGER";
  }

  if (mysqlType.startsWith("smallint")) {
    return "SMALLINT";
  }

  if (mysqlType.startsWith("tinyint")) {
    return "SMALLINT";
  }

  if (
    mysqlType.startsWith("decimal") ||
    mysqlType.startsWith("numeric")
  ) {
    return "NUMERIC";
  }

  if (mysqlType.startsWith("float")) {
    return "REAL";
  }

  if (mysqlType.startsWith("double")) {
    return "DOUBLE PRECISION";
  }

  if (
    mysqlType.startsWith("boolean") ||
    mysqlType.startsWith("bool")
  ) {
    return "BOOLEAN";
  }

  if (mysqlType.startsWith("char")) {
    return "CHAR";
  }

  if (mysqlType.startsWith("varchar")) {
    return "VARCHAR";
  }

  if (
    mysqlType.startsWith("text") ||
    mysqlType.startsWith("tinytext") ||
    mysqlType.startsWith("mediumtext") ||
    mysqlType.startsWith("longtext")
  ) {
    return "TEXT";
  }

  if (mysqlType.startsWith("datetime")) {
    return "TIMESTAMP";
  }

  if (mysqlType.startsWith("timestamp")) {
    return "TIMESTAMP";
  }

  if (mysqlType.startsWith("date")) {
    return "DATE";
  }

  if (mysqlType.startsWith("time")) {
    return "TIME";
  }

  if (mysqlType.startsWith("year")) {
    return "INTEGER";
  }

  if (mysqlType.startsWith("json")) {
    return "JSONB";
  }

  if (
    mysqlType.startsWith("binary") ||
    mysqlType.startsWith("varbinary") ||
    mysqlType.includes("blob")
  ) {
    return "BYTEA";
  }

  if (
    mysqlType.startsWith("enum") ||
    mysqlType.startsWith("set")
  ) {
    return "TEXT";
  }

  return "TEXT";
}
