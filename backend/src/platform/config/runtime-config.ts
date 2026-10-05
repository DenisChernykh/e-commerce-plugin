import { z } from "zod";

const configSchema = z.object({ BUILD_REVISION: z.string().min(1).max(128) });

export function readRuntimeConfig(bindings: CloudflareBindings) {
  const config = configSchema.parse(bindings);
  return { buildRevision: config.BUILD_REVISION };
}
