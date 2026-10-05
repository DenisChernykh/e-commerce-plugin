import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { WorkerHttpEnv } from "./environment";

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    code: z.string(),
    requestId: z.string(),
  })
  .openapi("ProblemDetails");

export function problem(
  c: Context<WorkerHttpEnv>,
  status: 400 | 404 | 500,
  code: string,
  detail: string,
) {
  const titles = { 400: "Invalid request", 404: "Not found", 500: "Internal server error" };
  return c.json(
    {
      type: `urn:tiho:problem:${code.toLowerCase().replaceAll("_", "-")}`,
      title: titles[status],
      status,
      detail,
      code,
      instance: new URL(c.req.url).pathname,
      requestId: c.get("requestId"),
    },
    status,
    { "Content-Type": "application/problem+json" },
  );
}
