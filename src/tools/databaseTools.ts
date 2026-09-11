import type { ToolDefinition } from "./toolTypes.js";
import { validateReadOnlySql } from "../security/sqlSafety.js";

/**
 * 1. execute_sql
 */
export const executeSqlTool: ToolDefinition = {
  name: "execute_sql",

  description:
    "Execute a SQL statement against the connected database and return the database result.",

  parameters: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "The SQL statement to execute.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },

  async execute(args, context) {
    const sql = args.sql;

    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error("sql must be a non-empty string");
    }
     validateReadOnlySql(sql);
    return await context.db.executeSql(sql);
  },
};


/**
 * 2. explain_query
 */
export const explainQueryTool: ToolDefinition = {
  name: "explain_query",

  description:
    "Analyze how MySQL plans to execute a SQL query using EXPLAIN. Use this to investigate query performance and identify possible indexing or execution-plan problems.",

  parameters: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "The SQL query to analyze.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },

  async execute(args, context) {
    const sql = args.sql;

    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error("sql must be a non-empty string");
    }

    return await context.db.explainQuery(sql);
  },
};


/**
 * 3. get_schema
 */
export const getSchemaTool: ToolDefinition = {
  name: "get_schema",

  description:
    "Get the database schema, including tables and their columns, data types, nullability, defaults, keys, and extra attributes.",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    const tables = await context.db.getTables();

    const schema = await Promise.all(
      tables.map(async (tableName) => {
        const columns = await context.db.getTableSchema(tableName);

        return {
          tableName,
          columns,
        };
      })
    );

    return schema;
  },
};


/**
 * 4. get_indexes
 */
export const getIndexesTool: ToolDefinition = {
  name: "get_indexes",

  description:
    "Get all indexes defined on a database table, including index name, columns, uniqueness, column order, and index type.",

  parameters: {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "The table whose indexes should be inspected.",
      },
    },
    required: ["tableName"],
    additionalProperties: false,
  },

  async execute(args, context) {
    const tableName = args.tableName;

    if (typeof tableName !== "string" || !tableName.trim()) {
      throw new Error("tableName must be a non-empty string");
    }

    return await context.db.getIndexes(tableName);
  },
};


/**
 * 5. get_slow_queries
 */
export const getSlowQueriesTool: ToolDefinition = {
  name: "get_slow_queries",

  description:
    "Get the database queries consuming the most execution time, including execution count, total time, average time, rows examined, and rows returned.",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.db.getSlowQueries();
  },
};


/**
 * 6. get_locks
 */
export const getLocksTool: ToolDefinition = {
  name: "get_locks",

  description:
    "Inspect current database lock information to identify locking activity and potential contention.",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.db.getLocks();
  },
};


/**
 * 7. get_connections
 */
export const getConnectionsTool: ToolDefinition = {
  name: "get_connections",

  description:
    "Get active MySQL database connections and their process IDs, users, hosts, commands, states, durations, and currently executing SQL information.",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.db.getConnections();
  },
};


/**
 * 8. get_table_stats
 */
export const getTableStatsTool: ToolDefinition = {
  name: "get_table_stats",

  description:
    "Get table statistics including estimated row count, data size, index size, and total size. Provide a table name to inspect one table, or provide an empty string to inspect all tables.",

  parameters: {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description:
          "Table name to inspect. Use an empty string to return statistics for all tables.",
      },
    },
    required: ["tableName"],
    additionalProperties: false,
  },

  async execute(args, context) {
    const tableName = args.tableName;

    if (typeof tableName !== "string") {
      throw new Error("tableName must be a string");
    }

    return await context.db.getTableStats(tableName);
  },
};


/**
 * 9. create_index
 */
export const createIndexTool: ToolDefinition = {
  name: "create_index",

  description:
    "Create an index on a database table using the specified index name and columns. This is a write operation and should only be used when creating an index is justified.",

  parameters: {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "The table where the index should be created.",
      },

      indexName: {
        type: "string",
        description: "The name of the new index.",
      },

      columns: {
        type: "array",
        description: "The columns that should be included in the index.",
        items: {
          type: "string",
        },
      },
    },

    required: ["tableName", "indexName", "columns"],
    additionalProperties: false,
  },

  async execute(args, context) {
    const tableName = args.tableName;
    const indexName = args.indexName;
    const columns = args.columns;

    if (typeof tableName !== "string" || !tableName.trim()) {
      throw new Error("tableName must be a non-empty string");
    }

    if (typeof indexName !== "string" || !indexName.trim()) {
      throw new Error("indexName must be a non-empty string");
    }

    if (
      !Array.isArray(columns) ||
      columns.length === 0 ||
      !columns.every((column) => typeof column === "string")
    ) {
      throw new Error(
        "columns must be a non-empty array of strings"
      );
    }

    await context.db.createIndex(
      tableName,
      indexName,
      columns
    );

    return {
      success: true,
      tableName,
      indexName,
      columns,
    };
  },
};


/**
 * All Database Performance Agent tools
 */
export const databaseTools: ToolDefinition[] = [
  executeSqlTool,
  explainQueryTool,
  getSchemaTool,
  getIndexesTool,
  getSlowQueriesTool,
  getLocksTool,
  getConnectionsTool,
  getTableStatsTool,
  createIndexTool,
];