import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll } from "vitest";
import { seedStatements } from "../seed/sql";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const statements = seedStatements();
  for (let offset = 0; offset < statements.length; offset += 40) {
    await env.DB.batch(
      statements.slice(offset, offset + 40).map((statement) => env.DB.prepare(statement)),
    );
  }
});
