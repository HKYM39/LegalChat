import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

function readDatabaseUrl() {
  return process.env.DATABASE_URL;
}

export function createDbClient(connectionString = readDatabaseUrl()) {
  if (!connectionString) {
    return null;
  }

  const sql = postgres(connectionString, {
    max: 1,
  });
  const db = drizzle(sql, {
    schema,
  });

  return {
    sql,
    db,
  };
}

export type DatabaseClient = NonNullable<ReturnType<typeof createDbClient>>;
export type Database = DatabaseClient["db"];

export const hasDatabaseUrl = Boolean(readDatabaseUrl());
