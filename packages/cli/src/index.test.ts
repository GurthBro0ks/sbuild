import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The CLI entry is a small side-effecting script (it prints and exits), so we
// test its real observable behavior by spawning it, rather than asserting on
// source text. Node runs the .ts entry directly via built-in type stripping.
const cliEntry = fileURLToPath(new URL("./index.ts", import.meta.url));

function runCli(args: string[], env: Record<string, string> = {}): string {
  return execFileSync("node", [cliEntry, ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_NO_WARNINGS: "1", ...env }
  });
}

test("cli --help prints usage and exits 0", () => {
  const out = runCli(["--help"]);
  assert.match(out, /sbuild prototype CLI/);
  assert.match(out, /Usage:/);
});

test("cli default run prints start instructions with the configured port", () => {
  const out = runCli([], { PORT: "4242" });
  assert.match(out, /sbuild prototype is installed/);
  assert.match(out, /Start server:/);
  assert.match(out, /Start editor:/);
  assert.match(out, /4242/);
});

test("cli default run falls back to port 3137 when PORT is unset", () => {
  // execFileSync inherits process.env; build an env that explicitly drops PORT.
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_NO_WARNINGS: "1" };
  delete env.PORT;
  const out = execFileSync("node", [cliEntry], { encoding: "utf8", env });
  assert.match(out, /3137/);
});
