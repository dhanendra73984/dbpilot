import type { ToolDefinition } from "./toolTypes.js";

export const getDatabaseUsersTool: ToolDefinition = {
  name: "get_database_users",

  description:
    "Get database users/accounts and security-related account information such as host, account lock status, password expiration status, and authentication plugin.",

  riskLevel: "read",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.security.getDatabaseUsers();
  },
};


export const getUserPrivilegesTool: ToolDefinition = {
  name: "get_user_privileges",

  description:
    "Get database privileges assigned to users. Optionally provide a username to inspect privileges for a specific user.",

  riskLevel: "read",

  parameters: {
    type: "object",

    properties: {
      username: {
        type: "string",
        description:
          "Optional database username whose privileges should be inspected.",
      },
    },

    required: [],

    additionalProperties: false,
  },

  async execute(args, context) {
    const username = args.username;

    if (
      username !== undefined &&
      typeof username !== "string"
    ) {
      throw new Error(
        "username must be a string"
      );
    }

    return await context.security.getUserPrivileges(
      username
    );
  },
};


export const getDatabaseRolesTool: ToolDefinition = {
  name: "get_database_roles",

  description:
    "Get database roles configured in the database.",

  riskLevel: "read",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.security.getDatabaseRoles();
  },
};


export const getSecuritySettingsTool: ToolDefinition = {
  name: "get_security_settings",

  description:
    "Get important database security-related configuration settings.",

  riskLevel: "read",

  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },

  async execute(_args, context) {
    return await context.security.getSecuritySettings();
  },
};


export const securityTools: ToolDefinition[] = [
  getDatabaseUsersTool,
  getUserPrivilegesTool,
  getDatabaseRolesTool,
  getSecuritySettingsTool,
];