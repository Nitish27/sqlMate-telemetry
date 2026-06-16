import { installations } from "../db/schema";
import type { Database } from "../db/client";

export interface UpsertInstallationInput {
  installationId: string;
  appVersion?: string | null;
  platform: string;
  channel?: string | null;
  lastSeenIpHash?: string | null;
  isHeartbeat: boolean;
  now?: Date;
}

export const upsertInstallation = async (
  db: Database,
  input: UpsertInstallationInput
): Promise<void> => {
  const now = input.now ?? new Date();

  await db
    .insert(installations)
    .values({
      installationId: input.installationId,
      firstSeenAt: now,
      lastSeenAt: now,
      lastHeartbeatAt: input.isHeartbeat ? now : null,
      appVersion: input.appVersion ?? null,
      platform: input.platform,
      channel: input.channel ?? null,
      lastSeenIpHash: input.lastSeenIpHash ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: installations.installationId,
      set: {
        lastSeenAt: now,
        lastHeartbeatAt: input.isHeartbeat ? now : installations.lastHeartbeatAt,
        appVersion: input.appVersion ?? null,
        platform: input.platform,
        channel: input.channel ?? null,
        lastSeenIpHash: input.lastSeenIpHash ?? null,
        updatedAt: now,
      },
    });
};
