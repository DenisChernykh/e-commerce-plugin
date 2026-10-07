import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import worker from "../dist/server/index.js";

const port = Number(process.env.PORT || 8790);
const env = {
  CATALOG_API_URL: process.env.CATALOG_API_URL,
  STORE_URL: process.env.STORE_URL,
  TIHO_MCP_SECRET: process.env.TIHO_MCP_SECRET,
  MCP_AUTH_MODE: process.env.MCP_AUTH_MODE,
  DEV_MCP_USER: process.env.DEV_MCP_USER,
};
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/preview" || req.url === "/ui.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        await readFile(
          req.url === "/preview"
            ? new URL("./preview.html", import.meta.url)
            : new URL("../dist/ui.html", import.meta.url),
        ),
      );
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("Preview server error");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `TIHO MCP http://127.0.0.1:${port}/mcp · UI test host http://127.0.0.1:${port}/preview`,
  ),
);
