import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { env } from "./env.js";

export const pool = new Pool({
  application_name: "million-items-backend",
  connectionString: env.DATABASE_URL,
  max: 20
});

export const query = <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<TRow>> => {
  return pool.query<TRow>(text, params);
};

export const withClient = async <T>(handler: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();

  try {
    return await handler(client);
  } finally {
    client.release();
  }
};

export const getDbHealth = async () => {
  const startedAt = Date.now();
  await query("select 1");

  return {
    latencyMs: Date.now() - startedAt,
    status: "ok" as const
  };
};

export const closePool = async () => {
  await pool.end();
};
