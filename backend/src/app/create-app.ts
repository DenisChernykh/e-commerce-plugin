import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { createCatalogModule } from "../modules/catalog";
import { createCommerceModule } from "../modules/commerce";
import { readRuntimeConfig } from "../platform/config/runtime-config";
import type { WorkerHttpEnv } from "../platform/http/environment";
import { problem, problemDetailsSchema } from "../platform/http/problem-details";

export function createApp() {
  const app = new OpenAPIHono<WorkerHttpEnv>();
  app.use("*", async (context, next) => {
    context.set("requestId", crypto.randomUUID());
    context.header("X-Request-Id", context.get("requestId"));
    context.header("X-Content-Type-Options", "nosniff");
    await next();
  });
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      exposeHeaders: ["X-Request-Id"],
    }),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/health",
      tags: ["System"],
      operationId: "getHealth",
      summary: "Worker liveness; does not query the database",
      responses: {
        200: {
          description: "Worker is available",
          content: {
            "application/json": {
              schema: z.object({ status: z.literal("ok"), revision: z.string() }),
            },
          },
        },
        500: {
          description: "Runtime configuration error",
          content: { "application/problem+json": { schema: problemDetailsSchema } },
        },
      },
    }),
    (context) =>
      context.json(
        { status: "ok" as const, revision: readRuntimeConfig(context.env).buildRevision },
        200,
      ),
  );
  app.route("/", createCatalogModule().router);
  app.route("/", createCommerceModule().router);
  app.get("/openapi.json", (context) =>
    context.json(
      app.getOpenAPI31Document({
        openapi: "3.1.0",
        info: {
          title: "TIHO Catalog API",
          version: "0.1.0",
          description:
            "Public read-only lifestyle catalog. Stable UUIDs and slugs, structured attributes, search and composable filters. Prices are RUB. No authentication required.",
        },
      }),
    ),
  );
  app.notFound((context) =>
    problem(context, 404, "NOT_FOUND", "The requested resource does not exist."),
  );
  app.onError((error, context) => {
    console.error(
      JSON.stringify({
        event: "unhandled_request_error",
        error: error.name,
        path: new URL(context.req.url).pathname,
        requestId: context.get("requestId"),
      }),
    );
    return problem(context, 500, "INTERNAL_ERROR", "The request could not be completed.");
  });
  return app;
}
