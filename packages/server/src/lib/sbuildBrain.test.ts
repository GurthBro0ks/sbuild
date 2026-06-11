import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerBrainQuestion,
  buildBrainContext,
  formatBrainContextForPrompt
} from "./sbuildBrain.js";
import type { SBuildProject, SBuildBuildInfo } from "@sbuild/shared";

const build: SBuildBuildInfo = {
  version: "0.5.0-dev",
  appName: "sBuild",
  baseVersion: "0.5.0-dev",
  displayVersion: "0.5.0-dev.123+abcd123",
  gitCommit: "abcd123",
  gitCommitFull: "abcd1234567890",
  branch: "main",
  commitCount: 123,
  buildDate: "2026-06-10T22:00:00Z",
  dirty: false,
  publishAllowed: false
};

function makeProject(): SBuildProject {
  return {
    version: "1",
    updatedAt: "2026-06-10T00:00:00Z",
    site: {
      siteName: "Blackfish Farms",
      title: "Blackfish Farms — Fresh Produce",
      description: "Family farm",
      domain: "blackfishfarms.com",
      nav: []
    },
    globalStyles: {
      headingFont: "system-ui",
      bodyFont: "system-ui",
      colors: { bg: "#fff", surface: "#f4f4f4", text: "#222", accent: "#0a0", muted: "#666" }
    },
    ai: { provider: "ollama", model: "qwen2.5:1.5b" },
    deploy: { method: "dry-run", webRoot: "" },
    pages: [
      {
        id: "page-home",
        slug: "home",
        title: "Home",
        blocks: [
          {
            id: "hero-1",
            type: "hero",
            data: { heading: "Fresh from the farm", subheading: "Seasonal produce picked daily" }
          },
          {
            id: "cards-1",
            type: "cards",
            data: {
              title: "What We Grow",
              cards: [
                { id: "c1", title: "Seasonal Vegetables", body: "Tomatoes, peppers, squash, and greens." },
                { id: "c2", title: "Herbs & Greens", body: "Basil, cilantro, kale, and chard." },
                { id: "c3", title: "Farm Flowers", body: "Cut-flower bouquets by the bunch." }
              ]
            }
          },
          {
            id: "hours-1",
            type: "hours",
            data: {
              title: "Pickup Hours",
              rows: [
                { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
                { day: "Saturday", open: "8:00 AM", close: "2:00 PM", note: "Farmers market" } as { day: string; open: string; close: string }
              ]
            }
          },
          {
            id: "contact-1",
            type: "contact",
            data: {
              phone: "555-0123",
              email: "hello@blackfish.example",
              address: "100 Farm Road, Smalltown"
            }
          }
        ]
      },
      {
        id: "page-about",
        slug: "about",
        title: "About",
        blocks: [
          {
            id: "text-about",
            type: "text",
            data: { title: "Our Story", body: "We are a small family farm that has been growing food for over 20 years." }
          }
        ]
      }
    ]
  };
}

test("buildBrainContext: counts pages, blocks, and by-type totals", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  assert.equal(brain.project.name, "Blackfish Farms");
  assert.equal(brain.project.pageCount, 2);
  assert.equal(brain.project.blockCount, 5);
  assert.equal(brain.project.blocksByType.cards, 1);
  assert.equal(brain.project.blocksByType.hero, 1);
  assert.equal(brain.project.blocksByType.hours, 1);
  assert.equal(brain.siteFacts.totalCards, 3);
  assert.equal(brain.siteFacts.totalHours, 2);
  assert.equal(brain.siteFacts.totalContactBlocks, 1);
  assert.equal(brain.siteFacts.pageList.length, 2);
});

test("buildBrainContext: with no project returns zeroed summary without throwing", () => {
  const brain = buildBrainContext({ project: null, build });
  assert.equal(brain.project.pageCount, 0);
  assert.equal(brain.project.blockCount, 0);
  assert.equal(brain.siteFacts.cardTitles.length, 0);
  assert.equal(brain.selectedBlock, null);
});

test("buildBrainContext: selectedBlockId resolves to a card-detail summary when on a cards block", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  assert.ok(brain.selectedBlock);
  assert.equal(brain.selectedBlock!.type, "cards");
  assert.equal(brain.selectedBlock!.title, "What We Grow");
  assert.equal(brain.selectedBlock!.cardTitles.length, 3);
  assert.ok(brain.selectedBlock!.cardTitles.includes("Seasonal Vegetables"));
  assert.equal(brain.selectedBlock!.cardDetails[0]!.body, "Tomatoes, peppers, squash, and greens.");
});

