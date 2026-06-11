import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBrainContext,
  formatBrainContextForPrompt,
  tryDeterministicFact,
  trySiteFact
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
});

test("buildBrainContext: selectedBlockId resolves to a hours block summary", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hours-1", build });
  assert.ok(brain.selectedBlock);
  assert.equal(brain.selectedBlock!.type, "hours");
  assert.equal(brain.selectedBlock!.pickupHours.length, 2);
  assert.equal(brain.selectedBlock!.pickupHours[0]!.day, "Monday");
});

// =========================================================
// tryDeterministicFact — the ONLY deterministic path
// =========================================================

test("tryDeterministicFact: version question returns engine=sbuild-brain, mode=deterministic", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what version am I running?", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.equal(d!.mode, "deterministic");
  assert.equal(d!.deterministicAnswer, true);
  assert.equal(d!.reason, "site-app-version-fact");
  assert.match(d!.text, /0\.5\.0-dev\.123\+abcd123/);
  assert.match(d!.text, /abcd123/);
  assert.match(d!.text, /main/);
});

test("tryDeterministicFact: build number question returns deterministic version fact", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what is the build number?", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.equal(d!.reason, "site-app-version-fact");
});

test("tryDeterministicFact: what commit question returns deterministic", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what commit is this?", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.match(d!.text, /abcd123/);
});

test("tryDeterministicFact: what branch question returns deterministic", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what branch am I on?", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.match(d!.text, /main/);
});

test("tryDeterministicFact: empty prompt returns engine=sbuild-brain, reason=no-prompt", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.equal(d!.reason, "no-prompt");
  assert.equal(d!.text, "");
});

// =========================================================
// Anti-hardcode tests: these must ALL return null (LLM-only)
// so we know the Brain is NOT faking answers.
// =========================================================

test("tryDeterministicFact: 'what color is a kernel of corn' returns null (no faked answer)", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what color is a kernel of corn?", brain);
  assert.equal(d, null, "corn-color must NOT be answered deterministically; LLM must handle it");
});

test("tryDeterministicFact: 'what color is a potato' returns null (no faked answer)", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what color is a potato?", brain);
  assert.equal(d, null, "potato-color must NOT be answered deterministically; LLM must handle it");
});

test("tryDeterministicFact: 'what color is the sky' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what color is the sky?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'do you like pickles' returns null (no Pickles-are-green canned answer)", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("do you like pickles?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'what are the farm pickup hours' returns null (no faked hours)", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const d = tryDeterministicFact("what are the farm pickup hours?", brain);
  assert.equal(d, null, "pickup hours must go to the LLM, not be faked by the Brain");
});

test("tryDeterministicFact: 'what are the titles and details of each card' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "cards-1", build });
  const d = tryDeterministicFact("what are the titles and details of each card?", brain);
  assert.equal(d, null, "card titles must go to the LLM, not be faked by the Brain");
});

test("tryDeterministicFact: 'what is the title and description of this block' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hero-1", build });
  const d = tryDeterministicFact("what is the title and description of this block?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'which block is selected' returns null (UI state is not deterministic Brain territory)", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hero-1", build });
  const d = tryDeterministicFact("which block is selected?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'what pages are on this site' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what pages are on this site?", brain);
  assert.equal(d, null, "page-list should go to the LLM, not be a hardcoded fact");
});

test("tryDeterministicFact: 'what can you do' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what can you do?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'what is the weather in Paris' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("what is the weather in Paris?", brain);
  assert.equal(d, null);
});

test("tryDeterministicFact: 'tell me a joke' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = tryDeterministicFact("tell me a joke", brain);
  assert.equal(d, null);
});

// =========================================================
// formatBrainContextForPrompt
// =========================================================

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

test("formatBrainContextForPrompt: includes site facts for cards/hours/contact", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const formatted = formatBrainContextForPrompt(brain);
  assert.ok(formatted.includes("Total cards"));
  assert.ok(formatted.includes("Total pickup hour rows"));
  assert.ok(formatted.includes("Contact blocks"));
});

