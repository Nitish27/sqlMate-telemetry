import type { Database } from "../db/client";
import { downloadClicks } from "../db/schema";

export interface RecordDownloadClickInput {
  source: string;
  channel: string;
  appVersion?: string | null;
  lastSeenIpHash?: string | null;
  now?: Date;
}

export const recordDownloadClick = async (
  db: Database,
  input: RecordDownloadClickInput
): Promise<void> => {
  const now = input.now ?? new Date();

  await db.insert(downloadClicks).values({
    source: input.source,
    channel: input.channel,
    appVersion: input.appVersion ?? null,
    lastSeenIpHash: input.lastSeenIpHash ?? null,
    createdAt: now,
  });
};
