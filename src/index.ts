import { createInterface } from "node:readline/promises";

import {
  stdin as input,
  stdout as output,
} from "node:process";

import { MySQLAdapter } from "./database/MySQLAdapter.js";

import { MySQLSecurityAdapter } from "./security/MySQLSecurityAdapter.js";

import { MySQLMigrationAdapter } from "./migration/MySQLMigrationAdapter.js";

import { databaseTools } from "./tools/databaseTools.js";

import { securityTools } from "./tools/securityTools.js";

import { migrationTools } from "./tools/migrationTools.js";

import type { ToolContext } from "./tools/toolTypes.js";

import { DatabaseAgent } from "./agent/agent.js";


console.log("🚀 DBPilot starting...");


const db = new MySQLAdapter();


try {
  await db.connect();


  const security =
    new MySQLSecurityAdapter(
      db.getPool()
    );


  const migration =
    new MySQLMigrationAdapter(
      db.getPool()
    );


  const context: ToolContext = {
    db,
    security,
    migration,
  };


  const allTools = [
    ...databaseTools,
    ...securityTools,
    ...migrationTools,
  ];


  const agent = new DatabaseAgent(
    allTools,
    context
  );


  const readline = createInterface({
    input,
    output,
  });


  console.log("\n🤖 DBPilot is ready!");

  console.log(
    "Type your database question."
  );

  console.log(
    "Type 'exit' or 'quit' to close.\n"
  );


  while (true) {
    const question = (
      await readline.question("DBPilot> ")
    ).trim();


    if (!question) {
      continue;
    }


    if (
      question.toLowerCase() === "exit" ||
      question.toLowerCase() === "quit"
    ) {
      break;
    }


    try {
      console.log(
        "\n🤔 Analyzing..."
      );


      const answer =
        await agent.run(question);


      console.log(
        "\n🤖 DBPilot:"
      );

      console.log(answer);

      console.log();

    } catch (error) {
      console.error(
        "\n❌ Request failed:"
      );


      if (error instanceof Error) {
        console.error(
          error.message
        );
      } else {
        console.error(error);
      }


      console.log();
    }
  }


  readline.close();

} catch (error) {
  console.error(
    "\n❌ Startup error:"
  );


  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

} finally {
  await db.disconnect();
}