import test from "node:test";
import assert from "node:assert/strict";
import { clampMinHeight, clampWidthPercent, groupBlocksIntoRows, joinWithNext, joinWithPrevious, snapMinHeight, snapWidthPercent } from "@sbuild/shared";

test("groupBlocksIntoRows groups consecutive rowIds and keeps order", () => {
  const blocks = [
    { id: "a", type: "text", data: { body: "a" }, styles: { layout: { rowId: "r1" } } },
    { id: "b", type: "text", data: { body: "b" }, styles: { layout: { rowId: "r1" } } },
    { id: "c", type: "text", data: { body: "c" }, styles: {} },
    { id: "d", type: "text", data: { body: "d" }, styles: { layout: { rowId: "r2" } } }
  ] as any[];
  const rows = groupBlocksIntoRows(blocks as any);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].blocks.map((b) => b.id), ["a", "b"]);
  assert.deepEqual(rows[1].blocks.map((b) => b.id), ["c"]);
  assert.deepEqual(rows[2].blocks.map((b) => b.id), ["d"]);
});

test("joinWithPrevious and joinWithNext resolve row ids", () => {
  const blocks = [
    { id: "a", styles: { layout: { rowId: "r1" } } },
    { id: "b", styles: {} },
    { id: "c", styles: { layout: { rowId: "r2" } } }
  ] as any[];
  assert.equal(joinWithPrevious(blocks as any, 1), "r1");
  assert.equal(joinWithNext(blocks as any, 1), "r2");
});

test("resize helpers clamp and snap", () => {
  assert.equal(clampWidthPercent(1), 25);
  assert.equal(clampWidthPercent(140), 100);
  assert.equal(snapWidthPercent(74), 75);
  assert.equal(clampMinHeight(30), 120);
  assert.equal(clampMinHeight(999), 640);
  assert.equal(snapMinHeight(238), 240);
});
