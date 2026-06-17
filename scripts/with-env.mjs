#!/usr/bin/env node
/**
 * Run a command with .env / .env.local loaded into process.env, WITHOUT echoing
 * secret values (they never hit the shell command line or this transcript).
 * Next.js loads these files itself; CLI tools (drizzle-kit, seed) do not — this
 * bridges that gap.
 *
 *   node scripts/with-env.mjs npx drizzle-kit migrate
 *   node scripts/with-env.mjs node scripts/seed.mjs
 *
 * .env.local overrides .env. Existing process.env wins over both.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

function loadFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const merged = { ...loadFile(".env"), ...loadFile(".env.local") };
for (const [k, v] of Object.entries(merged)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error("usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(2);
}

const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
