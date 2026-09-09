import mysql, {
  type Connection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

import { env } from "../config/env.js";
import type {
  DatabaseAdapter,
  DatabaseIndex,
  SlowQuery,
  TableColumn,
  DatabaseLock,
  DatabaseConnection,
  TableStats,
} from "./DatabaseAdapter.js";

interface TableRow extends RowDataPacket {
  [key: string]: unknown;
}

interface ColumnRow extends RowDataPacket {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Default: unknown;
  Key: string;
  Extra: string;
}

interface IndexRow extends RowDataPacket {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
  Seq_in_index: number;
  Index_type: string;
}

interface SlowQueryRow extends RowDataPacket {
  DIGEST_TEXT: string;
  COUNT_STAR: number;
  SUM_TIMER_WAIT: number;
  SUM_ROWS_EXAMINED: number;
  SUM_ROWS_SENT: number;
}

interface LockRow extends RowDataPacket {
  THREAD_ID: number | null;
  PROCESSLIST_ID: number | null;
  OBJECT_SCHEMA: string | null;
  OBJECT_NAME: string | null;
  LOCK_TYPE: string | null;
  LOCK_MODE: string | null;
  LOCK_STATUS: string | null;
}

interface ConnectionRow extends RowDataPacket {
  ID: number;
  USER: string | null;
  HOST: string | null;
  DB: string | null;
  COMMAND: string;
  TIME: number;
  STATE: string | null;
  INFO: string | null;
}

interface TableStatsRow extends RowDataPacket {
  TABLE_NAME: string;
  TABLE_ROWS: number | null;
  DATA_LENGTH: number | null;
  INDEX_LENGTH: number | null;
}

export class MySQLAdapter implements DatabaseAdapter {
  private connection: Connection | null = null;

  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    this.connection = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });

    console.log("✅ MySQL connected");
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }

    await this.connection.end();
    this.connection = null;

    console.log("🔌 MySQL disconnected");
  }

  private getConnection(): Connection {
    if (!this.connection) {
      throw new Error("Database is not connected");
    }

    return this.connection;
  }

  async getTables(): Promise<string[]> {
    const connection = this.getConnection();

    const [rows] = await connection.query<TableRow[]>(
      "SHOW TABLES"
    );

    return rows.map((row) => {
      const firstValue = Object.values(row)[0];

      return String(firstValue);
    });
  }

  async getTableSchema(
    tableName: string
  ): Promise<TableColumn[]> {
    const connection = this.getConnection();

    this.validateIdentifier(tableName);

    const [rows] = await connection.query<ColumnRow[]>(
      `SHOW COLUMNS FROM \`${tableName}\``
    );

    return rows.map((row) => ({
      name: row.Field,
      type: row.Type,
      nullable: row.Null === "YES",
      defaultValue: row.Default,
      key: row.Key,
      extra: row.Extra,
    }));
  }

  async getIndexes(
    tableName: string
  ): Promise<DatabaseIndex[]> {
    const connection = this.getConnection();

    this.validateIdentifier(tableName);

    const [rows] = await connection.query<IndexRow[]>(
      `SHOW INDEX FROM \`${tableName}\``
    );

    return rows.map((row) => ({
      name: row.Key_name,
      column: row.Column_name,
      nonUnique: row.Non_unique === 1,
      sequence: row.Seq_in_index,
      indexType: row.Index_type,
    }));
  }

  async getSlowQueries(): Promise<SlowQuery[]> {
    const connection = this.getConnection();

    const sql = `
      SELECT
        DIGEST_TEXT,
        COUNT_STAR,
        SUM_TIMER_WAIT,
        SUM_ROWS_EXAMINED,
        SUM_ROWS_SENT
      FROM performance_schema.events_statements_summary_by_digest
      WHERE DIGEST_TEXT IS NOT NULL
        AND COUNT_STAR > 0
      ORDER BY SUM_TIMER_WAIT DESC
      LIMIT 20
    `;

    try {
      const [rows] = await connection.query<SlowQueryRow[]>(sql);

      return rows.map((row) => {
        const totalTimeMs =
          Number(row.SUM_TIMER_WAIT) / 1_000_000_000;

        const averageTimeMs =
          totalTimeMs / Number(row.COUNT_STAR);

        return {
          query: row.DIGEST_TEXT,
          executionCount: Number(row.COUNT_STAR),
          totalTimeMs,
          averageTimeMs,
          rowsExamined: Number(row.SUM_ROWS_EXAMINED),
          rowsSent: Number(row.SUM_ROWS_SENT),
        };
      });
    } catch (error) {
      throw new Error(
        `Unable to read MySQL performance data. Make sure performance_schema is enabled. Original error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

async getLocks(): Promise<DatabaseLock[]> {
  const connection = this.getConnection();

  const sql = `
    SELECT
      dl.THREAD_ID,
      NULL AS PROCESSLIST_ID,
      dl.OBJECT_SCHEMA,
      dl.OBJECT_NAME,
      dl.LOCK_TYPE,
      dl.LOCK_MODE,
      dl.LOCK_STATUS
    FROM performance_schema.data_locks AS dl
  `;

  try {
    const [rows] = await connection.query<LockRow[]>(sql);

    return rows.map((row) => ({
      threadId: row.THREAD_ID,
      processListId: row.PROCESSLIST_ID,
      objectSchema: row.OBJECT_SCHEMA,
      objectName: row.OBJECT_NAME,
      lockType: row.LOCK_TYPE,
      lockMode: row.LOCK_MODE,
      lockStatus: row.LOCK_STATUS,
    }));
  } catch (error) {
    throw new Error(
      `Unable to read MySQL lock information. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

  async getConnections(): Promise<DatabaseConnection[]> {
    const connection = this.getConnection();

    const sql = `
      SELECT
        ID,
        USER,
        HOST,
        DB,
        COMMAND,
        TIME,
        STATE,
        INFO
      FROM information_schema.PROCESSLIST
      ORDER BY TIME DESC
    `;

    const [rows] = await connection.query<ConnectionRow[]>(sql);

    return rows.map((row) => ({
      processId: row.ID,
      user: row.USER,
      host: row.HOST,
      database: row.DB,
      command: row.COMMAND,
      state: row.STATE,
      durationSeconds: Number(row.TIME),
      info: row.INFO,
    }));
  }

  async getTableStats(tableName?: string): Promise<TableStats[]> {
    const connection = this.getConnection();

    let sql = `
      SELECT
        TABLE_NAME,
        TABLE_ROWS,
        DATA_LENGTH,
        INDEX_LENGTH
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
    `;

    const params: string[] = [env.db.database];

    if (tableName) {
      this.validateIdentifier(tableName);

      sql += `
        AND TABLE_NAME = ?
      `;

      params.push(tableName);
    }

    sql += `
      ORDER BY (COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0)) DESC
    `;

    const [rows] = await connection.query<TableStatsRow[]>(
      sql,
      params
    );

    return rows.map((row) => {
      const dataSizeBytes = Number(row.DATA_LENGTH ?? 0);
      const indexSizeBytes = Number(row.INDEX_LENGTH ?? 0);

      return {
        tableName: row.TABLE_NAME,
        rows: Number(row.TABLE_ROWS ?? 0),
        dataSizeBytes,
        indexSizeBytes,
        totalSizeBytes: dataSizeBytes + indexSizeBytes,
      };
    });
  }

  async explainQuery(sql: string): Promise<unknown> {
    const connection = this.getConnection();

    const trimmedSql = sql.trim();

    if (!trimmedSql) {
      throw new Error("SQL query cannot be empty");
    }

    const [rows] = await connection.query(
      `EXPLAIN ${trimmedSql}`
    );

    return rows;
  }

  async executeSql(sql: string): Promise<unknown> {
    const connection = this.getConnection();

    const trimmedSql = sql.trim();

    if (!trimmedSql) {
      throw new Error("SQL query cannot be empty");
    }

    const [result] = await connection.query(trimmedSql);

    return result;
  }

  async createIndex(
    tableName: string,
    indexName: string,
    columns: string[]
  ): Promise<void> {
    const connection = this.getConnection();

    this.validateIdentifier(tableName);
    this.validateIdentifier(indexName);

    if (columns.length === 0) {
      throw new Error("At least one column is required");
    }

    columns.forEach((column) => {
      this.validateIdentifier(column);
    });

    const columnList = columns
      .map((column) => `\`${column}\``)
      .join(", ");

    const sql = `
      CREATE INDEX \`${indexName}\`
      ON \`${tableName}\` (${columnList})
    `;

    await connection.query<ResultSetHeader>(sql);
  }

  private validateIdentifier(identifier: string): void {
    if (!/^[a-zA-Z0-9_$]+$/.test(identifier)) {
      throw new Error(
        `Invalid database identifier: ${identifier}`
      );
    }
  }
}