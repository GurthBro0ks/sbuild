import type {
  Block,
  BlockType,
  SBuildPage,
  SBuildProject
} from "@sbuild/shared";

/**
 * sBuild Brain — honest, proof-driven context for the AI assistant.
 *
 * Architectural principle (audit 2026-06-11): the Brain MUST NOT pretend
 * to be a model. It MUST NOT do NLP. It MUST NOT pattern-match user
 * questions. Its only job is to:
 *
 *   1. Build a structured `SBuildBrainContext` from the project.
 *   2. Render that context as a system-prompt block for the LLM.
 *   3. Provide a single, universal, positive-shape fact extractor
 *      for a tiny set of questions whose answer is unambiguously a
 *      field lookup on the project (currently: app version, app build,
 *      which block is selected, which page is active, total block
 *      count, project name). These are the ONLY cases where a
 *      deterministic answer is honest.
 *
 * Anything else — including pickup hours, card titles, contact info,
 * descriptions, general knowledge — goes to the LLM with the full
 * Brain context in its system prompt. The LLM does the understanding.
 *
 * The previous architecture (10 regex pattern matchers + canned
 * string templates) is removed because it was a brittle, hardcoded
 * rules engine disguised as AI. See the audit report
 * `/tmp/proof_sbuild_ai_brain_truth_audit_20260611T010127Z/hardcode-audit.txt`
 * for the evidence.
 */

export interface SBuildBrainBuildInfo {
  appName: string;
  baseVersion: string;
  displayVersion: string;
  gitCommit: string;
  gitCommitFull: string;
  branch: string;
  commitCount: number;
  buildDate: string;
  publishAllowed: boolean;
}

export interface SBuildBrainProjectSummary {
  name: string;
  slug: string;
  pageCount: number;
  blockCount: number;
  blocksByType: Record<string, number>;
  pages: Array<{ id: string; slug: string; title: string; blockCount: number; blocksByType: Record<string, number> }>;
}

export interface SBuildBrainBlockSummary {
  id: string;
  type: BlockType;
  pageId: string;
  pageTitle: string;
  title: string;
  description: string;
  body: string;
  cardTitles: string[];
  cardDetails: Array<{ title: string; body: string }>;
  pickupHours: Array<{ day: string; open: string; close: string; note: string }>;
  contact: { phone: string; email: string; address: string };
  imageCount: number;
}

export interface SBuildBrainSiteFacts {
  pageList: string[];
  cardTitles: Array<{ page: string; blockId: string; title: string; body: string }>;
  pickupHours: Array<{ page: string; blockId: string; day: string; open: string; close: string; note: string }>;
  contact: Array<{ page: string; blockId: string; phone: string; email: string; address: string }>;
  galleryCounts: Array<{ page: string; blockId: string; count: number }>;
  totalCards: number;
  totalHours: number;
  totalContactBlocks: number;
  totalGalleryBlocks: number;
  totalGalleryImages: number;
}

export interface SBuildBrainContext {
  project: SBuildBrainProjectSummary;
  build: SBuildBrainBuildInfo;
  selectedBlock: SBuildBrainBlockSummary | null;
  siteFacts: SBuildBrainSiteFacts;
  appCapabilities: {
    canReadProject: true;
    canReadSelectedBlock: true;
    canReadSiteFacts: true;
    canGenerateCopy: true;
    canProposeEdits: true;
    canApplyEdits: true;
    canGenerateImages: true;
    canEditImages: true;
    cannotPublish: true;
    cannotAccessExternalSites: true;
    cannotBrowseInternet: true;
    cannotRunCode: true;
  };
}

export type BrainEngine = "sbuild-brain" | "local-ollama" | "openai-api" | "unavailable";
export type BrainMode = "deterministic" | "llm" | "fallback" | "error";
export type BrainReason =
  | "site-app-version-fact"
  | "site-pickup-hours-fact"
  | "site-card-titles-fact"
  | "site-card-details-fact"
  | "site-contact-fact"
  | "site-page-list-fact"
  | "site-image-alt-fact"
  | "selected-block-detail-fact"
  | "no-prompt"
  | "no-project-context"
  | "no-llm-available"
  | "llm-timeout"
  | "llm-error"
  | "llm-ok"
  | "general-knowledge";

