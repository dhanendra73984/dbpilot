export interface DatabaseAdapter {
  connect(): Promise<void>;

  disconnect(): Promise<void>;

  getTables(): Promise<string[]>;

  getTableSchema(tableName: string): Promise<TableColumn[]>;

  getIndexes(tableName: string): Promise<DatabaseIndex[]>;

  getSlowQueries(): Promise<SlowQuery[]>;

  getLocks(): Promise<DatabaseLock[]>;

  getConnections(): Promise<DatabaseConnection[]>;

  getTableStats(tableName?: string): Promise<TableStats[]>;

  explainQuery(sql: string): Promise<unknown>;

  executeSql(sql: string): Promise<unknown>;

  createIndex(
    tableName: string,
    indexName: string,
    columns: string[]
  ): Promise<void>;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: unknown;
  key: string;
  extra: string;
}

export interface DatabaseIndex {
  name: string;
  column: string;
  nonUnique: boolean;
  sequence: number;
  indexType: string;
}

export interface SlowQuery {
  query: string;
  executionCount: number;
  totalTimeMs: number;
  averageTimeMs: number;
  rowsExamined: number;
  rowsSent: number;
}

export interface DatabaseLock {
  threadId: number | null;
  processListId: number | null;
  objectSchema: string | null;
  objectName: string | null;
  lockType: string | null;
  lockMode: string | null;
  lockStatus: string | null;
}

export interface DatabaseConnection {
  processId: number;
  user: string | null;
  host: string | null;
  database: string | null;
  command: string;
  state: string | null;
  durationSeconds: number;
  info: string | null;
}

export interface TableStats {
  tableName: string;
  rows: number;
  dataSizeBytes: number;
  indexSizeBytes: number;
  totalSizeBytes: number;
}