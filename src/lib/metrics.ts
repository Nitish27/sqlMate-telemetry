import { gte, sql } from "drizzle-orm";

import { installations } from "../db/schema";
import type { Database } from "../db/client";

export interface PublicStats {
  total_installs_opened: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  currently_active: number;
  generated_at: string;
}

export interface StatsThresholds {
  active1d: Date;
  active7d: Date;
  active30d: Date;
  currentlyActive: Date;
}

const countValue = sql<number>`count(*)::int`;

const subtractMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() - minutes * 60 * 1000);

const subtractDays = (date: Date, days: number): Date =>
  new Date(date.getTime() - days * 24 * 60 * 60 * 1000);

export const buildStatsThresholds = (now: Date = new Date()): StatsThresholds => ({
  active1d: subtractDays(now, 1),
  active7d: subtractDays(now, 7),
  active30d: subtractDays(now, 30),
  currentlyActive: subtractMinutes(now, 10),
});

const selectCount = async (
  query: Promise<Array<{ value: number }>> | Array<{ value: number }>
): Promise<number> => {
  const rows = await query;
  return rows[0]?.value ?? 0;
};

export const getPublicStats = async (
  db: Database,
  now: Date = new Date()
): Promise<PublicStats> => {
  const thresholds = buildStatsThresholds(now);

  const [totalInstallsOpened, active1d, active7d, active30d, currentlyActive] = await Promise.all([
    selectCount(db.select({ value: countValue }).from(installations)),
    selectCount(
      db
        .select({ value: countValue })
        .from(installations)
        .where(gte(installations.lastSeenAt, thresholds.active1d))
    ),
    selectCount(
      db
        .select({ value: countValue })
        .from(installations)
        .where(gte(installations.lastSeenAt, thresholds.active7d))
    ),
    selectCount(
      db
        .select({ value: countValue })
        .from(installations)
        .where(gte(installations.lastSeenAt, thresholds.active30d))
    ),
    selectCount(
      db
        .select({ value: countValue })
        .from(installations)
        .where(gte(installations.lastHeartbeatAt, thresholds.currentlyActive))
    ),
  ]);

  return {
    total_installs_opened: totalInstallsOpened,
    active_1d: active1d,
    active_7d: active7d,
    active_30d: active30d,
    currently_active: currentlyActive,
    generated_at: now.toISOString(),
  };
};
