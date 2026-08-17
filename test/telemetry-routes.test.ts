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

  it("accepts download telemetry from the landing page", async () => {
    const createDbMock = vi.fn(() => ({ name: "db" }));
    const hashIpAddressMock = vi.fn(async () => "hashed-ip");
    const recordDownloadClickMock = vi.fn(async () => undefined);
    const acceptedAt = new Date("2026-06-18T10:00:00.000Z");

    const app = createApp();
    app.route(
      "/test/telemetry",
      buildTelemetryRouter({
        createDb: createDbMock as never,
        hashIpAddress: hashIpAddressMock,
        recordDownloadClick: recordDownloadClickMock as never,
        now: () => acceptedAt,
      })
    );

    const response = await app.request(
      "http://localhost/test/telemetry/download",
      {
        method: "POST",
        headers: {
          origin: "https://sqlmate.io",
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.44",
        },
        body: JSON.stringify({
          source: "landing",
          channel: "dmg",
          version: "0.4.1",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://sqlmate.io");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      event: "download",
      accepted_at: acceptedAt.toISOString(),
    });

    expect(recordDownloadClickMock).toHaveBeenCalledWith(
      { name: "db" },
      {
        source: "landing",
        channel: "dmg",
        appVersion: "0.4.1",
        lastSeenIpHash: "hashed-ip",
        now: acceptedAt,
      }
    );
  });

  it("rejects invalid download lead payloads", async () => {
    const app = createApp();
    const response = await app.request(
      "http://localhost/v1/telemetry/download-lead",
      {
        method: "POST",
        headers: {
          origin: "https://sqlmate.io",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Nitish",
          usage_type: "personal",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://sqlmate.io");
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_payload",
    });
  });

  it("accepts a download lead and stores it with the client IP hash", async () => {
    const createDbMock = vi.fn(() => ({ name: "db" }));
    const hashIpAddressMock = vi.fn(async () => "hashed-ip");
    const recordDownloadLeadMock = vi.fn(async () => undefined);
    const acceptedAt = new Date("2026-06-18T11:00:00.000Z");

    const app = createApp();
    app.route(
      "/test/telemetry",
      buildTelemetryRouter({
        createDb: createDbMock as never,
        hashIpAddress: hashIpAddressMock,
        recordDownloadLead: recordDownloadLeadMock as never,
        now: () => acceptedAt,
      })
    );

    const response = await app.request(
      "http://localhost/test/telemetry/download-lead",
      {
        method: "POST",
        headers: {
          origin: "https://sqlmate.io",
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.77",
        },
        body: JSON.stringify({
          name: "Nitish",
          email: "nitish@example.com",
          usage_type: "organization",
          source: "landing",
          channel: "dmg",
          version: "0.4.1",
        }),
      },
      testEnv
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://sqlmate.io");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      event: "download_lead",
      accepted_at: acceptedAt.toISOString(),
    });

    expect(recordDownloadLeadMock).toHaveBeenCalledWith(
      { name: "db" },
      {
        name: "Nitish",
        email: "nitish@example.com",
        usageType: "organization",
        source: "landing",
        channel: "dmg",
        appVersion: "0.4.1",
        lastSeenIpHash: "hashed-ip",
        now: acceptedAt,
      }
    );
  });
});
