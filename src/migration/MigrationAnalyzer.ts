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
  const analyzedTables: MigrationTableAnalysis[] =
    [];

  let totalWarnings = 0;
  let totalColumns = 0;

  for (const tableName of tables) {
    const columns =
      schemas.get(tableName) ?? [];

    const tableIndexes =
      indexes.get(tableName) ?? [];

    const tableForeignKeys =
      foreignKeys.get(tableName) ?? [];

    const tablePrimaryKey =
      primaryKeys.get(tableName) ?? [];

    const tableUniqueConstraints =
      uniqueConstraints.get(tableName) ?? [];

    const columnAnalysis: MigrationColumnAnalysis[] =
      [];

    const warnings: string[] = [];

    for (const column of columns) {
      const analysis =
        analyzeColumn(column);

      columnAnalysis.push(
        analysis
      );

      if (analysis.issues.length > 0) {
        warnings.push(
          ...analysis.issues.map(
            (issue) =>
              `${column.name}: ${issue}`
          )
        );
      }
    }

    if (tableForeignKeys.length > 0) {
      for (const foreignKey of tableForeignKeys) {
        if (
          foreignKey.updateRule !==
            "NO ACTION" &&
          foreignKey.updateRule !==
            "RESTRICT"
        ) {
          warnings.push(
            `Foreign key ${foreignKey.constraintName} uses ON UPDATE ${foreignKey.updateRule}. Verify PostgreSQL behavior.`
          );
        }

        if (
          foreignKey.deleteRule !==
            "NO ACTION" &&
          foreignKey.deleteRule !==
            "RESTRICT"
        ) {
          warnings.push(
            `Foreign key ${foreignKey.constraintName} uses ON DELETE ${foreignKey.deleteRule}.`
          );
        }
      }
    }

    analyzedTables.push({
      tableName,
      columns: columnAnalysis,
      indexes: tableIndexes,
      primaryKey: tablePrimaryKey,
      foreignKeys: tableForeignKeys,
      uniqueConstraints:
        tableUniqueConstraints,
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
  column: MigrationColumn
): MigrationColumnAnalysis {
  const mysqlType =
    column.dataType.toLowerCase();

  const issues: string[] = [];

  let postgresqlType =
    mapMySqlTypeToPostgreSQL(
      mysqlType
    );

  if (
    mysqlType.includes("enum")
  ) {
    issues.push(
      "ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type."
    );
  }

  if (
    mysqlType.includes("set")
  ) {
    issues.push(
      "MySQL SET has no direct PostgreSQL equivalent and requires migration-specific handling."
    );
  }

  if (
    mysqlType === "json"
  ) {
    postgresqlType = "JSONB";
  }

  if (
    mysqlType === "tinyint(1)" ||
    mysqlType === "tinyint"
  ) {
    issues.push(
      "Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL."
    );
  }

  if (
    column.isAutoIncrement
  ) {
    issues.push(
      "AUTO_INCREMENT requires PostgreSQL identity/sequence handling."
    );
  }

  if (
    column.defaultValue !==
      null &&
    typeof column.defaultValue ===
      "string"
  ) {
    const defaultValue =
      column.defaultValue
        .toLowerCase();

    if (
      defaultValue.includes(
        "current_timestamp()"
      )
    ) {
      issues.push(
        "Verify CURRENT_TIMESTAMP() default syntax for PostgreSQL."
      );
    }

    if (
      defaultValue.includes(
        "uuid()"
      )
    ) {
      issues.push(
        "UUID() is MySQL-specific and requires PostgreSQL UUID generation handling."
      );
    }
  }

  return {
    column: column.name,
    mysqlType: column.dataType,
    postgresqlType,
    issues,
  };
}

function mapMySqlTypeToPostgreSQL(
  mysqlType: string
): string {
  if (
    mysqlType.startsWith("bigint")
  ) {
    return "BIGINT";
  }

  if (
    mysqlType.startsWith("int") ||
    mysqlType.startsWith("integer")
  ) {
    return "INTEGER";
  }

  if (
    mysqlType.startsWith("mediumint")
  ) {
    return "INTEGER";
  }

  if (
    mysqlType.startsWith("smallint")
  ) {
    return "SMALLINT";
  }

  if (
    mysqlType.startsWith("tinyint")
  ) {
    return "SMALLINT";
  }

  if (
    mysqlType.startsWith("decimal") ||
    mysqlType.startsWith("numeric")
  ) {
    return "NUMERIC";
  }

  if (
    mysqlType.startsWith("float")
  ) {
    return "REAL";
  }

  if (
    mysqlType.startsWith("double")
  ) {
    return "DOUBLE PRECISION";
  }

  if (
    mysqlType.startsWith("boolean") ||
    mysqlType.startsWith("bool")
  ) {
    return "BOOLEAN";
  }

  if (
    mysqlType.startsWith("char")
  ) {
    return "CHAR";
  }

  if (
    mysqlType.startsWith("varchar")
  ) {
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

  if (
    mysqlType.startsWith("date")
  ) {
    return "DATE";
  }

  if (
    mysqlType.startsWith("datetime")
  ) {
    return "TIMESTAMP";
  }

  if (
    mysqlType.startsWith("timestamp")
  ) {
    return "TIMESTAMP";
  }

  if (
    mysqlType.startsWith("time")
  ) {
    return "TIME";
  }

  if (
    mysqlType.startsWith("year")
  ) {
    return "INTEGER";
  }

  if (
    mysqlType.startsWith("json")
  ) {
    return "JSONB";
  }

  if (
    mysqlType.startsWith("binary") ||
    mysqlType.startsWith("varbinary") ||
    mysqlType.startsWith("blob") ||
    mysqlType.startsWith("tinyblob") ||
    mysqlType.startsWith("mediumblob") ||
    mysqlType.startsWith("longblob")
  ) {
    return "BYTEA";
  }

  if (
    mysqlType.startsWith("enum")
  ) {
    return "TEXT";
  }

  if (
    mysqlType.startsWith("set")
  ) {
    return "TEXT";
  }

  return "TEXT";
}