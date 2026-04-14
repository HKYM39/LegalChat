import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const sql = connectionString
  ? postgres(connectionString, {
      max: 10,
    })
  : null;

export const db = sql
  ? drizzle(sql, {
      schema,
    })
  : null;

export const hasDatabaseUrl = Boolean(connectionString);