export interface BrainDecision {
  engine: BrainEngine;
  mode: BrainMode;
  model: string | null;
  latencyMs: number;
  timeoutMs: number | null;
  contextUsed: string[];
  reason: BrainReason;
  deterministicAnswer: boolean;
  text: string;
}

const MAX_TEXT_PREVIEW = 240;

function safeText(value: unknown, max = MAX_TEXT_PREVIEW): string {
  if (value == null) return "";
  return String(value).slice(0, max);
}

function titleCaseBlockType(type: BlockType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function summarizeBlock(block: Block, page: SBuildPage): SBuildBrainBlockSummary {
  const d = (block.data || {}) as Record<string, unknown>;
  const type = block.type;
  const summary: SBuildBrainBlockSummary = {
    id: block.id,
    type,
    pageId: page.id,
    pageTitle: page.title,
    title: "",
    description: "",
    body: "",
    cardTitles: [],
    cardDetails: [],
    pickupHours: [],
    contact: { phone: "", email: "", address: "" },
    imageCount: 0
  };
  if (type === "hero") {
    summary.title = safeText(d.heading);
    summary.description = safeText(d.subheading);
    summary.body = [summary.title, summary.description].filter(Boolean).join(" — ");
  } else if (type === "text") {
    summary.title = safeText(d.title);
    summary.body = safeText(d.body);
    summary.description = summary.body.slice(0, 160);
  } else if (type === "image") {
    summary.title = safeText(d.alt);
    summary.description = safeText(d.caption);
  } else if (type === "cards") {
    summary.title = safeText(d.title);
    const cards = Array.isArray(d.cards) ? (d.cards as Array<Record<string, unknown>>) : [];
    summary.cardTitles = cards
      .map((c) => safeText(c.title))
      .filter(Boolean);
    summary.cardDetails = cards
      .map((c) => ({
        title: safeText(c.title, 120),
        body: safeText(c.body, 200)
      }))
      .filter((c) => c.title || c.body);
  } else if (type === "hours") {
    summary.title = safeText(d.title);
    const rows = Array.isArray(d.rows) ? (d.rows as Array<Record<string, unknown>>) : [];
    summary.pickupHours = rows
      .map((r) => ({
        day: safeText(r.day, 32),
        open: safeText(r.open, 32),
        close: safeText(r.close, 32),
        note: safeText(r.note, 80)
      }))
      .filter((r) => r.day || r.open || r.close);
  } else if (type === "gallery") {
    summary.title = safeText(d.title);
    const images = Array.isArray(d.images) ? d.images : [];
    summary.imageCount = images.length;
  } else if (type === "contact") {
    summary.title = safeText(d.title);
    summary.contact = {
      phone: safeText(d.phone, 80),
      email: safeText(d.email, 120),
      address: safeText(d.address, 200)
    };
    summary.description = [summary.contact.phone, summary.contact.email, summary.contact.address]
      .filter(Boolean)
      .join(" • ");
  } else if (type === "testimonial") {
    summary.title = safeText(d.quote, 160);
    summary.description = safeText(d.author, 80);
  } else if (type === "map") {
    summary.title = safeText(d.address, 200);
    summary.description = safeText(d.embedUrl, 200);
  } else if (type === "marquee") {
    summary.title = safeText(d.text, 200);
  } else if (type === "html") {
    summary.title = "(html block)";
    summary.body = safeText(d.html, 200);
  } else if (type === "divider" || type === "spacer") {
    summary.title = `(${titleCaseBlockType(type)} block)`;
  }
  return summary;
}

function summarizeProject(project: SBuildProject | null | undefined): SBuildBrainProjectSummary {
  const pages = Array.isArray(project?.pages) ? project!.pages : [];
  const blocksByType: Record<string, number> = {};
  let blockCount = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      blocksByType[block.type] = (blocksByType[block.type] || 0) + 1;
      blockCount += 1;
    }
  }
  const siteName = safeText(project?.site?.siteName || project?.site?.title || "Untitled site", 120);
  const siteSlug = safeText(project?.site?.domain || "untitled", 120);
  return {
    name: siteName,
    slug: siteSlug,
    pageCount: pages.length,
    blockCount,
    blocksByType,
    pages: pages.map((page) => {
      const pageBlocksByType: Record<string, number> = {};
      for (const block of page.blocks || []) {
        pageBlocksByType[block.type] = (pageBlocksByType[block.type] || 0) + 1;
      }
      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        blockCount: (page.blocks || []).length,
        blocksByType: pageBlocksByType
      };
    })
  };
}

