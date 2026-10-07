import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { BackendFetch, Environment } from "./backend-client";
import { createServer } from "./server";

export function createWorker(fetchBackend: BackendFetch = fetch, ui = "", skill = "") {
  return {
    async fetch(request: Request, env: Environment): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/" && request.method === "GET")
        return new Response(
          '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TIHO в ChatGPT</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%233e4b39%22/%3E%3Ctext x=%2211%22 y=%2225%22 font-size=%2226%22 fill=%22white%22%3Et%3C/text%3E%3C/svg%3E"><h1>TIHO в ChatGPT</h1><p>Подбор и сравнение предметов для дома по реальному каталогу.</p><p>Плагины → Личные → Созданные вами → TIHO → Установить → Подключить.</p><a href="https://tiho-store.vercel.app/plugins">Подключение и примеры запросов</a></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      if (url.pathname !== "/mcp") return new Response("Не найдено", { status: 404 });
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin)
        return new Response("Недопустимый источник", { status: 403 });
      if (request.method === "POST" && request.body) {
        const reader = request.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 65536) {
              await reader.cancel();
              return new Response("Слишком большой запрос", { status: 413 });
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.byteLength;
        }
        request = new Request(request, { body });
      }
      const server = createServer(env, fetchBackend, ui, skill, request);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        const response = await transport.handleRequest(request);
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("X-Content-Type-Options", "nosniff");
        return response;
      } finally {
        await server.close();
      }
    },
  };
}
