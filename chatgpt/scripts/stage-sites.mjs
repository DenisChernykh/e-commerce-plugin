import { cp } from "node:fs/promises";

await cp("chatgpt/dist", "dist", { recursive: true });
