import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkupExportSummary,
  downloadMarkupExportFile,
  formatMarkupExportJson,
  formatMarkupExportMarkdown,
  markupExportFilename
} from "../dist-test/markupExport.js";
import {
  MAX_MARKUP_AI_NOTE_CHARS,
  MAX_MARKUP_AI_NOTES
} from "../dist-test/markupAiContext.js";

function note(index, text = `note text ${index}`, x = 0.1234, y = 0.9876) {
  return {
    id: `note-${index}`,
    type: "note",
    pageId: "page-1",
    blockId: `block-${index}`,
    x,
    y,
    text,
    color: "#60a5fa"
  };
}

function stroke() {
  return {
    id: "stroke-1",
    pageId: "page-1",
    color: "#000",
    size: 4,
    points: [{ x: 0.12345, y: 0.6789 }]
  };
}

function summary(overrides = {}) {
  return buildMarkupExportSummary({
    page: { id: "page-1", title: "Home", slug: "/farm stand" },
    selectedBlock: { id: "hero-1", type: "hero", data: { heading: "Fresh produce" }, styles: {} },
    viewportMode: "desktop",
    notes: [note(1)],
    freehandStrokes: [stroke()],
    exportedAt: "2026-07-01T11:10:47.000Z",
    buildInfo: {
      displayVersion: "0.5.0-dev.167+3e950c4",
      gitCommit: "3e950c4",
      buildDate: "2026-07-01T10:01:46Z"
    },
    ...overrides
  });
}

test("JSON summary includes timestamp and version fields when provided", () => {
  const output = summary();
  assert.equal(output?.exportedAt, "2026-07-01T11:10:47.000Z");
  assert.equal(output?.build.displayVersion, "0.5.0-dev.167+3e950c4");
  assert.equal(output?.build.gitCommit, "3e950c4");
});

test("JSON summary includes rounded pin coordinates", () => {
  const output = summary({ notes: [note(1, "pin", 0.126, 0.984)] });
  assert.deepEqual(output?.notes[0].pin, { x: 0.13, y: 0.98 });
});

test("JSON summary omits note color from the export contract", () => {
  const output = summary({ notes: [note(1, "pin", 0.126, 0.984)] });
  assert.equal(Object.hasOwn(output?.notes[0] || {}, "color"), false);
  assert.equal(formatMarkupExportJson(output).includes('"color"'), false);
  assert.equal(formatMarkupExportMarkdown(output).includes("#60a5fa"), false);
});

test("JSON summary caps notes at 20", () => {
  const output = summary({
    notes: Array.from({ length: MAX_MARKUP_AI_NOTES + 3 }, (_, index) => note(index + 1))
  });
  assert.equal(output?.notes.length, MAX_MARKUP_AI_NOTES);
  assert.equal(output?.noteCountTotal, MAX_MARKUP_AI_NOTES + 3);
});

test("JSON summary truncates note text to 200 chars", () => {
  const output = summary({ notes: [note(1, "x".repeat(MAX_MARKUP_AI_NOTE_CHARS + 50))] });
  assert.equal(output?.notes[0].snippet.length, MAX_MARKUP_AI_NOTE_CHARS);
});

test("JSON summary includes freehand count only and omits stroke geometry keys", () => {
  const output = summary();
  const serialized = JSON.stringify(output);
  assert.equal(output?.freehand.strokeCount, 1);
  assert.equal(serialized.includes('"points"'), false);
  assert.equal(serialized.includes("0.12345"), false);
  assert.equal(serialized.includes("0.6789"), false);
});

test("JSON summary is not a complete project backup", () => {
  const output = summary();
  assert.equal(Object.hasOwn(output || {}, "pages"), false);
  assert.equal(Object.hasOwn(output || {}, "site"), false);
  assert.equal(Object.hasOwn(output || {}, "theme"), false);
});

test("Markdown export includes private wording and expected sections", () => {
  const output = summary();
  assert.ok(output);
  const markdown = formatMarkupExportMarkdown(output);
  assert.match(markdown, /Private editor export\. Not published\./);
  assert.match(markdown, /## Page/);
  assert.match(markdown, /## Selection/);
  assert.match(markdown, /## Notes/);
  assert.match(markdown, /## Freehand/);
});

test("filename builder uses safe page slug and UTC timestamp", () => {
  assert.equal(
    markupExportFilename("/Farm Stand!", "2026-07-01T11:10:47.000Z", "md"),
    "markup-export-farm-stand-20260701T111047Z.md"
  );
});

test("download helper uses Blob URL and programmatic download path", () => {
  const output = summary();
  assert.ok(output);
  const calls = [];
  const originalBlob = globalThis.Blob;
  const originalUrl = globalThis.URL;
  const originalDocument = globalThis.document;

  globalThis.Blob = class FakeBlob {
    constructor(parts, options) {
      calls.push(["blob", parts.join(""), options.type]);
    }
  };
  globalThis.URL = {
    createObjectURL(blob) {
      calls.push(["createObjectURL", blob.constructor.name]);
      return "blob:markup-export";
    },
    revokeObjectURL(url) {
      calls.push(["revokeObjectURL", url]);
    }
  };
  const link = {
    href: "",
    download: "",
    click() {
      calls.push(["click", this.href, this.download]);
    },
    remove() {
      calls.push(["remove"]);
    }
  };
  globalThis.document = {
    body: {
      appendChild(node) {
        calls.push(["appendChild", node]);
      }
    },
    createElement(tag) {
      calls.push(["createElement", tag]);
      return link;
    }
  };

  try {
    downloadMarkupExportFile(output, "json");
  } finally {
    globalThis.Blob = originalBlob;
    globalThis.URL = originalUrl;
    globalThis.document = originalDocument;
  }

  assert.deepEqual(calls.map((call) => call[0]), ["blob", "createObjectURL", "createElement", "appendChild", "click", "remove", "revokeObjectURL"]);
  assert.equal(calls[4][2], "markup-export-farm-stand-20260701T111047Z.json");
  assert.doesNotThrow(() => JSON.parse(formatMarkupExportJson(output)));
});
