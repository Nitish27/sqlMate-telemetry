import { Hono } from "hono";

import { createDb } from "../db/client";
import type { Bindings } from "../env";
import { getPublicStats } from "../lib/metrics";

type PublicRouteDependencies = {
  createDb?: typeof createDb;
  getPublicStats?: typeof getPublicStats;
  now?: () => Date;
};

export const buildPublicRouter = (overrides: PublicRouteDependencies = {}) => {
  const dependencies: Required<PublicRouteDependencies> = {
    createDb: overrides.createDb ?? createDb,
    getPublicStats: overrides.getPublicStats ?? getPublicStats,
    now: overrides.now ?? (() => new Date()),
  };

  const router = new Hono<{ Bindings: Bindings }>();

  router.get("/stats", async (c) => {
    const db = dependencies.createDb(c.env);
    const stats = await dependencies.getPublicStats(db, dependencies.now());

    return c.json(stats);
  });

  return router;
};