test("buildBrainContext: selectedBlockId resolves to a hours block summary", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hours-1", build });
  assert.ok(brain.selectedBlock);
  assert.equal(brain.selectedBlock!.type, "hours");
  assert.equal(brain.selectedBlock!.pickupHours.length, 2);
  assert.equal(brain.selectedBlock!.pickupHours[0]!.day, "Monday");
});

test("answerBrainQuestion: version question returns exact build info", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what version/build am I running?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-version");
  assert.equal(a!.kind, "answered");
  assert.ok(a!.text.includes("0.5.0-dev.123+abcd123"));
  assert.ok(a!.text.includes("abcd123"));
  assert.ok(a!.text.includes("main"));
});

test("answerBrainQuestion: which block is selected returns cards block when cards-1 is selected", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const a = answerBrainQuestion("what block is selected?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-ui");
  assert.ok(a!.text.includes("cards"));
  assert.ok(a!.text.includes("cards-1"));
});

test("answerBrainQuestion: page list returns both pages", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what pages are on this site?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-site");
  assert.ok(a!.text.includes("Home"));
  assert.ok(a!.text.includes("About"));
});

test("answerBrainQuestion: card titles+details from selected cards block returns all 3 cards", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const a = answerBrainQuestion("what are the titles and details of each card?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-block");
  assert.ok(a!.text.includes("Seasonal Vegetables"));
  assert.ok(a!.text.includes("Herbs & Greens"));
  assert.ok(a!.text.includes("Farm Flowers"));
  assert.ok(a!.text.includes("Tomatoes, peppers, squash, and greens."));
});

test("answerBrainQuestion: pickup hours from site even when cards block is selected", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const a = answerBrainQuestion("what are the farm pickup hours?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-site");
  assert.ok(a!.text.includes("Monday"));
  assert.ok(a!.text.includes("9:00 AM"));
  assert.ok(a!.text.includes("Saturday"));
  assert.ok(a!.text.includes("Farmers market"));
  assert.notEqual(a!.text, "Pickup hours are not in the selected block. Switch to Current Page scope to see hours from the Hours block.");
});

test("answerBrainQuestion: hours block title and description from selected block", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hours-1", build });
  const a = answerBrainQuestion("what is the title and description of this block?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-block");
  assert.equal(a!.scope, "selected-block");
  assert.ok(a!.text.includes("hours"));
});

test("answerBrainQuestion: contact info from site", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const a = answerBrainQuestion("what is the phone number and address?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-site");
  assert.ok(a!.text.includes("555-0123"));
  assert.ok(a!.text.includes("hello@blackfish.example"));
  assert.ok(a!.text.includes("100 Farm Road"));
});

test("answerBrainQuestion: general knowledge question returns needs-llm marker", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what color is a kernel of corn?", brain);
  assert.ok(a);
  assert.equal(a!.kind, "needs-llm");
  assert.equal(a!.needsGeneralKnowledge, true);
});

test("answerBrainQuestion: app capabilities question answered from brain-app", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what can you do?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-app");
  assert.ok(a!.text.includes("sBuild"));
  assert.ok(a!.text.toLowerCase().includes("publish"));
});

test("answerBrainQuestion: empty prompt returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  assert.equal(answerBrainQuestion("", brain), null);
  assert.equal(answerBrainQuestion("   ", brain), null);
});

test("answerBrainQuestion: site fact answered even with empty selected block", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what are the farm pickup hours?", brain);
  assert.ok(a);
  assert.equal(a!.source, "brain-site");
  assert.ok(a!.text.includes("Monday"));
});

test("answerBrainQuestion: site-edit keyword suppresses general-knowledge fallback", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const a = answerBrainQuestion("what color is the heading on the hero block?", brain);
  assert.equal(a, null);
});

test("formatBrainContextForPrompt: includes version, project summary, selected block, and capabilities", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const formatted = formatBrainContextForPrompt(brain);
  assert.ok(formatted.includes("sBuild Brain"));
  assert.ok(formatted.includes("Blackfish Farms"));
  assert.ok(formatted.includes("0.5.0-dev.123+abcd123"));
  assert.ok(formatted.includes("Seasonal Vegetables"));
  assert.ok(formatted.includes("App capabilities"));
  assert.ok(formatted.includes("Cannot browse the internet"));
});

test("buildBrainContext: site facts include gallery counts when present", () => {
  const project = makeProject();
  project.pages[0].blocks.push({
    id: "gallery-1",
    type: "gallery",
    data: { title: "Farm Gallery", images: [{ id: "i1", src: "x.jpg", alt: "barn" }, { id: "i2", src: "y.jpg", alt: "field" }] }
  });
  const brain = buildBrainContext({ project, build });
  assert.equal(brain.siteFacts.totalGalleryBlocks, 1);
  assert.equal(brain.siteFacts.totalGalleryImages, 2);
  assert.equal(brain.siteFacts.galleryCounts[0]!.count, 2);
});
