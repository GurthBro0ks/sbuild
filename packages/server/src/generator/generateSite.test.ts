import test from "node:test";
import assert from "node:assert/strict";
import { renderBlock, renderSiteDocument, renderSiteStyles } from "./generateSite.js";
import type { Block, SBuildProject } from "@sbuild/shared";

// renderBlock is the pure HTML renderer at the heart of generateSite(). These
// tests exercise real rendering + escaping behavior without writing to disk
// (generateSite() itself targets a fixed production dist directory).
function block(type: Block["type"], data: any, id = `blk-${type}`): Block {
  return { id, type, data };
}

function projectWithBlocks(blocks: Block[]): SBuildProject {
  return {
    version: "0.1.0",
    updatedAt: "2026-07-08T00:00:00.000Z",
    site: {
      siteName: "Public Site",
      title: "Public Site",
      description: "Public description",
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
        blocks
      }
    ]
  };
}

test("renderBlock hero renders heading, subheading, and CTA", () => {
  const html = renderBlock(
    block("hero", { heading: "Welcome", subheading: "to the farm", ctaLabel: "Shop", ctaHref: "/shop" })
  );
  assert.match(html, /<section [^>]*class="block [^"]*type-hero"/);
  assert.match(html, /<h1>Welcome<\/h1>/);
  assert.match(html, /<p>to the farm<\/p>/);
  assert.match(html, /<a class="btn" href="\/shop">Shop<\/a>/);
});

test("renderBlock hero omits the CTA anchor when no ctaLabel is set", () => {
  const html = renderBlock(block("hero", { heading: "Hi", subheading: "" }));
  assert.doesNotMatch(html, /class="btn"/);
});

test("renderBlock text renders title and body", () => {
  const html = renderBlock(block("text", { title: "About Us", body: "We grow corn." }));
  assert.match(html, /type-text/);
  assert.match(html, /<h2>About Us<\/h2>/);
  assert.match(html, /<p>We grow corn\.<\/p>/);
});

test("renderBlock image renders src and alt, and caption only when present", () => {
  const withCaption = renderBlock(
    block("image", { src: "/images/a.png", alt: "a barn", caption: "Our barn" })
  );
  assert.match(withCaption, /<img src="\/images\/a\.png" alt="a barn"\/>/);
  assert.match(withCaption, /<p>Our barn<\/p>/);

  const noCaption = renderBlock(block("image", { src: "/images/a.png", alt: "a barn" }));
  assert.doesNotMatch(noCaption, /<p>/);
});

test("renderBlock cards renders one article per card", () => {
  const html = renderBlock(
    block("cards", {
      title: "Picks",
      cards: [
        { title: "Apples", body: "Crisp" },
        { title: "Pears", body: "Sweet" }
      ]
    })
  );
  assert.match(html, /<h2>Picks<\/h2>/);
  assert.equal((html.match(/<article>/g) || []).length, 2);
  assert.match(html, /<h3>Apples<\/h3>/);
  assert.match(html, /<h3>Pears<\/h3>/);
});

test("renderBlock escapes user-controlled HTML to prevent injection", () => {
  const html = renderBlock(
    block("text", { title: "<script>alert(1)</script>", body: 'a & b "c" <d>' })
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /a &amp; b &quot;c&quot; &lt;d&gt;/);
});

test("renderBlock divider emits an hr and carries the block id/class", () => {
  const html = renderBlock(block("divider", {}, "div-1"));
  assert.match(html, /<hr id="div-1" class="block block-div-1 type-divider" \/>/);
});

test("renderBlock falls back to a safe placeholder for unknown block types", () => {
  const html = renderBlock(block("totally-unknown" as Block["type"], {}));
  assert.match(html, /Unsupported block type/);
});

