import test from "node:test";
import assert from "node:assert/strict";
import {
  renderBlock,
  renderGeneratedSiteFiles,
  renderRobotsTxt,
  renderSiteDocument,
  renderSiteStyles,
  renderSitemap
} from "./generateSite.js";
import { makeBlock, makeProject, makeTwoPageProject } from "./__fixtures__/syntheticProject.js";
import type { Block, BlockStyles } from "@sbuild/shared";

// renderBlock is the pure HTML renderer at the heart of generateSite(). These
// tests exercise real rendering + escaping behavior without writing to disk
// (generateSite() itself targets a fixed production dist directory).
function block(type: Block["type"], data: any, id = `blk-${type}`): Block {
  return makeBlock(type, { id, data });
}

function projectWithBlocks(blocks: Block[]) {
  return makeProject({
    blocks,
    site: {
      siteName: "Public Site",
      title: "Public Site",
      description: "Public description",
      nav: []
    }
  });
}

function makeThreePageProject() {
  return makeProject({
    site: {
      siteName: "Blackfish Farms",
      title: "Blackfish Farms",
      description: "Local farm stand and seasonal produce.",
      domain: "blackfishfarms.com",
      nav: [
        { id: "nav-home", label: "Home", href: "/" },
        { id: "nav-about", label: "About", href: "/about" },
        { id: "nav-contact", label: "Contact", href: "/contact" }
      ]
    },
    pages: [
      {
        id: "page-home",
        slug: "/",
        title: "Home",
        blocks: [makeBlock("text", { id: "home-body", data: { title: "Home", body: "Home page body." } })]
      },
      {
        id: "page-about",
        slug: "/about",
        title: "About",
        blocks: [makeBlock("text", { id: "about-body", data: { title: "About", body: "About page body." } })]
      },
      {
        id: "page-contact",
        slug: "/contact",
        title: "Contact",
        blocks: [makeBlock("contact", { id: "contact-body", data: { title: "Contact", phone: "555-0100", email: "hello@example.test", address: "100 Farm Road" } })]
      }
    ]
  });
}

