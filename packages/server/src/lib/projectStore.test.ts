import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectForStorage } from "./projectStore.js";
import type { SBuildProject } from "@sbuild/shared";

function baseProject(overrides: Partial<SBuildProject> = {}): SBuildProject {
  return {
    version: "0.1.0",
    updatedAt: "2026-06-27T00:00:00.000Z",
    site: {
      siteName: "Test Site",
      title: "Test Site",
      description: "A test site",
      nav: []
    },
    globalStyles: {
      headingFont: "Inter",
      bodyFont: "Inter",
      colors: {
        bg: "#ffffff",
        surface: "#f6f6f6",
        text: "#111111",
        accent: "#2b6dff",
        muted: "#666666"
      }
    },
    ai: {
      provider: "disabled",
      model: ""
    },
    deploy: {
      method: "dry-run",
      webRoot: ""
    },
    pages: [
      {
        id: "page-home",
        slug: "/",
        title: "Home",
        blocks: []
      }
    ],
    ...overrides
  };
}

test("projects without Markup annotations normalize to an empty collection", () => {
  const project = baseProject();

  const normalized = normalizeProjectForStorage(project);

  assert.deepEqual(normalized.markupAnnotations, []);
});

test("Markup note annotations round trip through project normalization", () => {
  const normalized = normalizeProjectForStorage(
    baseProject({
      markupAnnotations: [
        {
          id: "note-1",
          type: "note",
          pageId: "page-home",
          blockId: "block-1",
          x: 0.25,
          y: 0.75,
          text: "Check this section",
          color: "#ffcf33",
          createdAt: "2026-06-27T01:00:00.000Z",
          updatedAt: "2026-06-27T02:00:00.000Z"
        }
      ]
    })
  );

  assert.deepEqual(normalized.markupAnnotations, [
    {
      id: "note-1",
      type: "note",
      pageId: "page-home",
      blockId: "block-1",
      x: 0.25,
      y: 0.75,
      text: "Check this section",
      color: "#ffcf33",
      createdAt: "2026-06-27T01:00:00.000Z",
      updatedAt: "2026-06-27T02:00:00.000Z"
    }
  ]);
});

test("Markup annotation normalization filters unsupported records and clamps note coordinates", () => {
  const normalized = normalizeProjectForStorage(
    baseProject({
      markupAnnotations: [
        { id: "bad-type", type: "rectangle", pageId: "page-home", x: 0.1, y: 0.2, text: "Nope" } as any,
        { id: "", type: "note", pageId: "page-home", x: 0.1, y: 0.2, text: "No id" } as any,
        { id: "note-2", type: "note", pageId: "page-home", x: -2, y: 2, text: "Clamp me" }
      ]
    })
  );

  assert.equal(normalized.markupAnnotations?.length, 1);
  assert.equal(normalized.markupAnnotations?.[0]?.id, "note-2");
  assert.equal(normalized.markupAnnotations?.[0]?.x, 0);
  assert.equal(normalized.markupAnnotations?.[0]?.y, 1);
});
