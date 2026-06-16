import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getEnv, type Bindings } from "../env";
import * as schema from "./schema";

export const createDb = (bindings: Bindings) => {
  const env = getEnv(bindings);
  const client = neon(env.DATABASE_URL);

  return drizzle({ client, schema });
};

export type Database = ReturnType<typeof createDb>;