test("renderSiteStyles emits block background preset styles", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("hero", { heading: "Welcome" }, "hero-bg"),
        styles: { backgroundStyle: "glass" }
      }
    ])
  );

  assert.match(css, /\.block-hero-bg\{/);
  assert.match(css, /backdrop-filter:blur\(12px\);/);
  assert.match(css, /background:rgba\(255,255,255,0\.08\);/);
  assert.match(css, /border:1px solid rgba\(255,255,255,0\.15\);/);
});

test("renderSiteStyles emits block border preset styles", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("text", { title: "About", body: "Body" }, "text-border"),
        styles: { borderStyle: "dashed" }
      }
    ])
  );

  assert.match(css, /\.block-text-border\{/);
  assert.match(css, /border:2px dashed rgba\(0,0,0,\.08\);/);
});

test("renderSiteStyles keeps styles.parts out of this slice", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("text", { title: "About", body: "Body" }, "text-supported-only"),
        styles: {
          backgroundStyle: "soft",
          borderStyle: "thin",
          shadowStyle: "neon",
          textEffect: "outline",
          buttonStyle: "glow",
          parts: { heading: { textColor: "#ff00ff" } }
        } as Block["styles"]
      }
    ])
  );

  assert.match(css, /box-shadow:0 8px 32px rgba\(0,0,0,0\.08\);/);
  assert.match(css, /border:1px solid rgba\(0,0,0,\.08\);/);
  assert.match(css, /0 0 24px rgba\(0,255,170,0\.35\)/);
  assert.match(css, /-webkit-text-stroke:1px currentColor;/);
  assert.doesNotMatch(css, /#ff00ff/);
});

test("renderSiteStyles emits block shadowStyle preset styles", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("text", { title: "About", body: "Body" }, "text-shadow"),
        styles: { shadowStyle: "lifted" }
      }
    ])
  );

  assert.match(css, /\.block-text-shadow\{/);
  assert.match(css, /box-shadow:0 12px 24px rgba\(0,0,0,0\.12\);/);
});

test("renderSiteStyles emits block textEffect preset styles", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("hero", { heading: "Welcome" }, "hero-text-effect"),
        styles: { textEffect: "strong-glow" }
      }
    ])
  );

  assert.match(css, /\.block-hero-text-effect\{/);
  assert.match(css, /text-shadow:0 0 16px rgba\(0,255,170,0\.6\);/);
});

test("renderSiteStyles emits block buttonStyle preset styles scoped to the block's .btn", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      {
        ...block("hero", { heading: "Welcome", ctaLabel: "Shop" }, "hero-btn"),
        styles: { buttonStyle: "outline" }
      }
    ])
  );

  assert.match(css, /\.block-hero-btn \.btn\{background:transparent;color:var\(--accent\);border:2px solid var\(--accent\);\}/);
});

test("renderSiteDocument excludes editor-only Markup annotations from public output", () => {
  const project: SBuildProject = {
    version: "0.1.0",
    updatedAt: "2026-06-27T00:00:00.000Z",
    site: {
      siteName: "Public Site",
      title: "Public Site",
      description: "Public description",
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
    markupAnnotations: [
      {
        id: "private-note-1",
        type: "note",
        pageId: "page-home",
        x: 0.5,
        y: 0.5,
        text: "Internal annotation only"
      }
    ],
    markupFreehandStrokes: [
      {
        id: "private-freehand-1",
        pageId: "page-home",
        points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
        color: "#2b6dff",
        size: 4,
        opacity: 1
      }
    ],
    pages: [
      {
        id: "page-home",
        slug: "/",
        title: "Home",
        blocks: [block("text", { title: "Visible", body: "Public body" })]
      }
    ]
  };

  const html = renderSiteDocument(project);

  assert.match(html, /Public body/);
  assert.doesNotMatch(html, /markupAnnotations/);
  assert.doesNotMatch(html, /markupFreehandStrokes/);
  assert.doesNotMatch(html, /private-note-1/);
  assert.doesNotMatch(html, /private-freehand-1/);
  assert.doesNotMatch(html, /Internal annotation only/);
});
