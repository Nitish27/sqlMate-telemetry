import { Hono, type Context } from "hono";
import { z } from "zod";

import { createDb } from "../db/client";
import type { Bindings } from "../env";
import { hashIpAddress } from "../lib/hash";
import { upsertInstallation } from "../lib/upsert-installation";

const telemetryPayloadSchema = z.object({
  installation_id: z.string().uuid(),
  app_version: z.string().trim().min(1).max(64).optional(),
  platform: z.string().trim().min(1).max(32).default("macos"),
  channel: z.string().trim().min(1).max(32).optional(),
});

type TelemetryRouteDependencies = {
  createDb?: typeof createDb;
  hashIpAddress?: typeof hashIpAddress;
  upsertInstallation?: typeof upsertInstallation;
  now?: () => Date;
};

const getClientIp = (request: Request): string | null => {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const firstForwarded = forwarded.split(",")[0]?.trim();
    if (firstForwarded) {
      return firstForwarded;
    }
  }

  return request.headers.get("cf-connecting-ip");
};

const validationErrorResponse = (message: string) =>
  Response.json(
    {
      error: "invalid_payload",
      message,
    },
    { status: 400 }
  );

const createTelemetryHandler =
  (isHeartbeat: boolean, dependencies: Required<TelemetryRouteDependencies>) =>
  async (c: Context<{ Bindings: Bindings }>) => {
    const body = await c.req.json().catch(() => null);
    const parsed = telemetryPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0]?.message ?? "Invalid telemetry payload.");
    }

    const requestTime = dependencies.now();
    const db = dependencies.createDb(c.env);
    const lastSeenIpHash = await dependencies.hashIpAddress(getClientIp(c.req.raw));

    await dependencies.upsertInstallation(db, {
      installationId: parsed.data.installation_id,
      appVersion: parsed.data.app_version ?? null,
      platform: parsed.data.platform,
      channel: parsed.data.channel ?? null,
      lastSeenIpHash,
      isHeartbeat,
      now: requestTime,
    });

    return c.json(
      {
        ok: true,
        event: isHeartbeat ? "heartbeat" : "session",
        accepted_at: requestTime.toISOString(),
      },
      202
    );
  };

export const buildTelemetryRouter = (overrides: TelemetryRouteDependencies = {}) => {
  const dependencies: Required<TelemetryRouteDependencies> = {
    createDb: overrides.createDb ?? createDb,
    hashIpAddress: overrides.hashIpAddress ?? hashIpAddress,
    upsertInstallation: overrides.upsertInstallation ?? upsertInstallation,
    now: overrides.now ?? (() => new Date()),
  };

  const router = new Hono<{ Bindings: Bindings }>();

  router.post("/session", createTelemetryHandler(false, dependencies));
  router.post("/heartbeat", createTelemetryHandler(true, dependencies));

  return router;
};
