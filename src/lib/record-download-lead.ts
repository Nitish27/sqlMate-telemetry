import type { Database } from "../db/client";
import { downloadLeads } from "../db/schema";

export interface RecordDownloadLeadInput {
  name?: string | null;
  email: string;
  usageType: "personal" | "organization";
  source: string;
  channel: string;
  appVersion?: string | null;
  lastSeenIpHash?: string | null;
  now?: Date;
}

export const recordDownloadLead = async (
  db: Database,
  input: RecordDownloadLeadInput
): Promise<void> => {
  const now = input.now ?? new Date();

  await db.insert(downloadLeads).values({
    name: input.name?.trim() ? input.name.trim() : null,
    email: input.email,
    usageType: input.usageType,
    source: input.source,
    channel: input.channel,
    appVersion: input.appVersion ?? null,
    lastSeenIpHash: input.lastSeenIpHash ?? null,
    createdAt: now,
  });
};
