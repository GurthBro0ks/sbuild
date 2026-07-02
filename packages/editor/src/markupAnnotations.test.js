import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MARKUP_NOTE_COLOR,
  MARKUP_NOTE_COLOR_PALETTE,
  resolveMarkupNoteColor,
  updateMarkupAnnotationColor
} from "../dist-test/markupAnnotations.js";

test("resolveMarkupNoteColor returns default yellow for missing colors", () => {
  assert.equal(resolveMarkupNoteColor(), DEFAULT_MARKUP_NOTE_COLOR);
  assert.equal(resolveMarkupNoteColor(""), DEFAULT_MARKUP_NOTE_COLOR);
  assert.equal(resolveMarkupNoteColor(null), DEFAULT_MARKUP_NOTE_COLOR);
});

test("resolveMarkupNoteColor returns default yellow for arbitrary or invalid colors", () => {
  assert.equal(resolveMarkupNoteColor("#123456"), DEFAULT_MARKUP_NOTE_COLOR);
  assert.equal(resolveMarkupNoteColor("red"), DEFAULT_MARKUP_NOTE_COLOR);
  assert.equal(resolveMarkupNoteColor("var(--editor-highlight)"), DEFAULT_MARKUP_NOTE_COLOR);
});

test("resolveMarkupNoteColor accepts every fixed palette color", () => {
  for (const color of MARKUP_NOTE_COLOR_PALETTE) {
    assert.equal(resolveMarkupNoteColor(color.value), color.value);
    assert.equal(resolveMarkupNoteColor(color.value.toUpperCase()), color.value);
  }
});

test("updateMarkupAnnotationColor changes only color and updatedAt for the selected note", () => {
  const annotations = [
    { id: "note-1", type: "note", pageId: "page-1", x: 0.2, y: 0.3, text: "one", color: "#ffcf33", updatedAt: "old" },
    { id: "note-2", type: "note", pageId: "page-1", x: 0.7, y: 0.8, text: "two", color: "#60a5fa", updatedAt: "old" }
  ];
  const updated = updateMarkupAnnotationColor(annotations, "note-1", "#34d399", "new");
  assert.deepEqual(updated[0], { ...annotations[0], color: "#34d399", updatedAt: "new" });
  assert.equal(updated[0].x, 0.2);
  assert.equal(updated[0].y, 0.3);
  assert.equal(updated[1], annotations[1]);
});
