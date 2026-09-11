const BLOCKED_SQL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|GRANT|REVOKE|CALL|LOAD\s+DATA|SET)\b/i;

export function validateReadOnlySql(sql: string): void {
  const normalizedSql = sql.trim();

  if (!normalizedSql) {
    throw new Error("SQL query cannot be empty");
  }

  if (BLOCKED_SQL_PATTERN.test(normalizedSql)) {
    throw new Error(
      "Unsafe SQL blocked. execute_sql only allows read-only queries."
    );
  }

  const firstKeyword = normalizedSql
    .replace(/^\/\*[\s\S]*?\*\//, "")
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase();

  const allowedKeywords = [
    "SELECT",
    "SHOW",
    "DESCRIBE",
    "DESC",
    "EXPLAIN",
    "WITH",
  ];

  if (!firstKeyword || !allowedKeywords.includes(firstKeyword)) {
    throw new Error(
      `SQL statement '${firstKeyword ?? "UNKNOWN"}' is not allowed. Only read-only SQL is supported.`
    );
  }
}