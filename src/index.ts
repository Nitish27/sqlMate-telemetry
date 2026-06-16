import { Hono } from "hono";

import { getEnv, type Bindings } from "./env";
import { buildPublicRouter } from "./routes/public";
import { buildTelemetryRouter } from "./routes/telemetry";

export const createApp = () => {
  const app = new Hono<{ Bindings: Bindings }>();

  app.get("/", (c) => {
    const env = getEnv(c.env);

    return c.json({
      name: "sqlmate-telemetry",
      status: "ok",
      environment: env.NODE_ENV,
    });
  });

  app.route("/v1/telemetry", buildTelemetryRouter());
  app.route("/v1/public", buildPublicRouter());

  return app;
};

const app = createApp();

export default app;