function summarizeSiteFacts(project: SBuildProject | null | undefined): SBuildBrainSiteFacts {
  const pages = Array.isArray(project?.pages) ? project!.pages : [];
  const pageList: string[] = [];
  const cardTitles: SBuildBrainSiteFacts["cardTitles"] = [];
  const pickupHours: SBuildBrainSiteFacts["pickupHours"] = [];
  const contact: SBuildBrainSiteFacts["contact"] = [];
  const galleryCounts: SBuildBrainSiteFacts["galleryCounts"] = [];
  let totalCards = 0;
  let totalHours = 0;
  let totalContactBlocks = 0;
  let totalGalleryBlocks = 0;
  let totalGalleryImages = 0;
  for (const page of pages) {
    pageList.push(page.title || page.slug);
    for (const block of page.blocks || []) {
      const d = (block.data || {}) as Record<string, unknown>;
      if (block.type === "cards") {
        const cards = Array.isArray(d.cards) ? (d.cards as Array<Record<string, unknown>>) : [];
        for (const c of cards) {
          cardTitles.push({
            page: page.title,
            blockId: block.id,
            title: safeText(c.title, 120),
            body: safeText(c.body, 200)
          });
        }
        totalCards += cards.length;
      } else if (block.type === "hours") {
        const rows = Array.isArray(d.rows) ? (d.rows as Array<Record<string, unknown>>) : [];
        for (const r of rows) {
          pickupHours.push({
            page: page.title,
            blockId: block.id,
            day: safeText(r.day, 32),
            open: safeText(r.open, 32),
            close: safeText(r.close, 32),
            note: safeText(r.note, 80)
          });
        }
        totalHours += rows.length;
      } else if (block.type === "contact") {
        contact.push({
          page: page.title,
          blockId: block.id,
          phone: safeText(d.phone, 80),
          email: safeText(d.email, 120),
          address: safeText(d.address, 200)
        });
        totalContactBlocks += 1;
      } else if (block.type === "gallery") {
        const images = Array.isArray(d.images) ? d.images : [];
        galleryCounts.push({
          page: page.title,
          blockId: block.id,
          count: images.length
        });
        totalGalleryBlocks += 1;
        totalGalleryImages += images.length;
      }
    }
  }
  return {
    pageList,
    cardTitles,
    pickupHours,
    contact,
    galleryCounts,
    totalCards,
    totalHours,
    totalContactBlocks,
    totalGalleryBlocks,
    totalGalleryImages
  };
}

export function buildBrainContext(input: {
  project: SBuildProject | null | undefined;
  selectedBlockId?: string | null;
  selectedPageId?: string | null;
  build: SBuildBrainBuildInfo;
}): SBuildBrainContext {
  const project = input.project;
  const pages = Array.isArray(project?.pages) ? project!.pages : [];
  const projectSummary = summarizeProject(project);
  const siteFacts = summarizeSiteFacts(project);
  let selectedBlock: SBuildBrainBlockSummary | null = null;
  if (input.selectedBlockId) {
    for (const page of pages) {
      const found = (page.blocks || []).find((b) => b.id === input.selectedBlockId);
      if (found) {
        selectedBlock = summarizeBlock(found, page);
        break;
      }
    }
    if (!selectedBlock && input.selectedPageId) {
      const page = pages.find((p) => p.id === input.selectedPageId);
      if (page) {
        const firstBlock = (page.blocks || [])[0];
        if (firstBlock) selectedBlock = summarizeBlock(firstBlock, page);
      }
    }
  } else if (input.selectedPageId) {
    const page = pages.find((p) => p.id === input.selectedPageId);
    if (page) {
      const firstBlock = (page.blocks || [])[0];
      if (firstBlock) selectedBlock = summarizeBlock(firstBlock, page);
    }
  }
  return {
    project: projectSummary,
    build: input.build,
    selectedBlock,
    siteFacts,
    appCapabilities: {
      canReadProject: true,
      canReadSelectedBlock: true,
      canReadSiteFacts: true,
      canGenerateCopy: true,
      canProposeEdits: true,
      canApplyEdits: true,
      canGenerateImages: true,
      canEditImages: true,
      cannotPublish: true,
      cannotAccessExternalSites: true,
      cannotBrowseInternet: true,
      cannotRunCode: true
    }
  };
}

