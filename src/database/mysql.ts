import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
});

console.log("✅ MySQL connected");

const [rows] = await connection.query(
  "SELECT VERSION() AS version"
);

console.log(rows);

await connection.end();