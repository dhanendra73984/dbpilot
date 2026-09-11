
export interface SecurityAdapter {
  getDatabaseUsers(): Promise<DatabaseUser[]>;

  getUserPrivileges(
    username?: string,
    host?: string
  ): Promise<UserPrivilege[]>;

  getDatabaseRoles(): Promise<DatabaseRole[]>;

  getSecuritySettings(): Promise<SecuritySetting[]>;
}

export interface DatabaseUser {
  username: string;
  host: string;
  accountLocked: boolean;
  passwordExpired: boolean;
  plugin: string | null;
}

export interface UserPrivilege {
  username: string;
  host: string;
  database: string | null;
  table: string | null;
  privilege: string;
  grantOption: boolean;
}

export interface DatabaseRole {
  role: string;
  host: string;
}

export interface SecuritySetting {
  setting: string;
  value: string | null;
}

