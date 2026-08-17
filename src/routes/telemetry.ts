import { Hono, type Context } from "hono";
import { z } from "zod";

import { createDb } from "../db/client";
import type { Bindings } from "../env";
import { hashIpAddress } from "../lib/hash";
import { recordDownloadClick } from "../lib/record-download-click";
import { recordDownloadLead } from "../lib/record-download-lead";
import { upsertInstallation } from "../lib/upsert-installation";

const telemetryPayloadSchema = z.object({
  installation_id: z.string().uuid(),
  app_version: z.string().trim().min(1).max(64).optional(),
  platform: z.string().trim().min(1).max(32).default("macos"),
  channel: z.string().trim().min(1).max(32).optional(),
});

const downloadPayloadSchema = z.object({
  source: z.string().trim().min(1).max(32).default("landing"),
  channel: z.string().trim().min(1).max(32).default("dmg"),
  version: z.string().trim().min(1).max(64).optional(),
});

const downloadLeadPayloadSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320),
  usage_type: z.enum(["personal", "organization"]),
  source: z.string().trim().min(1).max(32).default("landing"),
  channel: z.string().trim().min(1).max(32).default("dmg"),
  version: z.string().trim().min(1).max(64).optional(),
});

type TelemetryRouteDependencies = {
  createDb?: typeof createDb;
  hashIpAddress?: typeof hashIpAddress;
  upsertInstallation?: typeof upsertInstallation;
  recordDownloadClick?: typeof recordDownloadClick;
  recordDownloadLead?: typeof recordDownloadLead;
  now?: () => Date;
};

const DOWNLOAD_ALLOWED_ORIGINS = new Set([
  "https://sqlmate.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

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

const applyTelemetryCorsHeaders = (headers: Headers, origin: string | null) => {
  if (origin && DOWNLOAD_ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else {
    headers.set("Access-Control-Allow-Origin", "https://sqlmate.io");
  }

  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
};

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

const createDownloadHandler =
  (dependencies: Required<TelemetryRouteDependencies>) =>
  async (c: Context<{ Bindings: Bindings }>) => {
    const origin = c.req.header("origin") ?? null;
    const body = await c.req.json().catch(() => null);
    const parsed = downloadPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const response = validationErrorResponse(
        parsed.error.issues[0]?.message ?? "Invalid download telemetry payload."
      );
      applyTelemetryCorsHeaders(response.headers, origin);
      return response;
    }

    const requestTime = dependencies.now();
    const db = dependencies.createDb(c.env);
    const lastSeenIpHash = await dependencies.hashIpAddress(getClientIp(c.req.raw));

    await dependencies.recordDownloadClick(db, {
      source: parsed.data.source,
      channel: parsed.data.channel,
      appVersion: parsed.data.version ?? null,
      lastSeenIpHash,
      now: requestTime,
    });

    const response = c.json(
      {
        ok: true,
        event: "download",
        accepted_at: requestTime.toISOString(),
      },
      202
    );
    applyTelemetryCorsHeaders(response.headers, origin);

    return response;
  };

const createDownloadLeadHandler =
  (dependencies: Required<TelemetryRouteDependencies>) =>
  async (c: Context<{ Bindings: Bindings }>) => {
    const origin = c.req.header("origin") ?? null;
    const body = await c.req.json().catch(() => null);
    const parsed = downloadLeadPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const response = validationErrorResponse(
        parsed.error.issues[0]?.message ?? "Invalid download lead payload."
      );
      applyTelemetryCorsHeaders(response.headers, origin);
      return response;
    }

    const requestTime = dependencies.now();
    const db = dependencies.createDb(c.env);
    const lastSeenIpHash = await dependencies.hashIpAddress(getClientIp(c.req.raw));

    await dependencies.recordDownloadLead(db, {
      name: parsed.data.name ?? null,
      email: parsed.data.email,
      usageType: parsed.data.usage_type,
      source: parsed.data.source,
      channel: parsed.data.channel,
      appVersion: parsed.data.version ?? null,
      lastSeenIpHash,
      now: requestTime,
    });

    const response = c.json(
      {
        ok: true,
        event: "download_lead",
        accepted_at: requestTime.toISOString(),
      },
      202
    );
    applyTelemetryCorsHeaders(response.headers, origin);

    return response;
  };

export const buildTelemetryRouter = (overrides: TelemetryRouteDependencies = {}) => {
  const dependencies: Required<TelemetryRouteDependencies> = {
    createDb: overrides.createDb ?? createDb,
    hashIpAddress: overrides.hashIpAddress ?? hashIpAddress,
    upsertInstallation: overrides.upsertInstallation ?? upsertInstallation,
    recordDownloadClick: overrides.recordDownloadClick ?? recordDownloadClick,
    recordDownloadLead: overrides.recordDownloadLead ?? recordDownloadLead,
    now: overrides.now ?? (() => new Date()),
  };

  const router = new Hono<{ Bindings: Bindings }>();

  router.post("/session", createTelemetryHandler(false, dependencies));
  router.post("/heartbeat", createTelemetryHandler(true, dependencies));
  router.options("/download", (c) => {
    const response = new Response(null, { status: 204 });
    applyTelemetryCorsHeaders(response.headers, c.req.header("origin") ?? null);
    return response;
  });
  router.post("/download", createDownloadHandler(dependencies));
  router.options("/download-lead", (c) => {
    const response = new Response(null, { status: 204 });
    applyTelemetryCorsHeaders(response.headers, c.req.header("origin") ?? null);
    return response;
  });
  router.post("/download-lead", createDownloadLeadHandler(dependencies));

  return router;
};
