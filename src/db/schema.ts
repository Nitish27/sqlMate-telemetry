import { bigserial, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const downloadClicks = pgTable(
  "download_clicks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    source: text("source").notNull(),
    channel: text("channel").notNull(),
    appVersion: text("app_version"),
    lastSeenIpHash: text("last_seen_ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("download_clicks_created_at_idx").on(table.createdAt),
    index("download_clicks_channel_idx").on(table.channel),
    index("download_clicks_source_idx").on(table.source),
  ]
);

export const downloadLeads = pgTable(
  "download_leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    usageType: text("usage_type").notNull(),
    source: text("source").notNull(),
    channel: text("channel").notNull(),
    appVersion: text("app_version"),
    lastSeenIpHash: text("last_seen_ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("download_leads_created_at_idx").on(table.createdAt),
    index("download_leads_email_idx").on(table.email),
    index("download_leads_usage_type_idx").on(table.usageType),
  ]
);

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;
export type DownloadClick = typeof downloadClicks.$inferSelect;
export type NewDownloadClick = typeof downloadClicks.$inferInsert;
export type DownloadLead = typeof downloadLeads.$inferSelect;
export type NewDownloadLead = typeof downloadLeads.$inferInsert;
