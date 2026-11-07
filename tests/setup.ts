import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// One throw-away database per test file (each file runs in its own fork).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tiara-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
