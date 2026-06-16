import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/index";
import { buildTelemetryRouter } from "../src/routes/telemetry";
import type { Bindings } from "../src/env";

const testEnv: Bindings = {
  DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/sqlmate_telemetry",
  NODE_ENV: "test",
};

describe("telemetry routes", () => {
  it("rejects invalid telemetry payloads", async () => {
    const app = createApp();
    const response = await app.request(
      "http://localhost/v1/telemetry/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installation_id: "not-a-uuid",
          platform: "macos",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_payload",
    });
  });

  it("accepts session telemetry and hashes the client IP", async () => {
    const createDbMock = vi.fn(() => ({ name: "db" }));
    const hashIpAddressMock = vi.fn(async () => "hashed-ip");
    const upsertInstallationMock = vi.fn(async () => undefined);
    const acceptedAt = new Date("2026-06-17T10:00:00.000Z");

    const app = createApp();
    app.route(
      "/test/telemetry",
      buildTelemetryRouter({
        createDb: createDbMock as never,
        hashIpAddress: hashIpAddressMock,
        upsertInstallation: upsertInstallationMock as never,
        now: () => acceptedAt,
      })
    );

    const response = await app.request(
      "http://localhost/test/telemetry/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10, 198.51.100.4",
        },
        body: JSON.stringify({
          installation_id: "11111111-1111-4111-8111-111111111111",
          app_version: "0.4.1",
          platform: "macos",
          channel: "dmg",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      event: "session",
      accepted_at: acceptedAt.toISOString(),
    });

    expect(createDbMock).toHaveBeenCalledWith(testEnv);
    expect(hashIpAddressMock).toHaveBeenCalledWith("203.0.113.10");
    expect(upsertInstallationMock).toHaveBeenCalledWith(
      { name: "db" },
      {
        installationId: "11111111-1111-4111-8111-111111111111",
        appVersion: "0.4.1",
        platform: "macos",
        channel: "dmg",
        lastSeenIpHash: "hashed-ip",
        isHeartbeat: false,
        now: acceptedAt,
      }
    );
  });

  it("marks heartbeat telemetry as a heartbeat event", async () => {
    const createDbMock = vi.fn(() => ({ name: "db" }));
    const hashIpAddressMock = vi.fn(async () => null);
    const upsertInstallationMock = vi.fn(async () => undefined);
    const acceptedAt = new Date("2026-06-17T10:03:00.000Z");

    const app = createApp();
    app.route(
      "/test/telemetry",
      buildTelemetryRouter({
        createDb: createDbMock as never,
        hashIpAddress: hashIpAddressMock,
        upsertInstallation: upsertInstallationMock as never,
        now: () => acceptedAt,
      })
    );

    const response = await app.request(
      "http://localhost/test/telemetry/heartbeat",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installation_id: "22222222-2222-4222-8222-222222222222",
          app_version: "0.4.1",
          platform: "macos",
          channel: "app_store",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      event: "heartbeat",
    });

    expect(upsertInstallationMock).toHaveBeenCalledWith(
      { name: "db" },
      expect.objectContaining({
        installationId: "22222222-2222-4222-8222-222222222222",
        isHeartbeat: true,
      })
    );
  });
});
