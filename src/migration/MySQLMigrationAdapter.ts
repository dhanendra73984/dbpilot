import type {
  Pool,
  RowDataPacket,
} from "mysql2/promise";

import type {
  MigrationAdapter,
  MigrationColumn,
  MigrationForeignKey,
  MigrationIndex,
  MigrationUniqueConstraint,
} from "./MigrationAdapter.js";

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: unknown;
  EXTRA: string;
  COLUMN_KEY: string;
  ORDINAL_POSITION: number;
}

interface IndexRow extends RowDataPacket {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
  INDEX_TYPE: string;
  SEQ_IN_INDEX: number;
}

interface ForeignKeyRow extends RowDataPacket {
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
  UPDATE_RULE: string;
  DELETE_RULE: string;
}

interface PrimaryKeyRow extends RowDataPacket {
  COLUMN_NAME: string;
  ORDINAL_POSITION: number;
}

interface UniqueConstraintRow extends RowDataPacket {
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
  ORDINAL_POSITION: number;
}

interface CountRow extends RowDataPacket {
  TABLE_ROWS: number | null;
}

interface TableRow extends RowDataPacket {
  TABLE_NAME: string;
}

export class MySQLMigrationAdapter
  implements MigrationAdapter
{
  constructor(
    private readonly pool: Pool
  ) {}

  async connect(): Promise<void> {
    const connection =
      await this.pool.getConnection();

    try {
      await connection.ping();

      console.log(
        "✅ Migration adapter connected to MySQL"
      );
    } finally {
      connection.release();
    }
  }

  async disconnect(): Promise<void> {
    /*
     * The main MySQLAdapter owns the pool.
     *
     * Therefore this adapter does not close it.
     */
  }

  async getTables(): Promise<string[]> {
    const [rows] =
      await this.pool.query<TableRow[]>(
        `
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
        `
      );

    return rows.map(
      (row) => row.TABLE_NAME
    );
  }

  async getTableSchema(
    tableName: string
  ): Promise<MigrationColumn[]> {
    this.validateIdentifier(tableName);

    const [rows] =
      await this.pool.query<ColumnRow[]>(
        `
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          EXTRA,
          COLUMN_KEY,
          ORDINAL_POSITION
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        `,
        [tableName]
      );

    return rows.map((row) => ({
      name: row.COLUMN_NAME,

      dataType: row.DATA_TYPE,

      nullable:
        row.IS_NULLABLE === "YES",

      defaultValue:
        row.COLUMN_DEFAULT,

      isAutoIncrement:
        row.EXTRA
          .toLowerCase()
          .includes("auto_increment"),

      isPrimaryKey:
        row.COLUMN_KEY === "PRI",

      ordinalPosition:
        row.ORDINAL_POSITION,
    }));
  }

  async getIndexes(
    tableName: string
  ): Promise<MigrationIndex[]> {
    this.validateIdentifier(tableName);

    const [rows] =
      await this.pool.query<IndexRow[]>(
        `
        SELECT
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE,
          SEQ_IN_INDEX
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        ORDER BY
          INDEX_NAME,
          SEQ_IN_INDEX
        `,
        [tableName]
      );

    const indexMap =
      new Map<
        string,
        MigrationIndex
      >();

    for (const row of rows) {
      /*
       * PRIMARY is handled separately as the
       * table primary key.
       */
      if (row.INDEX_NAME === "PRIMARY") {
        continue;
      }

      const existing =
        indexMap.get(
          row.INDEX_NAME
        );

      if (existing) {
        existing.columns.push(
          row.COLUMN_NAME
        );
      } else {
        indexMap.set(
          row.INDEX_NAME,
          {
            name: row.INDEX_NAME,

            columns: [
              row.COLUMN_NAME,
            ],

            unique:
              row.NON_UNIQUE === 0,

            indexType:
              row.INDEX_TYPE,
          }
        );
      }
    }

    return Array.from(
      indexMap.values()
    );
  }

async getForeignKeys(
  tableName: string
): Promise<MigrationForeignKey[]> {
  this.validateIdentifier(tableName);

  const [rows] =
    await this.pool.query<
      ForeignKeyRow[]
    >(
      `
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME,
        rc.UPDATE_RULE,
        rc.DELETE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY
        kcu.CONSTRAINT_NAME,
        kcu.ORDINAL_POSITION
      `,
      [tableName]
    );

  return rows.map((row) => ({
    constraintName:
      row.CONSTRAINT_NAME,

    columnName:
      row.COLUMN_NAME,

    referencedTable:
      row.REFERENCED_TABLE_NAME,

    referencedColumn:
      row.REFERENCED_COLUMN_NAME,

    updateRule:
      row.UPDATE_RULE,

    deleteRule:
      row.DELETE_RULE,
  }));
}

  async getPrimaryKey(
    tableName: string
  ): Promise<string[]> {
    this.validateIdentifier(tableName);

    const [rows] =
      await this.pool.query<
        PrimaryKeyRow[]
      >(
        `
        SELECT
          COLUMN_NAME,
          ORDINAL_POSITION
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
        `,
        [tableName]
      );

    return rows.map(
      (row) => row.COLUMN_NAME
    );
  }

  async getUniqueConstraints(
    tableName: string
  ): Promise<
    MigrationUniqueConstraint[]
  > {
    this.validateIdentifier(tableName);

    const [rows] =
      await this.pool.query<
        UniqueConstraintRow[]
      >(
        `
        SELECT
          CONSTRAINT_NAME,
          COLUMN_NAME,
          ORDINAL_POSITION
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME != 'PRIMARY'
        ORDER BY
          CONSTRAINT_NAME,
          ORDINAL_POSITION
        `,
        [tableName]
      );

    const uniqueMap =
      new Map<
        string,
        MigrationUniqueConstraint
      >();

    for (const row of rows) {
      const existing =
        uniqueMap.get(
          row.CONSTRAINT_NAME
        );

      if (existing) {
        existing.columns.push(
          row.COLUMN_NAME
        );
      } else {
        uniqueMap.set(
          row.CONSTRAINT_NAME,
          {
            name:
              row.CONSTRAINT_NAME,

            columns: [
              row.COLUMN_NAME,
            ],
          }
        );
      }
    }

    return Array.from(
      uniqueMap.values()
    );
  }

  async getTableRowCount(
    tableName: string
  ): Promise<number> {
    this.validateIdentifier(tableName);

    const [rows] =
      await this.pool.query<CountRow[]>(
        `
        SELECT TABLE_ROWS
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        `,
        [tableName]
      );

    return Number(
      rows[0]?.TABLE_ROWS ?? 0
    );
  }

  private validateIdentifier(
    identifier: string
  ): void {
    if (
      !/^[a-zA-Z0-9_$]+$/.test(
        identifier
      )
    ) {
      throw new Error(
        `Invalid database identifier: ${identifier}`
      );
    }
  }
}