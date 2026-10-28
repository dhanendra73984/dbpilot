
import type {
  MigrationAnalysis,
  MigrationTableAnalysis,
} from "./MigrationAnalyzer.js";

export interface MigrationPlan {
  sourceDatabase: string;
  targetDatabase: string;

  tableCreationOrder: string[];

  columnConversions: {
    tableName: string;
    columnName: string;
    mysqlType: string;
    postgresqlType: string;
    nullable: boolean;
    defaultValue: unknown;
    isAutoIncrement: boolean;
    isPrimaryKey: boolean;
    ordinalPosition: number;
    issues: string[];
  }[];

  primaryKeys: {
    tableName: string;
    columns: string[];
  }[];

  foreignKeys: {
    tableName: string;
    constraintName: string;
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
    updateRule: string;
    deleteRule: string;
  }[];

  indexes: {
    tableName: string;
    name: string;
    columns: string[];
    unique: boolean;
    indexType: string;
  }[];

  uniqueConstraints: {
    tableName: string;
    name: string;
    columns: string[];
  }[];

  phases: {
    phase: number;
    name: string;
    tasks: string[];
  }[];

  warnings: string[];
  manualActions: string[];

  summary: {
    totalTables: number;
    totalColumns: number;
    totalWarnings: number;
    totalManualActions: number;
    hasCircularDependencies: boolean;
  };
}

function getTableCreationOrder(
  tables: MigrationTableAnalysis[]
): {
  order: string[];
  hasCircularDependencies: boolean;
  unresolvedTables: string[];
} {
  const tableNames = tables.map(
    (table) => table.tableName
  );

  const tableSet = new Set(tableNames);

  const dependencies = new Map<string, Set<string>>();

  for (const table of tables) {
    const referencedTables = new Set<string>();

    for (const foreignKey of table.foreignKeys) {
      if (tableSet.has(foreignKey.referencedTable)) {
        // Self-references are also dependencies.
        referencedTables.add(
          foreignKey.referencedTable
        );
      }
    }

    dependencies.set(
      table.tableName,
      referencedTables
    );
  }

  const completed = new Set<string>();
  const order: string[] = [];

  // Process tables whose referenced tables have already
  // been processed. This produces a topological ordering.
  while (completed.size < tableNames.length) {
    const readyTables = tableNames
      .filter((name) => !completed.has(name))
      .filter((name) =>
        [...(dependencies.get(name) ?? [])].every(
          (dependency) => completed.has(dependency)
        )
      );

    if (readyTables.length === 0) {
      break;
    }

    for (const name of readyTables) {
      completed.add(name);
      order.push(name);
    }
  }

  const unresolvedTables = tableNames.filter(
    (name) => !completed.has(name)
  );

  const hasCircularDependencies =
    unresolvedTables.length > 0;

  // Retain every table in the plan, even if dependencies
  // prevent a complete ordering.
  order.push(...unresolvedTables);

  return {
    order,
    hasCircularDependencies,
    unresolvedTables,
  };
}

