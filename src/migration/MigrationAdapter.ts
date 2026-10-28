export interface MigrationAdapter {
  connect(): Promise<void>;

  disconnect(): Promise<void>;

  getTables(): Promise<string[]>;

  getTableSchema(
    tableName: string
  ): Promise<MigrationColumn[]>;

  getIndexes(
    tableName: string
  ): Promise<MigrationIndex[]>;

  getForeignKeys(
    tableName: string
  ): Promise<MigrationForeignKey[]>;

  getPrimaryKey(
    tableName: string
  ): Promise<string[]>;

  getUniqueConstraints(
    tableName: string
  ): Promise<MigrationUniqueConstraint[]>;

  getTableRowCount(
    tableName: string
  ): Promise<number>;
}

export interface MigrationColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: unknown;
  isAutoIncrement: boolean;
  isPrimaryKey: boolean;
  ordinalPosition: number;
}

export interface MigrationIndex {
  name: string;

  columns: string[];

  unique: boolean;

  indexType: string;
}

export interface MigrationForeignKey {
  constraintName: string;

  columnName: string;

  referencedTable: string;

  referencedColumn: string;

  updateRule: string;

  deleteRule: string;
}

export interface MigrationUniqueConstraint {
  name: string;

  columns: string[];
}