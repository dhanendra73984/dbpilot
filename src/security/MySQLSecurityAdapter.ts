import type {
  Pool,
  RowDataPacket,
} from "mysql2/promise";

import type {
  DatabaseRole,
  DatabaseUser,
  SecurityAdapter,
  SecuritySetting,
  UserPrivilege,
} from "./SecurityAdapter.js";

interface UserRow extends RowDataPacket {
  User: string;
  Host: string;
  account_locked: string;
  password_expired: string;
  plugin: string | null;
}

interface PrivilegeRow extends RowDataPacket {
  GRANTEE: string;
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  PRIVILEGE_TYPE: string;
  IS_GRANTABLE: string;
}

interface RoleRow extends RowDataPacket {
  FROM_USER: string;
  FROM_HOST: string;
}

interface SettingRow extends RowDataPacket {
  Variable_name: string;
  Value: string | null;
}

export class MySQLSecurityAdapter
  implements SecurityAdapter
{
  constructor(
    private readonly pool: Pool
  ) {}

  async getDatabaseUsers(): Promise<
    DatabaseUser[]
  > {
    const [rows] =
      await this.pool.query<UserRow[]>(`
        SELECT
          User,
          Host,
          account_locked,
          password_expired,
          plugin
        FROM mysql.user
        ORDER BY User, Host
      `);

    return rows.map((row) => ({
      username: row.User,
      host: row.Host,
      accountLocked:
        row.account_locked === "Y",
      passwordExpired:
        row.password_expired === "Y",
      plugin: row.plugin,
    }));
  }

  async getUserPrivileges(
    username?: string
  ): Promise<UserPrivilege[]> {
    let sql = `
      SELECT
        GRANTEE,
        TABLE_SCHEMA,
        TABLE_NAME,
        PRIVILEGE_TYPE,
        IS_GRANTABLE
      FROM information_schema.TABLE_PRIVILEGES
    `;

    const params: string[] = [];

    if (username?.trim()) {
      sql += `
        WHERE GRANTEE LIKE ?
      `;

      params.push(`'${username}'@%`);
    }

    sql += `
      ORDER BY
        GRANTEE,
        TABLE_SCHEMA,
        TABLE_NAME,
        PRIVILEGE_TYPE
    `;

    const [rows] =
      await this.pool.query<PrivilegeRow[]>(
        sql,
        params
      );

    return rows.map((row) => ({
      username: row.GRANTEE,
      host: "",
      database: row.TABLE_SCHEMA,
      table: row.TABLE_NAME,
      privilege: row.PRIVILEGE_TYPE,
      grantOption:
        row.IS_GRANTABLE === "YES",
    }));
  }

  async getDatabaseRoles(): Promise<
    DatabaseRole[]
  > {
    const [rows] =
      await this.pool.query<RoleRow[]>(`
        SELECT DISTINCT
          FROM_USER,
          FROM_HOST
        FROM mysql.role_edges
        ORDER BY
          FROM_USER,
          FROM_HOST
      `);

    return rows.map((row) => ({
      role: row.FROM_USER,
      host: row.FROM_HOST,
    }));
  }

  async getSecuritySettings(): Promise<
    SecuritySetting[]
  > {
    const [rows] =
      await this.pool.query<SettingRow[]>(`
        SHOW VARIABLES
        WHERE Variable_name IN (
          'require_secure_transport',
          'local_infile',
          'skip_name_resolve'
        )
      `);

    return rows.map((row) => ({
      setting: row.Variable_name,
      value: row.Value,
    }));
  }
}