test("formatBrainContextForPrompt: works for empty project without throwing", () => {
  const brain = buildBrainContext({ project: null, build });
  const formatted = formatBrainContextForPrompt(brain);
  assert.ok(formatted.includes("sBuild Brain"));
  assert.ok(formatted.includes("Untitled site"));
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

// =========================================================
// trySiteFact — positive-shape site facts (pickup hours,
// card titles, card details, contact, page list, image alt).
// Only exact field-name questions match. General knowledge
// (corn, potato, sky) must always return null.
// =========================================================

test("trySiteFact: 'what are the farm pickup hours' returns site-pickup-hours-fact with project hours", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what are the farm pickup hours?", brain);
  assert.ok(d);
  assert.equal(d!.engine, "sbuild-brain");
  assert.equal(d!.mode, "deterministic");
  assert.equal(d!.reason, "site-pickup-hours-fact");
  assert.match(d!.text, /Monday/);
  assert.match(d!.text, /Saturday/);
  assert.match(d!.text, /9:00 AM|5:00 PM/);
});

test("trySiteFact: pickup-hours answer is whole-site, not blindfolded by selected block", () => {
  // Even with a TEXT block selected (not the hours block), the
  // pickup-hours question must answer from siteFacts (whole site).
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "text-about", build });
  const d = trySiteFact("what are the pickup hours for the farm?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-pickup-hours-fact");
  assert.match(d!.text, /Monday/);
});

test("trySiteFact: card titles question returns site-card-titles-fact", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what are the card titles?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-card-titles-fact");
  assert.match(d!.text, /Seasonal Vegetables/);
  assert.match(d!.text, /Herbs & Greens/);
  assert.match(d!.text, /Farm Flowers/);
});

test("trySiteFact: card-titles question answered from whole site even when text block is selected", () => {
  // Critical: even when a NON-cards block is selected, the user can
  // ask about card titles and the Brain must reach across the site.
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "text-about", build });
  const d = trySiteFact("what are the card titles?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-card-titles-fact");
  assert.match(d!.text, /Seasonal Vegetables/);
});

test("trySiteFact: 'titles and details' returns site-card-details-fact with both title and body", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what are the titles and details of each card?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-card-details-fact");
  assert.match(d!.text, /Seasonal Vegetables/);
  assert.match(d!.text, /Tomatoes/);
});

test("trySiteFact: 'what is the contact info' returns site-contact-fact", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what is the contact info for the farm?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-contact-fact");
  assert.match(d!.text, /555-0123/);
  assert.match(d!.text, /hello@blackfish\.example/);
});

test("trySiteFact: 'list the pages' returns site-page-list-fact", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("list the pages", brain);
  assert.ok(d);
  assert.equal(d!.reason, "site-page-list-fact");
  assert.match(d!.text, /Home/);
  assert.match(d!.text, /About/);
});

test("trySiteFact: 'what is the selected block' returns selected-block-detail-fact", () => {
  const brain = buildBrainContext({ project: makeProject(), selectedBlockId: "hero-1", build });
  const d = trySiteFact("what is the selected block?", brain);
  assert.ok(d);
  assert.equal(d!.reason, "selected-block-detail-fact");
  assert.match(d!.text, /hero/);
  assert.match(d!.text, /Fresh from the farm/);
});

// --- Anti-hardcode: these MUST return null so the LLM handles them.

test("trySiteFact: 'what color is corn' returns null (general knowledge, not a site fact)", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what color is corn?", brain);
  assert.equal(d, null, "corn-color is general knowledge; must NOT be answered by the Brain");
});

test("trySiteFact: 'what color is a potato' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what color is a potato?", brain);
  assert.equal(d, null);
});

test("trySiteFact: 'what color is the sky' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what color is the sky?", brain);
  assert.equal(d, null);
});

test("trySiteFact: 'tell me a joke' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("tell me a joke", brain);
  assert.equal(d, null);
});

test("trySiteFact: 'what is the weather' returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  const d = trySiteFact("what is the weather in Paris?", brain);
  assert.equal(d, null);
});

test("trySiteFact: empty project returns null (no site facts to answer with)", () => {
  const brain = buildBrainContext({ project: null, build });
  assert.equal(trySiteFact("what are the pickup hours?", brain), null);
  assert.equal(trySiteFact("what are the card titles?", brain), null);
  assert.equal(trySiteFact("list the pages", brain), null);
  assert.equal(trySiteFact("what is the contact info?", brain), null);
});

test("trySiteFact: empty prompt returns null", () => {
  const brain = buildBrainContext({ project: makeProject(), build });
  assert.equal(trySiteFact("", brain), null);
});
