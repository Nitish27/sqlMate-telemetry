import { z } from "zod";

const bindingsSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  NODE_ENV: z.string().default("development"),
});

export type Bindings = z.input<typeof bindingsSchema>;
export type AppEnv = z.output<typeof bindingsSchema>;

export const getEnv = (bindings: Bindings): AppEnv => bindingsSchema.parse(bindings);
