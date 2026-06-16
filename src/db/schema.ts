import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const installations = pgTable(
  "installations",
  {
    installationId: text("installation_id").primaryKey(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    appVersion: text("app_version"),
    platform: text("platform").default("macos").notNull(),
    channel: text("channel"),
    lastSeenIpHash: text("last_seen_ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("installations_last_seen_at_idx").on(table.lastSeenAt),
    index("installations_last_heartbeat_at_idx").on(table.lastHeartbeatAt),
    index("installations_channel_idx").on(table.channel),
  ]
);

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;