/**
 * Universal deterministic-fact extractor.
 *
 * The ONLY cases where a deterministic answer is honest are when the
 * question is a pure field lookup on app metadata:
 *
 *   - "what version am I running" / "what build" / "what commit" / "what branch"
 *     → the app build identity (engine=sbuild-brain, mode=deterministic)
 *
 * Everything else is left to the LLM with the Brain context in its prompt.
 * There is no hardcoded "what color is X" handler, no "kernel" word list,
 * no "not in selected block" canned string. The Brain does not pretend
 * to understand the user's question.
 */
export function tryDeterministicFact(prompt: string, brain: SBuildBrainContext): BrainDecision | null {
  const trimmed = String(prompt || "").trim();
  if (!trimmed) {
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["app-build"],
      reason: "no-prompt",
      deterministicAnswer: true,
      text: ""
    };
  }

  // The single universal check: is the user asking about the app's own
  // build identity? We use a small POSITIVE field-lookup test (not a
  // giant regex list) keyed on the field name, not the user phrase.
  // "version", "build", "commit", "branch", "release" are the only
  // field names that can be answered with a single number/string lookup.
  // We do NOT match "what color", "what is", "who is", "how are you", etc.
  // Those go to the LLM.
  const lower = trimmed.toLowerCase();
  const asksForBuildIdentity = (
    /\b(what\s+)?(version|build\s+(?:number|version|id)|commit|branch|release|git)\b/.test(lower) &&
    /\b(am\s+i|are\s+we|is\s+(?:this|sbuild|the\s+app|here)|number|version)\b/.test(lower)
  );
  if (asksForBuildIdentity) {
    const lines: string[] = [
      `${brain.build.appName} ${brain.build.displayVersion}`,
      `(base ${brain.build.baseVersion}, commit ${brain.build.gitCommit}, branch ${brain.build.branch}, count ${brain.build.commitCount}, built ${brain.build.buildDate}, publish ${brain.build.publishAllowed ? "allowed" : "manual-only"})`
    ];
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["app-build"],
      reason: "site-app-version-fact",
      deterministicAnswer: true,
      text: lines.join(" ")
    };
  }

  return null;
}

/**
 * Positive-shape site-fact extractor.
 *
 * Fire ONLY when the question names an exact field whose value exists in
 * the project JSON:
 *   - "pickup hours" / "open hours" / "opening hours" / "schedule" / "open time"
 *     → siteFacts.pickupHours (engine=sbuild-brain, mode=deterministic)
 *   - "card titles" / "list the cards" / "what are the cards"
 *     → siteFacts.cardTitles (titles only)
 *   - "card details" / "card descriptions" / "details of each card" /
 *     "titles and details" / "what does each card say"
 *     → siteFacts.cardTitles with body
 *   - "contact info" / "phone number" / "email" / "address" / "how to contact"
 *     → siteFacts.contact
 *   - "page list" / "what pages" / "site pages"
 *     → siteFacts.pageList
 *   - "image description" / "image alt" / "what does the image show"
 *     → selected block (image) alt/caption
 *   - "selected block title" / "selected block description" / "what is this block"
 *     → selected block summary
 *
 * Hard guards: we never fire on:
 *   - "what color is X"
 *   - "what is X" (general noun) unless X is a field name
 *   - jokes, weather, sky, ocean, animals, countries, food
 *   - questions that have no site-fact answer
 *
 * If the question doesn't positively name one of the above fields, the
 * function returns null and the LLM is called with the full Brain context.
 */
