import { z } from "zod";
import { CommerceService } from "./application/commerce-service";
import { SessionService } from "./application/session-service";
import { D1CommerceRepository } from "./infrastructure/d1-commerce-repository";
import { D1SessionStore } from "./infrastructure/d1-session-store";
import { createCommerceHttp } from "./presentation/http";

export function createCommerceModule() {
  return {
    router: createCommerceHttp((env) => ({
      service: new CommerceService(new D1CommerceRepository(env.DB), {
        enabled:
          env.PAYMENT_ADAPTER === "internal_presentation" &&
          ["local", "presentation"].includes(env.APP_ENV),
        outcome: z.enum(["success", "failure", "fail_once"]).parse(env.PAYMENT_OUTCOME),
        delayMs: z.coerce.number().int().min(0).max(10000).parse(env.PAYMENT_DELAY_MS),
      }),
      sessions: new SessionService(new D1SessionStore(env.DB)),
    })),
  };
}
