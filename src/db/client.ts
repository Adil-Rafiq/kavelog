import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Cache the postgres client on globalThis in dev so HMR reuses it across
// module reloads. Without this, every save spawns a fresh pool of `max`
// connections, eventually exhausting the upstream Postgres limit
// (EMAXCONN). In prod the module is loaded once so the cache is a no-op.
const globalForPg = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const queryClient =
  globalForPg.pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