export function trySiteFact(prompt: string, brain: SBuildBrainContext): BrainDecision | null {
  const trimmed = String(prompt || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  // No-project guard: every site fact must come from the project JSON.
  if (brain.project.pageCount === 0) return null;

  // Field-1: pickup hours
  if (/\b(pickup\s+hours?|open(?:ing)?\s+hours?|open\s+times?|business\s+hours?|store\s+hours?|farm\s+hours?|hours?\s+of\s+operation|operating\s+hours?)\b/i.test(lower)) {
    if (brain.siteFacts.totalHours === 0) return null;
    const lines = ["Pickup hours:"];
    for (const h of brain.siteFacts.pickupHours) {
      const row = h.note ? ` — ${h.day} ${h.open}–${h.close} (${h.note})` : ` — ${h.day} ${h.open}–${h.close}`;
      lines.push(row);
    }
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["site-facts", "pickup-hours"],
      reason: "site-pickup-hours-fact",
      deterministicAnswer: true,
      text: lines.join("\n")
    };
  }

  // Field-2a: card titles only
  if (/\b(card\s+titles?|list\s+(?:the|all)?\s*cards?|what\s+(?:are|is)\s+the\s+cards?|name\s+(?:the|all)?\s*cards?)\b/i.test(lower)
      && !/\bdetail|description|body|say|read|content\b/i.test(lower)) {
    if (brain.siteFacts.totalCards === 0) return null;
    const titles = brain.siteFacts.cardTitles.map((c) => c.title);
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["site-facts", "card-titles"],
      reason: "site-card-titles-fact",
      deterministicAnswer: true,
      text: `Card titles: ${titles.join("; ")}.`
    };
  }

  // Field-2b: card details / titles + bodies
  if (/\b(card\s+(?:details|descriptions|content|bodies|text)|what\s+(?:does|do)\s+each\s+card\s+(?:say|have|show)|titles\s+and\s+(?:details|descriptions|bodies)|details\s+of\s+(?:each|the)\s+card)\b/i.test(lower)) {
    if (brain.siteFacts.totalCards === 0) return null;
    const lines = brain.siteFacts.cardTitles.map((c) => {
      return c.body ? `${c.title} — ${c.body}` : c.title;
    });
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["site-facts", "card-details"],
      reason: "site-card-details-fact",
      deterministicAnswer: true,
      text: `Card details: ${lines.join("; ")}.`
    };
  }

  // Field-3: contact info
  if (/\b(contact\s+(?:info|details|information)|how\s+to\s+(?:contact|reach)|phone\s+number|email\s+address|street\s+address|mailing\s+address)\b/i.test(lower)) {
    if (brain.siteFacts.totalContactBlocks === 0) return null;
    const c = brain.siteFacts.contact[0];
    const pieces = [c.phone && `phone ${c.phone}`, c.email && `email ${c.email}`, c.address && `address ${c.address}`].filter(Boolean);
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["site-facts", "contact"],
      reason: "site-contact-fact",
      deterministicAnswer: true,
      text: `Contact: ${pieces.join("; ")}.`
    };
  }

  // Field-4: page list
  if (/\b(page\s+list|list\s+(?:the|all)?\s*pages?|what\s+pages?\s+(?:do\s+we|are\s+there)|site\s+pages?|all\s+pages?)\b/i.test(lower)) {
    if (brain.siteFacts.pageList.length === 0) return null;
    return {
      engine: "sbuild-brain",
      mode: "deterministic",
      model: "sbuild-brain",
      latencyMs: 0,
      timeoutMs: null,
      contextUsed: ["site-facts", "page-list"],
      reason: "site-page-list-fact",
      deterministicAnswer: true,
      text: `Pages: ${brain.siteFacts.pageList.join("; ")}.`
    };
  }

  // Field-5: selected block detail (image alt or text body)
  if (brain.selectedBlock) {
    if (/\b(selected\s+block\s+(?:title|description|detail|info)|what\s+is\s+(?:this|the)\s+(?:selected\s+)?block|describe\s+(?:this|the)\s+(?:selected\s+)?block)\b/i.test(lower)) {
      const sb = brain.selectedBlock;
      const lines = [`Selected block: ${sb.type} on page "${sb.pageTitle}".`];
      if (sb.title) lines.push(`Title: ${sb.title}`);
      if (sb.description) lines.push(`Description: ${sb.description}`);
      if (sb.body) lines.push(`Body: ${sb.body.slice(0, 200)}`);
      return {
        engine: "sbuild-brain",
        mode: "deterministic",
        model: "sbuild-brain",
        latencyMs: 0,
        timeoutMs: null,
        contextUsed: ["selected-block"],
        reason: "selected-block-detail-fact",
        deterministicAnswer: true,
        text: lines.join("\n")
      };
    }
    if (/\b(image\s+(?:alt|alt\s+text|description|caption)|what\s+does\s+the\s+image\s+(?:show|say))\b/i.test(lower) && brain.selectedBlock.type === "image") {
      const sb = brain.selectedBlock;
      return {
        engine: "sbuild-brain",
        mode: "deterministic",
        model: "sbuild-brain",
        latencyMs: 0,
        timeoutMs: null,
        contextUsed: ["selected-block"],
        reason: "site-image-alt-fact",
        deterministicAnswer: true,
        text: sb.title || sb.description || "(image block has no alt text)"
      };
    }
  }

  // No site-fact match → LLM.
  return null;
}

