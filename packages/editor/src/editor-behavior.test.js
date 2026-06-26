import assert from "node:assert/strict";
import test from "node:test";
import {
  createImageDeleteRequest,
  getBuildIdentityState,
  getSaveFailureState,
  shouldSyncEditableTextContent
} from "../dist-test/editorBehavior.js";

test("EditableText sync gate keeps focused typing in normal order", () => {
  const phrase = "black fish farms";
  let domText = "";
  let committedValue = "";
  let caret = 0;

  for (const ch of phrase) {
    domText = domText.slice(0, caret) + ch + domText.slice(caret);
    caret += 1;
    committedValue = domText;

    if (shouldSyncEditableTextContent(true, false)) {
      domText = committedValue;
      caret = domText.length;
    }
  }

  assert.equal(domText, phrase);
  assert.notEqual(domText, phrase.split("").reverse().join(""));
  assert.equal(shouldSyncEditableTextContent(false, false), true);
  assert.equal(shouldSyncEditableTextContent(false, true), false);
});

test("save failure state surfaces the error and preserves dirty retry state", () => {
  const failure = getSaveFailureState(new Error("disk full"));
  assert.deepEqual(failure, {
    dirty: true,
    status: "Save failed: disk full",
    lastAction: "save"
  });

  const unknownFailure = getSaveFailureState("network down");
  assert.equal(unknownFailure.dirty, true);
  assert.equal(unknownFailure.status, "Save failed: could not save project");
});

test("image delete UI behavior targets the canonical delete endpoint", () => {
  const request = createImageDeleteRequest(["/project/images/one.png", "/project/images/two.webp"]);
  assert.equal(request.url, "/api/images/delete");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.body, JSON.stringify({ paths: ["/project/images/one.png", "/project/images/two.webp"] }));
});

test("build identity behavior ignores repo HEAD diagnostics and preserves stale-bundle warnings", () => {
  const docsOnlyDrift = getBuildIdentityState({
    ok: true,
    version: "0.5.0-dev",
    displayVersion: "0.5.0-dev.137+1e40434",
    gitCommit: "1e40434",
    gitCommitFull: "1e40434abcd",
    repoHeadCommit: "90e7b10",
    repoHeadCommitFull: "90e7b10abcd",
    branch: "main",
    buildDate: "2026-06-26T00:00:00Z",
    commitCount: 137,
    dirty: false,
    repoDirty: false
  }, "ok", "1e40434");

  assert.equal(docsOnlyDrift.status, "match");
  assert.equal(docsOnlyDrift.serverCommit, "1e40434");

  const staleBundle = getBuildIdentityState({
    ok: true,
    version: "0.5.0-dev",
    displayVersion: "0.5.0-dev.139+f8197d3",
    gitCommit: "f8197d3",
    gitCommitFull: "f8197d3abcd",
    repoHeadCommit: "f8197d3",
    repoHeadCommitFull: "f8197d3abcd",
    branch: "main",
    buildDate: "2026-06-26T00:00:00Z",
    commitCount: 139,
    dirty: false,
    repoDirty: false
  }, "ok", "1e40434");

  assert.equal(staleBundle.status, "mismatch");
  assert.match(staleBundle.message, /Browser\/server build mismatch/);
});
