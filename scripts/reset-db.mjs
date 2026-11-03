// Deletes the local SQLite database; it is recreated and re-seeded from
// src/data/* on the next request.
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.env.DATABASE_PATH ?? "./data/tiara.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) {
  if (fs.existsSync(f)) {
    fs.rmSync(f);
    console.log("removed", f);
  }
}