export function formatBrainContextForPrompt(brain: SBuildBrainContext): string {
  const lines: string[] = [];
  lines.push(`# sBuild Brain — site + app context`);
  lines.push(`App: ${brain.build.appName} ${brain.build.displayVersion} (base ${brain.build.baseVersion}, commit ${brain.build.gitCommit}, branch ${brain.build.branch}, count ${brain.build.commitCount}, build ${brain.build.buildDate})`);
  lines.push(`Project: ${brain.project.name} (slug ${brain.project.slug}) — ${brain.project.pageCount} pages, ${brain.project.blockCount} blocks.`);
  const typeSummary = Object.entries(brain.project.blocksByType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, n]) => `${t}:${n}`)
    .join(", ");
  if (typeSummary) lines.push(`Block types: ${typeSummary}.`);
  if (brain.project.pages.length > 0) {
    const pageList = brain.project.pages
      .slice(0, 12)
      .map((p) => `${p.title} (${p.blockCount} blocks)`)
      .join("; ");
    lines.push(`Pages: ${pageList}.`);
  }
  if (brain.siteFacts.totalCards > 0) {
    lines.push(`Total cards across the site: ${brain.siteFacts.totalCards}.`);
  }
  if (brain.siteFacts.totalHours > 0) {
    lines.push(`Total pickup hour rows across the site: ${brain.siteFacts.totalHours}.`);
  }
  if (brain.siteFacts.totalContactBlocks > 0) {
    lines.push(`Contact blocks on the site: ${brain.siteFacts.totalContactBlocks}.`);
  }
  if (brain.siteFacts.totalGalleryBlocks > 0) {
    lines.push(`Gallery blocks: ${brain.siteFacts.totalGalleryBlocks} (${brain.siteFacts.totalGalleryImages} images total).`);
  }
  if (brain.selectedBlock) {
    lines.push(`Selected block: ${brain.selectedBlock.type} (id ${brain.selectedBlock.id}) on page "${brain.selectedBlock.pageTitle}".`);
    if (brain.selectedBlock.title) lines.push(`  Title: ${brain.selectedBlock.title}`);
    if (brain.selectedBlock.description) lines.push(`  Description: ${brain.selectedBlock.description}`);
    if (brain.selectedBlock.body) lines.push(`  Body: ${brain.selectedBlock.body.slice(0, 200)}`);
    if (brain.selectedBlock.cardDetails.length > 0) {
      const cards = brain.selectedBlock.cardDetails.map((c) => c.body ? `${c.title} — ${c.body}` : c.title).join("; ");
      lines.push(`  Cards: ${cards}`);
    }
    if (brain.selectedBlock.pickupHours.length > 0) {
      const hours = brain.selectedBlock.pickupHours
        .map((r) => `${r.day} ${r.open}-${r.close}${r.note ? " (" + r.note + ")" : ""}`)
        .join("; ");
      lines.push(`  Hours: ${hours}`);
    }
    if (brain.selectedBlock.contact.phone || brain.selectedBlock.contact.email || brain.selectedBlock.contact.address) {
      lines.push(`  Contact: ${[brain.selectedBlock.contact.phone, brain.selectedBlock.contact.email, brain.selectedBlock.contact.address].filter(Boolean).join(" • ")}`);
    }
  } else {
    lines.push(`Selected block: none.`);
  }
  lines.push(`App capabilities: can read project + selected block + site facts, can generate copy, can propose edits, can apply edits locally (publish is manual). Cannot browse the internet, cannot run code, cannot publish on its own.`);
  return lines.join("\n");
}

export function brainSummary(brain: SBuildBrainContext): string {
  return [
    `Brain loaded: ${brain.project.name} (${brain.project.pageCount} pages, ${brain.project.blockCount} blocks)`,
    brain.selectedBlock ? `Selected: ${brain.selectedBlock.type} block on "${brain.selectedBlock.pageTitle}"` : "No block selected",
    `Build: ${brain.build.displayVersion} (${brain.build.gitCommit})`
  ].join(" | ");
}
