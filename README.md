# DBPilot

**DBPilot is an Agentic AI database assistant that allows you to interact with your database using natural language.**

It combines **Gemini**, **TypeScript**, and **MySQL** to create an AI agent that can reason about database questions, select the appropriate tools, execute those tools against a real database, and return useful results.

> 🚧 **Project Status:** Active development

---

## What is DBPilot?

Traditional database tools require you to know SQL and database administration commands.

With DBPilot, you can ask questions like:

```text
DBPilot> Show me my database schema
```

```text
DBPilot> Show indexes on orders
```

```text
DBPilot> What tables do I have?
```

```text
DBPilot> Find performance problems in my database
```

Eventually, DBPilot will also support questions about actual database records:

```text
DBPilot> Find Carol Bker's email
```

The AI agent determines which database tools it needs, executes them, receives the real database results, and uses those results to produce the answer.

---

## Architecture

```text
                         User
                           │
                           ▼
                    ┌─────────────┐
                    │  DBPilot CLI │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ DatabaseAgent│
                    │   Gemini AI  │
                    └──────┬──────┘
                           │
                    Tool selection
                           │
                           ▼
                    ┌─────────────┐
                    │ ToolRegistry │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        Schema Tool   Index Tool    Performance Tools
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                    DatabaseAdapter
                           │
                           ▼
                      MySQLAdapter
                           │
                           ▼
                         MySQL
                           │
                           ▼
                    Real DB Results
                           │
                           ▼
                        Gemini
                           │
                           ▼
                    Final Response
```

---

## Current Features

### Database Adapter

DBPilot uses a database abstraction layer so that database-specific implementation details remain separated from the AI agent.

Current implementation:

```text
DatabaseAdapter
      │
      └── MySQLAdapter
```

This architecture allows additional database adapters to be added in the future.

---

## Database Performance Tools

The current Performance Agent contains these tools:

| Tool               | Purpose                               |
| ------------------ | ------------------------------------- |
| `execute_sql`      | Execute SQL against the database      |
| `explain_query`    | Inspect a query execution plan        |
| `get_schema`       | Inspect database tables and columns   |
| `get_indexes`      | Inspect table indexes                 |
| `get_slow_queries` | Find slow query information           |
| `get_locks`        | Inspect database locks                |
| `get_connections`  | Inspect active database connections   |
| `get_table_stats`  | Inspect table size and row statistics |
| `create_index`     | Create a database index               |

These tools are exposed to Gemini through function calling.

---

## Agentic Tool Calling

DBPilot does not hard-code a response for every question.

Instead, the agent follows a tool-calling loop:

```text
User Question
     │
     ▼
   Gemini
     │
     ▼
Select Tool
     │
     ▼
Execute Tool
     │
     ▼
Real MySQL Result
     │
     ▼
Send Result to Gemini
     │
     ▼
Final Answer
```

The agent can also perform multiple tool calls when a question requires information from different parts of the database.

---

## Example

For:

```text
DBPilot> Show me my database schema
```

Gemini may request:

```text
get_schema()
```

DBPilot executes the tool against MySQL:

```text
MySQL
  ↓
orders
users
```

The result is returned to Gemini, which produces the final response.

Example:

```text
🤖 DBPilot:

Your database contains 2 tables:

1. users
   - id
   - name
   - email
   - created_at

2. orders
   - id
   - user_id
   - status
   - total_amount
   - created_at
```

---

## Tech Stack

* **Node.js**
* **TypeScript**
* **MySQL**
* **mysql2**
* **Gemini API**
* **OpenAI SDK compatibility layer**
* **dotenv**
* **tsx**
* **Git**

---

## Project Structure

