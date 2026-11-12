import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the actual UI handler with a fake transport and state setters.
// No browser, API server, or filesystem publishing is involved.
const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const start = source.indexOf("  async function runPublish() {");
const end = source.indexOf("\n  async function chat()", start);
assert.ok(start > 0 && end > start);
const handler = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const createHandler = new Function("fetchJson", "setStatus", "setLastAction", `${handler}; return runPublish;`);

test("dry-run button sends explicit intent and requires server dry-run confirmation", async () => {
  assert.match(source, /onClick=\{\(\) => void runPublish\(\)\}>Run publish dry-run<\/button>/);
  for (const response of [{ ok: true, dryRun: true, target: "synthetic-preview" }, { ok: true, dryRun: false }, { ok: true }, { ok: false, dryRun: true }]) {
    const statuses = [];
    const actions = [];
    const run = createHandler(async (url, options) => {
      assert.equal(url, "/api/publish");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { dryRun: true });
      return response;
    }, (status) => statuses.push(status), (action) => actions.push(action));
    await run();
    if (response.ok && response.dryRun === true) {
      assert.match(statuses.at(-1), /^Dry-run complete: no public changes made/);
      assert.deepEqual(actions, ["publish"]);
    } else {
      assert.match(statuses.at(-1), /^Publish dry-run failed:/);
      assert.deepEqual(actions, []);
    }
  }
});

test("transport errors leave the button in a clear failure state", async () => {
  const statuses = [];
  await createHandler(async () => { throw new Error("synthetic transport failure"); }, (status) => statuses.push(status), () => assert.fail("must not report success"))();
  assert.equal(statuses.at(-1), "Publish dry-run failed: synthetic transport failure");
});
