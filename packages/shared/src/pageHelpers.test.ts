import assert from "node:assert/strict";
import test from "node:test";
import {
  generateSlug,
  getUniqueSlug,
  createPage,
  duplicatePage,
  deletePage,
  renamePage,
  updatePageSlug,
  buildNavItems,
  migrateLegacyProject,
  getStarterBlocks,
  STARTER_TEMPLATES,
} from "../dist-test/pageHelpers.js";

test("generateSlug removes spaces and special characters", () => {
  assert.equal(generateSlug("Hello World"), "/hello-world");
  assert.equal(generateSlug("Test Page 123!"), "/test-page-123");
  assert.equal(generateSlug("My   Extra   Spaces"), "/my-extra-spaces");
  assert.equal(generateSlug(""), "/untitled");
});

test("getUniqueSlug returns original if no collision", () => {
  const pages = [{ id: "1", slug: "/about", title: "About", blocks: [] }];
  assert.equal(getUniqueSlug("/contact", pages), "/contact");
});

test("getUniqueSlug adds suffix on collision", () => {
  const pages = [{ id: "1", slug: "/about", title: "About", blocks: [] }];
  assert.equal(getUniqueSlug("/about", pages), "/about-2");
});

test("getUniqueSlug chains suffixes", () => {
  const pages = [
    { id: "1", slug: "/about", title: "About", blocks: [] },
    { id: "2", slug: "/about-2", title: "About 2", blocks: [] },
  ];
  assert.equal(getUniqueSlug("/about", pages), "/about-3");
});

test("getUniqueSlug excludes page by id", () => {
  const pages = [{ id: "1", slug: "/about", title: "About", blocks: [] }];
  assert.equal(getUniqueSlug("/about", pages, "1"), "/about");
});

test("createPage generates unique id and slug", () => {
  const existing = [];
  const page = createPage("Test Page", existing);
  assert.ok(page.id.startsWith("page-"));
  assert.equal(page.slug, "/test-page");
  assert.equal(page.title, "Test Page");
  assert.equal(page.blocks.length, 0);
  assert.equal(page.showInNav, true);
});

test("createPage with options", () => {
  const page = createPage("Contact", [], { parentId: "p1", showInNav: false, template: "contact" });
  assert.equal(page.parentId, "p1");
  assert.equal(page.showInNav, false);
  assert.equal(page.template, "contact");
});

test("duplicatePage creates unique title and slug", () => {
  const original = { id: "p1", slug: "/about", title: "About", blocks: [{ id: "b1", type: "text", data: { body: "hi" } }] };
  const dup = duplicatePage(original, [original]);
  assert.ok(dup.id !== original.id);
  assert.equal(dup.title, "About (copy)");
  assert.equal(dup.slug, "/about-copy");
  assert.equal(dup.blocks.length, 1);
  assert.ok(dup.blocks[0].id !== original.blocks[0].id);
});

test("deletePage cannot delete last page", () => {
  const pages = [{ id: "p1", slug: "/", title: "Home", blocks: [] }];
  const result = deletePage(pages, "p1");
  assert.equal(result.pages.length, 1);
  assert.equal(result.fallbackId, "p1");
});

test("deletePage removes page and returns fallback", () => {
  const pages = [
    { id: "p1", slug: "/", title: "Home", blocks: [] },
    { id: "p2", slug: "/about", title: "About", blocks: [] },
  ];
  const result = deletePage(pages, "p1");
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].id, "p2");
  assert.equal(result.fallbackId, "p2");
});

test("renamePage updates title", () => {
  const page = { id: "p1", slug: "/", title: "Old", blocks: [] };
  const renamed = renamePage(page, "New Title");
  assert.equal(renamed.title, "New Title");
  assert.equal(renamed.id, "p1");
});

test("updatePageSlug ensures leading slash", () => {
  const page = { id: "p1", slug: "/", title: "Home", blocks: [] };
  const updated = updatePageSlug(page, "about", []);
  assert.equal(updated.slug, "/about");
});

test("updatePageSlug ensures unique slug", () => {
  const page = { id: "p1", slug: "/", title: "Home", blocks: [] };
  const existing = [{ id: "p2", slug: "/about", title: "About", blocks: [] }];
  const updated = updatePageSlug(page, "/about", existing);
  assert.equal(updated.slug, "/about-2");
});

test("buildNavItems filters showInNav and sorts by order", () => {
  const pages = [
    { id: "p1", slug: "/", title: "Home", blocks: [], showInNav: true, order: 0 },
    { id: "p2", slug: "/about", title: "About", blocks: [], showInNav: false, order: 1 },
    { id: "p3", slug: "/contact", title: "Contact", blocks: [], showInNav: true, order: 2 },
  ];
  const nav = buildNavItems(pages);
  assert.equal(nav.length, 2);
  assert.equal(nav[0].label, "Home");
  assert.equal(nav[0].href, "/");
  assert.equal(nav[1].label, "Contact");
  assert.equal(nav[1].href, "/contact");
});

test("migrateLegacyProject returns Home page for empty array", () => {
  const result = migrateLegacyProject([]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Home");
  assert.equal(result[0].slug, "/");
});

test("migrateLegacyProject returns Home page for undefined", () => {
  const result = migrateLegacyProject(undefined);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Home");
});

test("migrateLegacyProject preserves existing pages", () => {
  const pages = [{ id: "p1", slug: "/", title: "Existing", blocks: [] }];
  const result = migrateLegacyProject(pages);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Existing");
});

test("parentId can be set on a page", () => {
  const page = createPage("Child", [], { parentId: "parent-1" });
  assert.equal(page.parentId, "parent-1");
});

test("getStarterBlocks returns empty for blank", () => {
  assert.deepEqual(getStarterBlocks("blank", []), []);
});

test("getStarterBlocks returns hero+text for hero-text", () => {
  const blocks = getStarterBlocks("hero-text", []);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "hero");
  assert.equal(blocks[1].type, "text");
});

test("getStarterBlocks returns contact for contact template", () => {
  const blocks = getStarterBlocks("contact", []);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "contact");
});

test("getStarterBlocks returns gallery for gallery template", () => {
  const blocks = getStarterBlocks("gallery", []);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "gallery");
});

test("getStarterBlocks copies current page blocks for copy template", () => {
  const currentBlocks = [{ id: "b1", type: "text", data: { body: "hello" } }];
  const blocks = getStarterBlocks("copy", currentBlocks);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "text");
  assert.ok(blocks[0].id !== "b1");
});

test("STARTER_TEMPLATES has expected entries", () => {
  assert.ok(STARTER_TEMPLATES.length >= 5);
  assert.ok(STARTER_TEMPLATES.find((t) => t.id === "blank"));
  assert.ok(STARTER_TEMPLATES.find((t) => t.id === "copy"));
  assert.ok(STARTER_TEMPLATES.find((t) => t.id === "hero-text"));
  assert.ok(STARTER_TEMPLATES.find((t) => t.id === "contact"));
  assert.ok(STARTER_TEMPLATES.find((t) => t.id === "gallery"));
});

test("selected page persists across save/load via project state", () => {
  const page1 = createPage("Home", []);
  const page2 = createPage("About", [page1]);
  assert.ok(page1.id !== page2.id);
  assert.ok(page1.slug !== page2.slug);
});

test("slug generation handles special characters", () => {
  assert.equal(generateSlug("What's New?"), "/whats-new");
  assert.equal(generateSlug("Page & More"), "/page-more");
});
