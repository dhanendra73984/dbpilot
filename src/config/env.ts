import "dotenv/config";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  openaiApiKey: getEnv("OPENAI_API_KEY"),

  db: {
    host: getEnv("DB_HOST"),
    port: Number(getEnv("DB_PORT")),
    user: getEnv("DB_USER"),
    password: getEnv("DB_PASSWORD"),
    database: getEnv("DB_NAME"),
  },
};