import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/index";
import type { Bindings } from "../src/env";
import { buildStatsThresholds } from "../src/lib/metrics";
import { buildPublicRouter } from "../src/routes/public";

const testEnv: Bindings = {
  DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/sqlmate_telemetry",
  NODE_ENV: "test",
};

describe("public stats routes", () => {
  it("returns aggregate public stats", async () => {
    const createDbMock = vi.fn(() => ({ name: "db" }));
    const getPublicStatsMock = vi.fn(async () => ({
      total_installs_opened: 12,
      active_1d: 5,
      active_7d: 7,
      active_30d: 9,
      currently_active: 2,
      generated_at: "2026-06-17T10:05:00.000Z",
    }));

    const app = createApp();
    app.route(
      "/test/public",
      buildPublicRouter({
        createDb: createDbMock as never,
        getPublicStats: getPublicStatsMock as never,
        now: () => new Date("2026-06-17T10:05:00.000Z"),
      })
    );

    const response = await app.request("http://localhost/test/public/stats", undefined, testEnv);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total_installs_opened: 12,
      active_1d: 5,
      active_7d: 7,
      active_30d: 9,
      currently_active: 2,
      generated_at: "2026-06-17T10:05:00.000Z",
    });

    expect(createDbMock).toHaveBeenCalledWith(testEnv);
    expect(getPublicStatsMock).toHaveBeenCalledWith(
      { name: "db" },
      new Date("2026-06-17T10:05:00.000Z")
    );
  });

  it("builds the expected rolling activity thresholds", () => {
    const now = new Date("2026-06-17T10:05:00.000Z");
    const thresholds = buildStatsThresholds(now);

    expect(thresholds.currentlyActive.toISOString()).toBe("2026-06-17T09:55:00.000Z");
    expect(thresholds.active1d.toISOString()).toBe("2026-06-16T10:05:00.000Z");
    expect(thresholds.active7d.toISOString()).toBe("2026-06-10T10:05:00.000Z");
    expect(thresholds.active30d.toISOString()).toBe("2026-05-18T10:05:00.000Z");
  });
});