export function createMigrationPlan(
  analysis: MigrationAnalysis
): MigrationPlan {
  const {
    order,
    hasCircularDependencies,
    unresolvedTables,
  } = getTableCreationOrder(analysis.tables);

  const columnConversions: MigrationPlan["columnConversions"] =
    [];

  const primaryKeys: MigrationPlan["primaryKeys"] = [];
  const foreignKeys: MigrationPlan["foreignKeys"] = [];
  const indexes: MigrationPlan["indexes"] = [];

  const uniqueConstraints: MigrationPlan["uniqueConstraints"] =
    [];

  const warnings = new Set<string>();
  const manualActions = new Set<string>();

  if (hasCircularDependencies) {
    warnings.add(
      `A complete dependency order could not be established for: ${unresolvedTables.join(", ")}. These tables may contain circular or self-referencing foreign keys.`
    );

    manualActions.add(
      "Create the affected tables before adding their foreign-key constraints. Review self-referencing foreign keys and circular dependencies separately."
    );
  }

  for (const table of analysis.tables) {
    for (const warning of table.warnings) {
      warnings.add(`${table.tableName}: ${warning}`);
    }

    for (const column of table.columns) {
      columnConversions.push({
        tableName: table.tableName,
        columnName: column.column,
        mysqlType: column.mysqlType,
        postgresqlType: column.postgresqlType,
        nullable: column.nullable,
        defaultValue: column.defaultValue,
        isAutoIncrement: column.isAutoIncrement,
        isPrimaryKey: column.isPrimaryKey,
        ordinalPosition: column.ordinalPosition,
        issues: [...column.issues],
      });

      for (const issue of column.issues) {
        manualActions.add(
          `${table.tableName}.${column.column}: ${issue}`
        );
      }
    }

    if (table.primaryKey.length > 0) {
      primaryKeys.push({
        tableName: table.tableName,
        columns: [...table.primaryKey],
      });
    }

    for (const foreignKey of table.foreignKeys) {
      foreignKeys.push({
        tableName: table.tableName,
        constraintName: foreignKey.constraintName,
        columnName: foreignKey.columnName,
        referencedTable: foreignKey.referencedTable,
        referencedColumn: foreignKey.referencedColumn,
        updateRule: foreignKey.updateRule,
        deleteRule: foreignKey.deleteRule,
      });
    }

    for (const index of table.indexes) {
      indexes.push({
        tableName: table.tableName,
        name: index.name,
        columns: [...index.columns],
        unique: index.unique,
        indexType: index.indexType,
      });
    }

    for (const constraint of table.uniqueConstraints) {
      uniqueConstraints.push({
        tableName: table.tableName,
        name: constraint.name,
        columns: [...constraint.columns],
      });
    }
  }

  if (foreignKeys.length > 0) {
    manualActions.add(
      "Verify referenced tables and columns exist, and confirm compatible data types before applying foreign-key constraints."
    );
  }

  const phases: MigrationPlan["phases"] = [
    {
      phase: 1,
      name: "Create tables",
      tasks: order.map(
        (name) => `Prepare and create table: ${name}`
      ),
    },
    {
      phase: 2,
      name: "Primary keys and unique constraints",
      tasks: [
        ...primaryKeys.map(
          (item) =>
            `Create primary key on ${item.tableName} (${item.columns.join(", ")})`
        ),
        ...uniqueConstraints.map(
          (item) =>
            `Create unique constraint ${item.name} on ${item.tableName} (${item.columns.join(", ")})`
        ),
      ],
    },
    {
      phase: 3,
      name: "Foreign keys",
      tasks: foreignKeys.map(
        (item) =>
          `Add ${item.constraintName} on ${item.tableName}.${item.columnName} referencing ${item.referencedTable}.${item.referencedColumn}`
      ),
    },
    {
      phase: 4,
      name: "Indexes",
      tasks: indexes.map(
        (item) =>
          `Create ${item.unique ? "unique " : ""}index ${item.name} on ${item.tableName} (${item.columns.join(", ")})`
      ),
    },
    {
      phase: 5,
      name: "Manual review",
      tasks: [...manualActions],
    },
  ];

  const totalColumns = analysis.tables.reduce(
    (total, table) => total + table.columns.length,
    0
  );

  return {
    sourceDatabase: analysis.sourceDatabase,
    targetDatabase: analysis.targetDatabase,
    tableCreationOrder: order,
    columnConversions,
    primaryKeys,
    foreignKeys,
    indexes,
    uniqueConstraints,
    phases,
    warnings: [...warnings],
    manualActions: [...manualActions],

    summary: {
      totalTables: analysis.tables.length,
      totalColumns,
      totalWarnings: warnings.size,
      totalManualActions: manualActions.size,
      hasCircularDependencies,
    },
  };
}
