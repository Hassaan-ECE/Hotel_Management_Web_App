import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

type RawSqlClient = ReturnType<typeof neon>;
type TypedSqlClient = {
  <T = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  query<T = Record<string, unknown>[]>(queryWithPlaceholders: string, params?: unknown[]): Promise<T>;
};

let sqlClient: RawSqlClient | null = null;
let dbClient: ReturnType<typeof createDb> | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

function createDb() {
  if (!sqlClient) {
    sqlClient = neon(databaseUrl());
  }
  return drizzle(sqlClient, { schema });
}

export function getSql() {
  if (!sqlClient) {
    sqlClient = neon(databaseUrl());
  }
  return sqlClient as unknown as TypedSqlClient;
}

export function getDb() {
  if (!dbClient) {
    dbClient = createDb();
  }
  return dbClient;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}