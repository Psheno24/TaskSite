import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required when DATA_PROVIDER=postgres");
  }
  return url;
}

export function getSql() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(getDatabaseUrl(), {
      max: 10,
      prepare: false,
    });
  }
  return globalForDb.postgresClient;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}
