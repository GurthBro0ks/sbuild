import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkupAiContext,
  MAX_MARKUP_AI_NOTE_CHARS,
  MAX_MARKUP_AI_NOTES
} from "../dist-test/markupAiContext.js";

function note(index, text = `note text ${index}`) {
  return {
    id: `note-${index}`,
    type: "note",
    pageId: "page-1",
    blockId: `block-${index}`,
    x: 0.1,
    y: 0.2,
    text
  };
}

test("buildMarkupAiContext includes page block and viewport identity", () => {
  const context = buildMarkupAiContext({
    page: { id: "page-1", title: "Home", slug: "/" },
    selectedBlock: { id: "hero-1", type: "hero", data: { heading: "Fresh produce" }, styles: {} },
    viewportMode: "desktop",
    notes: [],
    freehandStrokes: []
  });
  assert.ok(context);
  assert.equal(context.page?.id, "page-1");
  assert.equal(context.selectedBlock?.id, "hero-1");
  assert.equal(context.selectedBlock?.title, "Fresh produce");
  assert.equal(context.viewportMode, "desktop");
});

test("buildMarkupAiContext includes bounded note snippets", () => {
  const context = buildMarkupAiContext({
    page: { id: "page-1", title: "Home", slug: "/" },
    selectedBlock: null,
    viewportMode: "phone",
    notes: [note(1, "  first   note\nwith spacing  ")],
    freehandStrokes: []
  });
  assert.equal(context?.notes[0].snippet, "first note with spacing");
});

test("buildMarkupAiContext truncates note snippets to 200 chars", () => {
  const context = buildMarkupAiContext({
    page: { id: "page-1", title: "Home", slug: "/" },
    selectedBlock: null,
    viewportMode: "tablet",
    notes: [note(1, "x".repeat(MAX_MARKUP_AI_NOTE_CHARS + 25))],
    freehandStrokes: []
  });
  assert.equal(context?.notes[0].snippet.length, MAX_MARKUP_AI_NOTE_CHARS);
});

test("buildMarkupAiContext limits notes to 20", () => {
  const context = buildMarkupAiContext({
    page: { id: "page-1", title: "Home", slug: "/" },
    selectedBlock: null,
    viewportMode: "desktop",
    notes: Array.from({ length: MAX_MARKUP_AI_NOTES + 5 }, (_, index) => note(index + 1)),
    freehandStrokes: []
  });
  assert.equal(context?.notes.length, MAX_MARKUP_AI_NOTES);
  assert.equal(context?.noteCountTotal, MAX_MARKUP_AI_NOTES + 5);
});

test("buildMarkupAiContext includes freehand count only and excludes raw stroke geometry", () => {
  const context = buildMarkupAiContext({
    page: { id: "page-1", title: "Home", slug: "/" },
    selectedBlock: null,
    viewportMode: "desktop",
    notes: [],
    freehandStrokes: [
      { id: "stroke-1", pageId: "page-1", color: "#000", size: 4, points: [{ x: 0.12345, y: 0.6789 }] }
    ]
  });
  const serialized = JSON.stringify(context);
  assert.equal(context?.freehand.strokeCount, 1);
  assert.equal(serialized.includes("0.12345"), false);
  assert.equal(serialized.includes("0.6789"), false);
});

test("buildMarkupAiContext handles empty Markup safely", () => {
  const context = buildMarkupAiContext({
    page: null,
    selectedBlock: null,
    viewportMode: "",
    notes: [],
    freehandStrokes: []
  });
  assert.equal(context, null);
});
