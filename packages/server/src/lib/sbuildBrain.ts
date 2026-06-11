import type {
  Block,
  BlockType,
  SBuildPage,
  SBuildProject
} from "@sbuild/shared";

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

export type BrainAnswerKind = "answered" | "needs-llm" | "out-of-scope";

export interface BrainAnswer {
  kind: BrainAnswerKind;
  text: string;
  source: "brain-version" | "brain-ui" | "brain-site" | "brain-block" | "brain-app" | "brain-route";
  scope?: "selected-block" | "page" | "site" | "app";
  needsGeneralKnowledge?: boolean;
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
    const cards = Array.isArray(d.cards) ? d.cards : [];
    summary.cardTitles = cards
      .map((c) => safeText((c as Record<string, unknown>).title))
      .filter(Boolean);
    summary.cardDetails = cards
      .map((c) => ({
        title: safeText((c as Record<string, unknown>).title, 120),
        body: safeText((c as Record<string, unknown>).body, 200)
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
        const cards = Array.isArray(d.cards) ? d.cards : [];
        for (const c of cards) {
          cardTitles.push({
            page: page.title,
            blockId: block.id,
            title: safeText((c as Record<string, unknown>).title, 120),
            body: safeText((c as Record<string, unknown>).body, 200)
          });
        }
        totalCards += cards.length;
      } else if (block.type === "hours") {
        const rows = Array.isArray(d.rows) ? (d.rows as Array<Record<string, unknown>>) : [];
        for (const r of rows) {
          pickupHours.push({
            page: page.title,
            blockId: block.id,
            day: safeText((r as Record<string, unknown>).day, 32),
            open: safeText((r as Record<string, unknown>).open, 32),
            close: safeText((r as Record<string, unknown>).close, 32),
            note: safeText((r as Record<string, unknown>).note, 80)
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

const VERSION_PATTERNS: RegExp[] = [
  /what\s+(version|build|version\s*\/\s*build)\s*(am i|are we)\s+running/i,
  /what\s+(version|build|version\s*\/\s*build)\s+is\s+(this|sbuild)/i,
  /what\s+is\s+the\s+(version|build|app\s+version|version\s*\/\s*build)/i,
  /\b(app\s+version|sbuild\s+version|version\s+number|build\s+number|build\s+id|version\s*\/\s*build)\b/i,
  /\bwhat\s+commit\b/i,
  /\bwhat\s+branch\b/i
];

const UI_STATE_PATTERNS: RegExp[] = [
  /\bwhich\s+block\s+is\s+selected\b/i,
  /\bwhat\s+block\s+is\s+selected\b/i,
  /\bwhat\s+is\s+the\s+selected\s+block\b/i,
  /\bwhat\s+(mode|scope|target)\s+(is|am\s+i\s+in)\b/i,
  /\bwhich\s+(page|mode|scope|target)\s+(is|am\s+i\s+in)\b/i,
  /\bwhat\s+page\s+(am\s+i\s+on|is\s+active|is\s+selected)\b/i
];

const PAGE_LIST_PATTERNS: RegExp[] = [
  /what\s+pages\s+(are\s+on|exist\s+on|in)\s+(this|the)\s+(site|website|project)/i,
  /list\s+(the|all)\s+pages/i,
  /how\s+many\s+pages/i,
  /what\s+is\s+on\s+this\s+(site|website)/i
];

const CARD_QA_PATTERNS: RegExp[] = [
  /cards?\b.*\b(titles?|details?|descriptions?|names?)\b/i,
  /\b(titles?|details?|descriptions?|names?)\b.*\bcards?\b/i,
  /what\s+are\s+the\s+(card|item)\b/i,
  /list\s+the\s+cards?/i,
  /what\s+cards?\s+are\s+(on|listed)/i
];

const HOURS_QA_PATTERNS: RegExp[] = [
  /\bpickup\s+hours?\b/i,
  /\b(farm|store|shop)\W*s\s+pickup\s+hours?\b/i,
  /\bwhat\s+are\s+(the\s+)?(farm|store|shop)\W*s\s+hours?\b/i,
  /\b(hours?\s+of\s+operation|business\s+hours?|opening\s+hours?)\b/i,
  /\bwhen\s+(are\s+you|is\s+the\s+(farm|store|shop))\s+open\b/i,
  /\bwhat\s+time\s+(do\s+you|does\s+the)\s+(open|close)\b/i
];

const CONTACT_QA_PATTERNS: RegExp[] = [
  /\b(what\s+is\s+the\s+)?(phone|email|address)\b/i,
  /\bcontact\s+(info|details|information)\b/i,
  /\bwhere\s+(are\s+you|is\s+the\s+(farm|store|shop))\s+located\b/i,
  /\bhow\s+(do|can)\s+i\s+(contact|reach)\s+you\b/i
];

const SELECTED_BLOCK_QA_PATTERNS: RegExp[] = [
  /\b(this\s+block|selected\s+block|current\s+block)\b/i,
  /\bwhat\s+is\s+(this|the\s+selected|the\s+current)\s+block\b/i
];

const SELECTED_BLOCK_TITLE_PATTERNS: RegExp[] = [
  /\btitle\s+(of|for)\s+(this|the\s+selected|the\s+current)\s+block\b/i,
  /\bwhat\s+is\s+the\s+title\s+(of|for)\s+(this|the\s+selected|the\s+current)\s+block\b/i,
  /\bwhat\s+is\s+(this|the\s+selected|the\s+current)\s+block\s+called\b/i
];

const SELECTED_BLOCK_DESCRIPTION_PATTERNS: RegExp[] = [
  /\bdescription\s+(of|for)\s+(this|the\s+selected|the\s+current)\s+block\b/i,
  /\bwhat\s+is\s+the\s+description\s+(of|for)\s+(this|the\s+selected|the\s+current)\s+block\b/i
];

const APP_QA_PATTERNS: RegExp[] = [
  /\b(sbuild|editor|app)\b.*\b(what|capabilities|features|can\s+you|how\s+do)\b/i,
  /\bwhat\s+can\s+you\s+do\b/i,
  /\bwhat\s+are\s+your\s+capabilities\b/i,
  /\bhow\s+do\s+i\s+use\s+(sbuild|this\s+editor|the\s+ai)\b/i
];

const GENERAL_KNOWLEDGE_HINTS: RegExp[] = [
  /\bwhat\s+color\s+is\b/i,
  /\bwho\s+(is|was)\b/i,
  /\bwhat\s+is\s+the\s+capital\s+of\b/i,
  /\b(weather|temperature)\s+(in|today|tomorrow)\b/i,
  /\b(recipe|cook)\b/i,
  /\b(history\s+of|famous\s+for)\b/i,
  /\b(kernel|banana|apple|tomato|carrot)\b/i
];

const SITE_EDIT_KEYWORDS = /\b(site|page|block|website|heading|subheading|title|description|text|copy|layout|image|hero|section|footer|header|nav|gallery|card|button|cta|background|font|style|content|paragraph|tagline|blurb|intro|body|on\s+this\s+(site|page|block)|block\s+(title|description|copy|color|font|background))\b/i;

function answerVersionQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  return {
    kind: "answered",
    text: [
      `You are running ${brain.build.appName} ${brain.build.displayVersion}.`,
      `Base version: ${brain.build.baseVersion}.`,
      `Git commit: ${brain.build.gitCommit} on branch ${brain.build.branch}.`,
      `Commit count: ${brain.build.commitCount}.`,
      `Build date (UTC): ${brain.build.buildDate}.`,
      `Publish allowed: ${brain.build.publishAllowed ? "yes" : "no"}.`
    ].join(" "),
    source: "brain-version",
    scope: "app"
  };
}

function answerUiStateQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  if (brain.selectedBlock) {
    return {
      kind: "answered",
      text: `Selected block: ${brain.selectedBlock.type} (id ${brain.selectedBlock.id}) on page "${brain.selectedBlock.pageTitle}".`,
      source: "brain-ui",
      scope: "selected-block"
    };
  }
  return {
    kind: "answered",
    text: "No block is currently selected.",
    source: "brain-ui",
    scope: "selected-block"
  };
}

function answerPageListQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  const pages = brain.siteFacts.pageList;
  if (pages.length === 0) {
    return {
      kind: "answered",
      text: "This site has no pages yet.",
      source: "brain-site",
      scope: "site"
    };
  }
  return {
    kind: "answered",
    text: `Pages on this site (${pages.length}): ${pages.join("; ")}.`,
    source: "brain-site",
    scope: "site"
  };
}

function answerCardQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  if (brain.selectedBlock && brain.selectedBlock.type === "cards" && brain.selectedBlock.cardDetails.length > 0) {
    const combined = brain.selectedBlock.cardDetails.map((c) =>
      c.body ? `${c.title} — ${c.body}` : c.title
    );
    return {
      kind: "answered",
      text: `Cards in this block (${combined.length}):\n${combined.join("\n")}`,
      source: "brain-block",
      scope: "selected-block"
    };
  }
  if (brain.siteFacts.cardTitles.length === 0) {
    return {
      kind: "answered",
      text: "This site has no cards yet.",
      source: "brain-site",
      scope: "site"
    };
  }
  const combined = brain.siteFacts.cardTitles.map((c) =>
    c.body ? `${c.title} — ${c.body}` : c.title
  );
  return {
    kind: "answered",
    text: `Cards on this site (${combined.length}):\n${combined.join("\n")}`,
    source: "brain-site",
    scope: "site"
  };
}

function answerHoursQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  if (brain.siteFacts.pickupHours.length === 0) {
    return {
      kind: "answered",
      text: "No pickup hours are set on this site yet. Add a Hours block to a page to set them.",
      source: "brain-site",
      scope: "site"
    };
  }
  const lines = brain.siteFacts.pickupHours.map((r) => {
    const range = r.open || r.close ? `${r.open || "?"}–${r.close || "?"}` : "(hours not set)";
    return r.note ? `${r.day} ${range} (${r.note})` : `${r.day} ${range}`;
  });
  return {
    kind: "answered",
    text: `Pickup hours on this site (${brain.siteFacts.totalHours} entries): ${lines.slice(0, 12).join("; ")}`,
    source: "brain-site",
    scope: "site"
  };
}

function answerContactQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  if (brain.siteFacts.contact.length === 0) {
    return {
      kind: "answered",
      text: "No contact information is set on this site yet. Add a Contact block to a page to set phone, email, and address.",
      source: "brain-site",
      scope: "site"
    };
  }
  const parts = brain.siteFacts.contact.map((c) => {
    const fields = [c.phone, c.email, c.address].filter(Boolean);
    return fields.length ? `${c.page}: ${fields.join(" • ")}` : `${c.page}: (contact block empty)`;
  });
  return {
    kind: "answered",
    text: `Contact information on this site: ${parts.join("; ")}`,
    source: "brain-site",
    scope: "site"
  };
}

function answerSelectedBlockTitle(brain: SBuildBrainContext): BrainAnswer | null {
  if (!brain.selectedBlock) {
    return {
      kind: "answered",
      text: "No block is currently selected. Select a block in the editor first.",
      source: "brain-block",
      scope: "selected-block"
    };
  }
  if (brain.selectedBlock.title) {
    return {
      kind: "answered",
      text: `The selected block (${brain.selectedBlock.type}) title is: ${brain.selectedBlock.title}`,
      source: "brain-block",
      scope: "selected-block"
    };
  }
  return {
    kind: "answered",
    text: `The selected block is a ${brain.selectedBlock.type} block on "${brain.selectedBlock.pageTitle}" and has no title set.`,
    source: "brain-block",
    scope: "selected-block"
  };
}

function answerSelectedBlockDescription(brain: SBuildBrainContext): BrainAnswer | null {
  if (!brain.selectedBlock) {
    return {
      kind: "answered",
      text: "No block is currently selected. Select a block in the editor first.",
      source: "brain-block",
      scope: "selected-block"
    };
  }
  const parts: string[] = [];
  if (brain.selectedBlock.title) parts.push(`Title: ${brain.selectedBlock.title}`);
  if (brain.selectedBlock.description) parts.push(`Description: ${brain.selectedBlock.description}`);
  if (parts.length === 0 && brain.selectedBlock.body) {
    parts.push(`Body: ${brain.selectedBlock.body}`);
  }
  if (parts.length > 0) {
    return {
      kind: "answered",
      text: `The selected block (${brain.selectedBlock.type}) on "${brain.selectedBlock.pageTitle}": ${parts.join("; ")}`,
      source: "brain-block",
      scope: "selected-block"
    };
  }
  return {
    kind: "answered",
    text: `The selected block is a ${brain.selectedBlock.type} block on "${brain.selectedBlock.pageTitle}" and has no title, description, or body text set.`,
    source: "brain-block",
    scope: "selected-block"
  };
}

function answerAppCapabilitiesQuestion(brain: SBuildBrainContext): BrainAnswer | null {
  return {
    kind: "answered",
    text: [
      `${brain.build.appName} is a website editor.`,
      `It can read your project's pages, blocks, and selected block.`,
      `It can generate copy and image suggestions, propose edits to a selected block, and apply them locally (you still publish manually).`,
      `It cannot browse the internet, run code, or publish to your live site on its own.`,
      `Version: ${brain.build.displayVersion}.`
    ].join(" "),
    source: "brain-app",
    scope: "app"
  };
}

function looksLikeGeneralKnowledge(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (SITE_EDIT_KEYWORDS.test(lower)) return false;
  for (const pattern of GENERAL_KNOWLEDGE_HINTS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

export function answerBrainQuestion(prompt: string, brain: SBuildBrainContext): BrainAnswer | null {
  const trimmed = String(prompt || "").trim();
  if (!trimmed) return null;

  for (const pattern of VERSION_PATTERNS) {
    if (pattern.test(trimmed)) return answerVersionQuestion(brain);
  }
  for (const pattern of UI_STATE_PATTERNS) {
    if (pattern.test(trimmed)) return answerUiStateQuestion(brain);
  }
  for (const pattern of SELECTED_BLOCK_TITLE_PATTERNS) {
    if (pattern.test(trimmed) && !/title\s+and\s+description/i.test(trimmed)) {
      return answerSelectedBlockTitle(brain);
    }
  }
  for (const pattern of SELECTED_BLOCK_DESCRIPTION_PATTERNS) {
    if (pattern.test(trimmed) && !/title\s+and\s+description/i.test(trimmed)) {
      return answerSelectedBlockDescription(brain);
    }
  }
  for (const pattern of SELECTED_BLOCK_QA_PATTERNS) {
    if (pattern.test(trimmed)) return answerSelectedBlockDescription(brain);
  }
  for (const pattern of PAGE_LIST_PATTERNS) {
    if (pattern.test(trimmed)) return answerPageListQuestion(brain);
  }
  for (const pattern of HOURS_QA_PATTERNS) {
    if (pattern.test(trimmed)) return answerHoursQuestion(brain);
  }
  for (const pattern of CONTACT_QA_PATTERNS) {
    if (pattern.test(trimmed)) return answerContactQuestion(brain);
  }
  for (const pattern of CARD_QA_PATTERNS) {
    if (pattern.test(trimmed)) return answerCardQuestion(brain);
  }
  for (const pattern of APP_QA_PATTERNS) {
    if (pattern.test(trimmed)) return answerAppCapabilitiesQuestion(brain);
  }

  if (looksLikeGeneralKnowledge(trimmed)) {
    return {
      kind: "needs-llm",
      text: "This looks like a general-knowledge question. The Brain doesn't have a fact store for that, so this needs the language model.",
      source: "brain-route",
      needsGeneralKnowledge: true
    };
  }

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
    lines.push(`Total cards: ${brain.siteFacts.totalCards} across the site.`);
  }
  if (brain.siteFacts.totalHours > 0) {
    lines.push(`Total pickup hour rows: ${brain.siteFacts.totalHours} across the site.`);
  }
  if (brain.siteFacts.totalContactBlocks > 0) {
    lines.push(`Contact blocks: ${brain.siteFacts.totalContactBlocks}.`);
  }
  if (brain.siteFacts.totalGalleryBlocks > 0) {
    lines.push(`Gallery blocks: ${brain.siteFacts.totalGalleryBlocks} (${brain.siteFacts.totalGalleryImages} images).`);
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