function cssForPreset(family: keyof Pick<BlockStyles, "backgroundStyle" | "borderStyle" | "shadowStyle" | "textEffect" | "buttonStyle">, value: string) {
  const id = `preset-${family}-${value.replace(/[^a-z0-9-]/g, "-")}`;
  const css = renderSiteStyles(
    projectWithBlocks([
      makeBlock("hero", {
        id,
        data: { heading: "Preset", ctaLabel: "Go", ctaHref: "/go" },
        styles: { [family]: value } as BlockStyles
      })
    ])
  );
  return { css, id };
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

for (const preset of [
  { value: "clean", declarations: [] },
  { value: "glass", declarations: ["backdrop-filter:blur(12px);", "-webkit-backdrop-filter:blur(12px);", "background:rgba(255,255,255,0.08);", "border:1px solid rgba(255,255,255,0.15);"] },
  { value: "neon", declarations: ["box-shadow:0 0 20px rgba(0,255,170,0.35), inset 0 0 10px rgba(0,255,170,0.1);", "border:1px solid rgba(0,255,170,0.4);"] },
  { value: "soft", declarations: ["box-shadow:0 8px 32px rgba(0,0,0,0.08);", "border-radius:16px;", "border:1px solid rgba(0,0,0,0.04);"] },
  { value: "bold", declarations: ["box-shadow:0 12px 40px rgba(0,0,0,0.18);", "border-radius:8px;", "border:2px solid var(--accent);"] },
  { value: "terminal", declarations: ["background:#0c0c0c;", "color:#33ff33;", "border:1px solid #3e5a3e;", "font-family:monospace;", "box-shadow:inset 0 0 20px rgba(51,255,51,0.05);"] },
  { value: "image-overlay", declarations: ["background:linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.7));", "color:#ffffff;"] }
] as const) {
  test(`renderSiteStyles maps backgroundStyle=${preset.value}`, () => {
    const { css, id } = cssForPreset("backgroundStyle", preset.value);
    assert.match(css, new RegExp(`\\.block-${id}\\{`));
    for (const declaration of preset.declarations) assert.ok(css.includes(declaration), declaration);
    if (preset.declarations.length === 0) assert.ok(css.includes(`.block-${id}{}`));
  });
}

for (const preset of [
  { value: "none", declarations: ["border:none;"] },
  { value: "thin", declarations: ["border:1px solid rgba(0,0,0,.08);"] },
  { value: "accent", declarations: ["border:2px solid var(--accent);"] },
  { value: "double", declarations: ["border:3px double rgba(0,0,0,.08);"] },
  { value: "dashed", declarations: ["border:2px dashed rgba(0,0,0,.08);"] },
  { value: "glow-edge", declarations: ["border:1px solid rgba(0,255,170,0.5);"] }
] as const) {
  test(`renderSiteStyles maps borderStyle=${preset.value}`, () => {
    const { css, id } = cssForPreset("borderStyle", preset.value);
    assert.match(css, new RegExp(`\\.block-${id}\\{`));
    for (const declaration of preset.declarations) assert.ok(css.includes(declaration), declaration);
  });
}

for (const preset of [
  { value: "none", declarations: [] },
  { value: "soft", declarations: ["box-shadow:0 4px 16px rgba(0,0,0,0.06);"] },
  { value: "lifted", declarations: ["box-shadow:0 12px 24px rgba(0,0,0,0.12);"] },
  { value: "strong", declarations: ["box-shadow:0 16px 48px rgba(0,0,0,0.22);"] },
  { value: "neon", declarations: ["box-shadow:0 0 24px rgba(0,255,170,0.35), 0 0 8px rgba(0,255,170,0.2);"] },
  { value: "inner", declarations: ["box-shadow:inset 0 2px 12px rgba(0,0,0,0.08);"] }
] as const) {
  test(`renderSiteStyles maps shadowStyle=${preset.value}`, () => {
    const { css, id } = cssForPreset("shadowStyle", preset.value);
    assert.match(css, new RegExp(`\\.block-${id}\\{`));
    for (const declaration of preset.declarations) assert.ok(css.includes(declaration), declaration);
    if (preset.declarations.length === 0) assert.ok(css.includes(`.block-${id}{}`));
  });
}

for (const preset of [
  { value: "none", declarations: [] },
  { value: "subtle-glow", declarations: ["text-shadow:0 0 8px rgba(255,255,255,0.35);"] },
  { value: "strong-glow", declarations: ["text-shadow:0 0 16px rgba(0,255,170,0.6);"] },
  { value: "outline", declarations: ["-webkit-text-stroke:1px currentColor;", "color:transparent;"] },
  { value: "shadow", declarations: ["text-shadow:2px 2px 4px rgba(0,0,0,0.35);"] }
] as const) {
  test(`renderSiteStyles maps textEffect=${preset.value}`, () => {
    const { css, id } = cssForPreset("textEffect", preset.value);
    assert.match(css, new RegExp(`\\.block-${id}\\{`));
    for (const declaration of preset.declarations) assert.ok(css.includes(declaration), declaration);
    if (preset.declarations.length === 0) assert.ok(css.includes(`.block-${id}{}`));
  });
}

for (const preset of [
  { value: "solid", declarations: ["background:var(--accent);", "color:#ffffff;", "border:none;"] },
  { value: "outline", declarations: ["background:transparent;", "color:var(--accent);", "border:2px solid var(--accent);"] },
  { value: "ghost", declarations: ["background:transparent;", "color:var(--accent);", "border:1px solid rgba(0,0,0,0.1);"] },
  { value: "pill", declarations: ["background:var(--accent);", "color:#ffffff;", "border:none;", "border-radius:999px;"] },
  { value: "glow", declarations: ["background:var(--accent);", "color:#ffffff;", "border:none;", "box-shadow:0 0 16px rgba(0,255,170,0.45);"] }
] as const) {
  test(`renderSiteStyles maps buttonStyle=${preset.value}`, () => {
    const { css, id } = cssForPreset("buttonStyle", preset.value);
    assert.match(css, new RegExp(`\\.block-${id} \\.btn\\{`));
    for (const declaration of preset.declarations) assert.ok(css.includes(declaration), declaration);
  });
}

test("renderBlock covers generated output for extended block types", () => {
  const cases: Array<{ block: Block; expected: RegExp[] }> = [
    {
      block: makeBlock("hours", { id: "hours-fixture", data: { title: "Pickup Hours", rows: [{ day: "Tuesday", open: "09:00", close: "13:00" }] } }),
      expected: [/type-hours/, /<h2>Pickup Hours<\/h2>/, /<strong>Tuesday<\/strong> 09:00-13:00/]
    },
    {
      block: makeBlock("gallery", { id: "gallery-fixture", data: { title: "Gallery", images: [{ id: "img-1", src: "/images/shed.png", alt: "Packing shed" }] } }),
      expected: [/type-gallery/, /<div class="gallery">/, /<img src="\/images\/shed\.png" alt="Packing shed"\/>/]
    },
    {
      block: makeBlock("contact", { id: "contact-fixture", data: { title: "Contact", phone: "555-0101", email: "team@example.test", address: "10 Test Lane" } }),
      expected: [/type-contact/, /555-0101/, /team@example\.test/, /10 Test Lane/]
    },
    {
      block: makeBlock("testimonial", { id: "testimonial-fixture", data: { quote: "Fresh synthetic produce.", author: "Test Customer" } }),
      expected: [/type-testimonial/, /Fresh synthetic produce\./, /<cite>Test Customer<\/cite>/]
    },
    {
      block: makeBlock("map", { id: "map-fixture", data: { embedUrl: "https://maps.example.test/embed?place=farm" } }),
      expected: [/type-map/, /<h2>Map<\/h2>/, /<iframe src="https:\/\/maps\.example\.test\/embed\?place=farm"><\/iframe>/]
    },
    {
      block: makeBlock("marquee", { id: "marquee-fixture", data: { text: "Market open Saturday" } }),
      expected: [/type-marquee/, /<div class="marquee-track">Market open Saturday<\/div>/]
    },
    {
      block: makeBlock("spacer", { id: "spacer-fixture", data: { height: 48 } }),
      expected: [/type-spacer/, /style="height:48px"/]
    }
  ];

  for (const item of cases) {
    const html = renderBlock(item.block);
    for (const expected of item.expected) assert.match(html, expected);
  }
});

test("renderBlock html pins the current trusted embed boundary", () => {
  // HTML blocks are trusted owner-authored embeds today; they intentionally render raw HTML.
  const html = renderBlock(
    makeBlock("html", {
      id: "html-fixture",
      data: { html: '<div data-synthetic-html="true"><strong>Trusted embed</strong></div>' }
    })
  );

  assert.match(html, /type-html/);
  assert.match(html, /<div data-synthetic-html="true"><strong>Trusted embed<\/strong><\/div>/);
  assert.doesNotMatch(html, /&lt;strong&gt;Trusted embed/);
});

test("renderSiteStyles layers all accepted block preset families on one block", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      makeBlock("hero", {
        id: "all-presets",
        data: { heading: "Layered", ctaLabel: "Shop", ctaHref: "/shop" },
        styles: {
          backgroundStyle: "soft",
          borderStyle: "accent",
          shadowStyle: "lifted",
          textEffect: "shadow",
          buttonStyle: "pill"
        }
      })
    ])
  );

  assert.match(css, /\.block-all-presets\{/);
  assert.ok(css.includes("box-shadow:0 8px 32px rgba(0,0,0,0.08);"));
  assert.ok(css.includes("border:2px solid var(--accent);"));
  assert.ok(css.includes("box-shadow:0 12px 24px rgba(0,0,0,0.12);"));
  assert.ok(css.includes("text-shadow:2px 2px 4px rgba(0,0,0,0.35);"));
  assert.match(css, /\.block-all-presets \.btn\{background:var\(--accent\);color:#ffffff;border:none;border-radius:999px;\}/);
});

test("renderSiteStyles preserves legacy block fields when preset styles are present", () => {
  const css = renderSiteStyles(
    projectWithBlocks([
      makeBlock("text", {
        id: "legacy-with-presets",
        styles: {
          backgroundColor: "#123456",
          textColor: "#fefefe",
          padding: 22,
          shadow: "0 1px 2px rgba(0,0,0,0.2)",
          backgroundStyle: "terminal",
          borderStyle: "thin"
        }
      })
    ])
  );

  assert.match(css, /\.block-legacy-with-presets\{/);
  assert.ok(css.includes("background:#123456;"));
  assert.ok(css.includes("color:#fefefe;"));
  assert.ok(css.includes("padding:22px;"));
  assert.ok(css.includes("box-shadow:0 1px 2px rgba(0,0,0,0.2);"));
  assert.ok(css.includes("background:#0c0c0c;"));
  assert.ok(css.includes("font-family:monospace;"));
  assert.ok(css.includes("border:1px solid rgba(0,0,0,.08);"));
});

test("renderSiteStyles includes per-block CSS from every generated page", () => {
  const css = renderSiteStyles(
    makeTwoPageProject(
      [
        makeBlock("text", {
          id: "page0-styled-block",
          styles: { backgroundStyle: "soft" }
        })
      ],
      [
        makeBlock("text", {
          id: "page1-styled-block",
          styles: { backgroundStyle: "bold" }
        })
      ]
    )
  );

  assert.match(css, /\.block-page0-styled-block\{/);
  assert.ok(css.includes("box-shadow:0 8px 32px rgba(0,0,0,0.08);"));
  assert.match(css, /\.block-page1-styled-block\{/);
  assert.ok(css.includes("box-shadow:0 12px 40px rgba(0,0,0,0.18);"));
});

test("renderGeneratedSiteFiles preserves one-page output as index.html", () => {
  const files = renderGeneratedSiteFiles(projectWithBlocks([block("text", { title: "Only", body: "One page body." })]));
  const htmlFiles = files.filter((file) => file.relativePath.endsWith(".html"));

  assert.deepEqual(htmlFiles.map((file) => file.relativePath), ["index.html"]);
  assert.match(htmlFiles[0].contents, /One page body\./);
});

test("renderGeneratedSiteFiles emits multi-page static output from page slugs", () => {
  const files = renderGeneratedSiteFiles(makeThreePageProject());
  const paths = files.map((file) => file.relativePath).sort();

  assert.deepEqual(paths, [
    "about/index.html",
    "assets/styles.css",
    "contact/index.html",
    "index.html",
    "robots.txt",
    "sitemap.xml"
  ]);
  assert.match(files.find((file) => file.relativePath === "index.html")?.contents || "", /Home page body\./);
  assert.match(files.find((file) => file.relativePath === "about/index.html")?.contents || "", /About page body\./);
  assert.match(files.find((file) => file.relativePath === "contact/index.html")?.contents || "", /555-0100/);
});

test("renderSitemap differs between one-page and multi-page projects", () => {
  const onePage = renderSitemap(makeProject({ site: { domain: "blackfishfarms.com" } }));
  const multiPage = renderSitemap(makeThreePageProject());

  assert.notEqual(onePage, multiPage);
  assert.equal((onePage.match(/<loc>/g) || []).length, 1);
  assert.equal((multiPage.match(/<loc>/g) || []).length, 3);
  assert.match(multiPage, /<loc>https:\/\/blackfishfarms\.com\/<\/loc>/);
  assert.match(multiPage, /<loc>https:\/\/blackfishfarms\.com\/about\/<\/loc>/);
  assert.match(multiPage, /<loc>https:\/\/blackfishfarms\.com\/contact\/<\/loc>/);
});

test("renderRobotsTxt emits an absolute public Sitemap URL", () => {
  const robots = renderRobotsTxt(makeThreePageProject());

  assert.match(robots, /^User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/blackfishfarms\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Sitemap: \/sitemap\.xml/);
});

test("renderSiteDocument emits canonical and OG metadata per generated page", () => {
  const project = makeThreePageProject();
  const aboutPage = project.pages[1];
  const html = renderSiteDocument(project, aboutPage);

  assert.match(html, /<title>About \| Blackfish Farms<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/blackfishfarms\.com\/about\/" \/>/);
  assert.match(html, /<meta property="og:type" content="website" \/>/);
  assert.match(html, /<meta property="og:site_name" content="Blackfish Farms" \/>/);
  assert.match(html, /<meta property="og:title" content="About \| Blackfish Farms" \/>/);
  assert.match(html, /<meta property="og:description" content="Local farm stand and seasonal produce\." \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/blackfishfarms\.com\/about\/" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary" \/>/);
});

test("renderSiteDocument defers favicon and manifest references when unsupported", () => {
  const html = renderSiteDocument(makeThreePageProject());

  assert.doesNotMatch(html, /rel="icon"/);
  assert.doesNotMatch(html, /rel="manifest"/);
  assert.doesNotMatch(html, /favicon/);
  assert.doesNotMatch(html, /manifest\.webmanifest/);
});

test("renderGeneratedSiteFiles has no leakage of editor API admin auth markup or private tokens", () => {
  const project = {
    ...makeThreePageProject(),
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
    ]
  } satisfies ReturnType<typeof makeProject>;

  const output = renderGeneratedSiteFiles(project).map((file) => file.contents).join("\n");

  assert.doesNotMatch(output, /\/api\//);
  assert.doesNotMatch(output, /api\/project/);
  assert.doesNotMatch(output, /admin/i);
  assert.doesNotMatch(output, /auth/i);
  assert.doesNotMatch(output, /login/i);
  assert.doesNotMatch(output, /markupAnnotations/);
  assert.doesNotMatch(output, /markupFreehandStrokes/);
  assert.doesNotMatch(output, /private-note-1/);
  assert.doesNotMatch(output, /private-freehand-1/);
  assert.doesNotMatch(output, /Internal annotation only/);
  assert.doesNotMatch(output, /project\.json/);
  assert.doesNotMatch(output, /token/i);
});

test("renderSiteDocument excludes editor-only Markup annotations from public output", () => {
  const project = {
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
  } satisfies ReturnType<typeof makeProject>;

  const html = renderSiteDocument(project);

  assert.match(html, /Public body/);
  assert.doesNotMatch(html, /markupAnnotations/);
  assert.doesNotMatch(html, /markupFreehandStrokes/);
  assert.doesNotMatch(html, /private-note-1/);
  assert.doesNotMatch(html, /private-freehand-1/);
  assert.doesNotMatch(html, /Internal annotation only/);
});
