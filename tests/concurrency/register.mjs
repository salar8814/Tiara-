// Lets plain `node` child processes run the real TypeScript repository code:
// maps the "@/..." alias and extensionless imports to .ts files, and
// "server-only" to its empty module. Type syntax is handled by
// node --experimental-transform-types (Node ≥ 22.7).
import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);