```text
dbpilot/
│
├── src/
│   ├── agent/
│   │   ├── agent.ts
│   │   ├── openaiClient.ts
│   │   ├── openaiTools.ts
│   │   └── toolRegistry.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── database/
│   │   ├── DatabaseAdapter.ts
│   │   └── MySQLAdapter.ts
│   │
│   ├── tools/
│   │   ├── databaseTools.ts
│   │   └── toolTypes.ts
│   │
│   └── index.ts
│
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd dbpilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file:

```env
OPENAI_API_KEY=your_gemini_api_key

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=dbpilot
```

> `OPENAI_API_KEY` is currently the environment variable name used by the application, while the value is a Gemini API key because DBPilot uses Gemini's OpenAI-compatible API endpoint.

**Never commit `.env` or API keys to GitHub.**

---

## Database Setup

Create the development database:

```sql
CREATE DATABASE dbpilot;
```

Example tables:

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Run DBPilot

Development mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Production:

```bash
npm start
```

You should see:

```text
🚀 DBPilot starting...
✅ MySQL connected

🤖 DBPilot is ready!

DBPilot>
```

---

## Example Questions

```text
show me my database schema
```

```text
what tables do I have?
```

```text
show indexes on orders
```

```text
show my slow queries
```

```text
show database connections
```

```text
show table statistics
```

```text
explain this query: SELECT * FROM orders WHERE user_id = 10
```

---

## Roadmap

### Phase 1 — Database Performance Agent

* [x] MySQL connection
* [x] Database adapter abstraction
* [x] Schema inspection
* [x] Index inspection
* [x] Slow query inspection
* [x] Lock inspection
* [x] Connection inspection
* [x] Table statistics
* [x] Query explanation
* [x] Index creation
* [x] Gemini integration
* [x] Function calling
* [x] Tool registry
* [x] Agent loop
* [x] Interactive terminal CLI
* [ ] Database row inspection
* [ ] SQL safety validation
* [ ] User approval for write operations
* [ ] Automated performance analysis
* [ ] Performance recommendations
* [ ] Performance verification

### Phase 2 — Database Migration Agent

Planned capabilities:

* MySQL → PostgreSQL migration
* Schema discovery
* Dependency analysis
* Foreign-key dependency graph
* Migration batching
* Parallel migration
* Checkpointing
* Resume after failure
* Row-count validation
* Data validation
* Multiple database adapters

Planned architecture:

```text
Source Database
      │
      ▼
Database Adapter
      │
      ▼
Universal Schema
      │
      ▼
Migration Planner
      │
      ▼
Migration Engine
      │
      ▼
Target Database
```

### Phase 3 — Database Security Agent

Planned capabilities:

* Security configuration analysis
* User and privilege analysis
* Risk detection
* Suspicious configuration detection
* Security recommendations
* Permission auditing

### Future Platform

The long-term goal is to combine these agents:

```text
                         DBPilot
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        Performance      Migration      Security
           Agent           Agent          Agent
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                       AI Orchestrator
```

---

## Design Principles

### AI reasons, tools execute

Gemini is responsible for reasoning and deciding what information it needs.

Database tools are responsible for deterministic execution.

```text
Gemini
  = Reasoning

Tools
  = Capabilities

MySQL
  = Source of Truth
```

### Database abstraction

The agent should not depend directly on MySQL-specific implementation details.

```text
DatabaseAgent
      │
      ▼
DatabaseAdapter
      │
      ├── MySQLAdapter
      ├── PostgreSQLAdapter
      ├── SQLServerAdapter
      └── OracleAdapter
```

This makes the system easier to extend to other databases.

### Safety first

Read operations can be performed automatically.

Write operations such as:

```text
CREATE INDEX
UPDATE
DELETE
ALTER TABLE
```

will eventually require SQL validation and explicit user approval.

---

## Why This Project?

DBPilot is being built as a practical exploration of **Agentic AI applied to database engineering**.

The goal is not simply to build a chatbot that generates SQL.

The goal is to build an agent that can:

```text
Understand
    ↓
Investigate
    ↓
Use database tools
    ↓
Analyze real database information
    ↓
Recommend actions
    ↓
Safely execute approved changes
    ↓
Verify the result
```

---

## License

License information will be added as the project matures.
