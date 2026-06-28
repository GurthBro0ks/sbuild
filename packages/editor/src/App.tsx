import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEventHandler } from "react";
import {
  Block,
  BlockType,
  DividerBlockData,
  DividerStyle,
  ImageSizeDecision,
  ImageTargetContext,
  MarkupAnnotation,
  MarkupFreehandStroke,
  SBuildNavItem,
  SBuildPage,
  SBuildProject,
  HeroBlockData,
  TextBlockData,
  ImageBlockData,
  CardsBlockData,
  HoursBlockData,
  GalleryBlockData,
  ContactBlockData,
  TestimonialBlockData,
  MapBlockData,
  MarqueeBlockData,
  SpacerBlockData,
  HtmlBlockData,
  BlockEffect,
  BlockPartStyles,
  PartStyle,
  SBuildProviderStatus,
  SBuildBuildInfo,
  SBUILD_VERSION,
  SBUILD_APP_NAME,
  clampMinHeight,
  clampWidthPercent,
  groupBlocksIntoRows,
  joinAdjacentBlocks,
  leaveRowForBlock,
  snapMinHeight,
  snapWidthPercent,
  createPage,
  duplicatePage,
  deletePage as deletePageHelper,
  renamePage,
  updatePageSlug,
  buildNavItems,
  migrateLegacyProject,
  generateSlug,
  getUniqueSlug,
  getStarterBlocks,
  STARTER_TEMPLATES,
  IMAGE_GEN_STYLE_PRESETS,
  IMAGE_GEN_SIZE_PRESETS,
} from "@sbuild/shared";
import {
  collectUsedImageUrls,
  createImageDeleteRequest,
  getBuildIdentityState,
  getDisplayVersion,
  getSaveFailureState,
  imagePassesFilter,
  isRenderableImageMeta,
  isLikelyScreenshotName,
  shouldSyncEditableTextContent,
  type BuildInfoStatus,
  type BuildIdentityState,
  type ImageDiagnostics,
  type ImageLibraryFilter,
  type ImageMeta
} from "./editorBehavior.js";
import { moveMarkupAnnotation } from "./markupAnnotations.js";
import { MarkupWorkspace } from "./MarkupWorkspace.js";
import { VersionIdentityBanner } from "./VersionIdentityBanner.js";

type DeviceMode = "desktop" | "tablet" | "phone";
type RightTab = "properties" | "style" | "images" | "ai" | "status";
type PropertiesTab = "fields" | "resize";
type SettingsTab = "general" | "providers" | "keys" | "deploy" | "debug" | "about" | "account" | "users";
type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  provider?: string;
  model?: string;
  source?: string;
  latencyMs?: number;
  retryPrompt?: string;
  engine?: string;
  mode?: string;
  engineModel?: string;
  engineReason?: string;
  deterministicAnswer?: boolean;
  fallbackUsed?: boolean;
  fallbackFrom?: string | null;
  fallbackReason?: string | null;
};
type StructuredSuggestionProposal = {
  kind: "replace-copy";
  replaceText: string;
  targetField?: string;
};
type ProviderSource = "missing" | "local" | "env" | "configured" | "not_configured" | "unknown";
type ChannelStatus = {
  source: ProviderSource;
  configured: boolean;
  statusText: string;
  maskedKey: string | null;
  message?: string;
};
type SecretStatus = {
  chat: ChannelStatus;
  chatOpenAI: ChannelStatus;
  chatOpenRouter: ChannelStatus;
  imageGen: ChannelStatus;
  imageAnalyze: ChannelStatus;
};
type AiTopMenuTab = "chat" | "image-gen" | "image-enhance";
type AiChatTarget = "block" | "page" | "site";
type PaintPoint = { x: number; y: number };
type PaintTool = "brush" | "eraser";
type PaintDrawMode = "free" | "line";
type PaintStroke = { id: string; tool: Exclude<PaintTool, "eraser">; mode: PaintDrawMode; color: string; size: number; opacity?: number; points: PaintPoint[] };
const MARKUP_DRAFT_STROKE_OPACITY = 1;
const MARKUP_APPLIED_STROKE_OPACITY = 1;
const MARKUP_STROKE_MIN_VISIBLE_OPACITY = 0.9;
const MARKUP_STROKE_OUTER_HALO_WIDTH_OFFSET = 8;
const MARKUP_STROKE_INNER_HALO_WIDTH_OFFSET = 4;
const MARKUP_STROKE_OUTER_HALO_OPACITY = 0.9;
const MARKUP_STROKE_INNER_HALO_OPACITY = 0.78;
type DragState = { blockId: string; startIndex: number; currentIndex: number } | null;
type ContextMenuState = { visible: boolean; x: number; y: number; blockId: string; isSiteHeader?: boolean } | null;
type ResizeDragState = { handle: "right" | "bottom"; blockId: string; startX: number; startY: number; startWidth: number; startMinHeight: number } | null;
type AiPanelRect = { x: number; y: number; width: number; height: number };
type AiPanelDragState = { pointerId: number; offsetX: number; offsetY: number } | null;
type AiPanelResizeHandle = "corner";
type AiPanelResizeState = { pointerId: number; handle: AiPanelResizeHandle; startX: number; startY: number; startWidth: number; startHeight: number } | null;
type ImageTileFit = "cover" | "contain";
type RowRenderItem = { kind: "single"; block: Block } | { kind: "row"; rowId: string; blocks: Block[] };

const AI_PANEL_STORAGE_KEY = "sbuild_ai_panel_rect_v1";
const AI_PANEL_MIN_WIDTH = 440;
const AI_PANEL_MIN_HEIGHT = 480;
const AI_PANEL_MAX_WIDTH = 760;
const AI_PANEL_MARGIN = 16;
const AI_PANEL_STORAGE_VERSION = 1;
const AI_PANEL_MOBILE_TOPBAR_FALLBACK = 110;

function readCssPxVar(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function visualViewportHeight(): number {
  if (typeof window === "undefined") return 760;
  return window.visualViewport?.height || window.innerHeight;
}

function aiPanelViewportBounds() {
  if (typeof window === "undefined") {
    return {
      left: AI_PANEL_MARGIN,
      top: 72,
      width: 1024 - AI_PANEL_MARGIN * 2,
      height: 768 - 72 - AI_PANEL_MARGIN
    };
  }
  const isMobile = window.innerWidth <= 768;
  const topbarH = isMobile ? readCssPxVar("--mobile-topbar-h", AI_PANEL_MOBILE_TOPBAR_FALLBACK) : 0;
  const safeTop = readCssPxVar("--safe-area-top", 0);
  const safeBottom = readCssPxVar("--safe-area-bottom", 0);
  const top = isMobile ? Math.max(topbarH, safeTop) + 8 : AI_PANEL_MARGIN;
  const bottom = safeBottom + AI_PANEL_MARGIN;
  return {
    left: AI_PANEL_MARGIN,
    top,
    width: Math.max(AI_PANEL_MIN_WIDTH, window.innerWidth - AI_PANEL_MARGIN * 2),
    height: Math.max(240, visualViewportHeight() - top - bottom)
  };
}

function formatChatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function chatFooterText(item: ChatItem): string {
  const parts = [formatChatTimestamp(item.timestamp)];
  if (item.role === "assistant") {
    if (item.engine) {
      const label = item.engine === "sbuild-brain"
        ? "sBuild Brain"
        : item.engine === "local-ollama"
          ? `local Ollama${item.engineModel ? ` (${item.engineModel})` : ""}`
          : item.engine === "openai-api"
            ? `${item.provider === "openrouter" ? "OpenRouter" : item.provider === "openai" ? "OpenAI" : "API"}${item.engineModel ? ` (${item.engineModel})` : ""}`
            : item.engine === "unavailable"
              ? "no engine"
              : item.engine;
      parts.push(label);
      if (item.mode) parts.push(item.mode);
    } else {
      if (item.source) parts.push(item.source);
      if (item.model) parts.push(item.model);
    }
    if (typeof item.latencyMs === "number" && Number.isFinite(item.latencyMs)) {
      parts.push(`${(item.latencyMs / 1000).toFixed(1)}s`);
    }
    if (item.fallbackUsed && item.fallbackFrom) {
      parts.push(`fallback from ${item.fallbackFrom}`);
    }
    if (item.fallbackReason) {
      parts.push(item.fallbackReason);
    }
  }
  return parts.join(" · ");
}

function defaultAiPanelRect(): AiPanelRect {
  if (typeof window === "undefined") {
    return { x: 24, y: 96, width: 560, height: 680 };
  }
  const bounds = aiPanelViewportBounds();
  const width = Math.min(560, bounds.width);
  const maxHeight = Math.max(AI_PANEL_MIN_HEIGHT, bounds.height);
  const height = Math.min(680, maxHeight);
  const x = Math.max(bounds.left, window.innerWidth - width - 24);
  const y = Math.max(bounds.top, Math.round(bounds.top + (bounds.height - height) / 2));
  return { x, y, width, height };
}

function clampAiPanelRect(rect: AiPanelRect): AiPanelRect {
  if (typeof window === "undefined") return rect;
  const bounds = aiPanelViewportBounds();
  const maxWidth = Math.min(AI_PANEL_MAX_WIDTH, bounds.width);
  const width = Math.min(maxWidth, Math.max(AI_PANEL_MIN_WIDTH, rect.width));
  const maxHeight = Math.max(AI_PANEL_MIN_HEIGHT, bounds.height);
  const height = Math.min(maxHeight, Math.max(AI_PANEL_MIN_HEIGHT, rect.height));
  const maxX = Math.max(bounds.left, window.innerWidth - width - AI_PANEL_MARGIN);
  const maxY = Math.max(bounds.top, bounds.top + bounds.height - height);
  const x = Math.min(maxX, Math.max(bounds.left, rect.x));
  const y = Math.min(maxY, Math.max(bounds.top, rect.y));
  return { x, y, width, height };
}

function isStoredAiPanelRect(value: unknown): value is AiPanelRect & { version?: number } {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Partial<AiPanelRect> & { version?: unknown };
  if (parsed.version !== undefined && parsed.version !== AI_PANEL_STORAGE_VERSION) return false;
  return [parsed.x, parsed.y, parsed.width, parsed.height].every((n) => typeof n === "number" && Number.isFinite(n));
}

function loadAiPanelRect(): AiPanelRect {
  if (typeof window === "undefined") return defaultAiPanelRect();
  try {
    const raw = localStorage.getItem(AI_PANEL_STORAGE_KEY);
    if (!raw) return defaultAiPanelRect();
    const parsed = JSON.parse(raw);
    if (!isStoredAiPanelRect(parsed)) return defaultAiPanelRect();
    return clampAiPanelRect(parsed);
  } catch {
    return defaultAiPanelRect();
  }
}

const BLOCK_TYPES: BlockType[] = [
  "hero", "text", "image", "cards", "hours", "gallery", "contact",
  "testimonial", "map", "marquee", "spacer", "divider", "html"
];

const EFFECTS: BlockEffect[] = ["glow", "marquee", "fade-in", "gradient-text", "parallax", "pulse", "hover-grow"];

const DIVIDER_STYLES: DividerStyle[] = ["solid", "dashed", "dotted", "double", "gradient", "glow", "zigzag", "wave", "spacer-line"];

const ASPECT_RATIOS = ["free", "1:1", "4:3", "16:9", "3:2", "9:16"];
const QUICK_WIDTHS = ["full", "wide", "half", "third", "narrow", "custom"] as const;
const QUICK_HEIGHTS = ["auto", "short", "medium", "tall"] as const;

const WIDTH_PRESETS: Record<(typeof QUICK_WIDTHS)[number], number> = {
  full: 100,
  wide: 75,
  half: 50,
  third: 33,
  narrow: 25,
  custom: 60
};

const themePresets = [
  { name: "Harvest Light", colors: { bg: "#f6f3e9", surface: "#fffef9", text: "#1f2a24", accent: "#2f6b3f", muted: "#6f7f73", pageBackground: "#f3ecdc", canvasBackground: "#f6f3e9", navBackground: "#fffef9", blockBackground: "#fffef9", blockAltBackground: "#f7efdc", cardBackground: "#f8f1df", cardAltBackground: "#fff9ec", headingColor: "#1f2a24", bodyTextColor: "#2d3a32", mutedTextColor: "#6f7f73", accentColor: "#2f6b3f", buttonBackground: "#2f6b3f", buttonTextColor: "#ffffff", borderColor: "#d5cfbe", shadowColor: "rgba(41,51,44,.18)", linkColor: "#2f6b3f" }, headingFont: "Nunito Sans", bodyFont: "Nunito Sans", isDark: false },
  { name: "Farmstand Dark", colors: { bg: "#1a1f1c", surface: "#242b26", text: "#e8f0e9", accent: "#5cb85c", muted: "#8a9a8d", pageBackground: "#131815", canvasBackground: "#1a1f1c", navBackground: "#1f2621", blockBackground: "#242b26", blockAltBackground: "#2c342f", cardBackground: "#2b342f", cardAltBackground: "#333d37", headingColor: "#eef8ef", bodyTextColor: "#d6e2d8", mutedTextColor: "#8a9a8d", accentColor: "#5cb85c", buttonBackground: "#315f39", buttonTextColor: "#eef8ef", borderColor: "#3b4740", shadowColor: "rgba(0,0,0,.35)", linkColor: "#77cb77" }, headingFont: "Nunito Sans", bodyFont: "Nunito Sans", isDark: true },
  { name: "Slimy Neon", colors: { bg: "#0a0a12", surface: "#12121f", text: "#e0e0ff", accent: "#00ffaa", muted: "#6b6b8a", pageBackground: "#07070f", canvasBackground: "#0a0a12", navBackground: "#121824", blockBackground: "#12121f", blockAltBackground: "#17172a", cardBackground: "#191a2f", cardAltBackground: "#1f2140", headingColor: "#e8f2ff", bodyTextColor: "#d5ddf2", mutedTextColor: "#7b86a1", accentColor: "#00ffaa", buttonBackground: "#0d5a50", buttonTextColor: "#dffff5", borderColor: "#2c3048", shadowColor: "rgba(0,0,0,.45)", linkColor: "#4dfec8" }, headingFont: "Space Grotesk", bodyFont: "Lato", isDark: true },
  { name: "Midnight Orchard", colors: { bg: "#0f1419", surface: "#1a2028", text: "#d4dde5", accent: "#7eb8da", muted: "#5a6b7a", pageBackground: "#0b1015", canvasBackground: "#0f1419", navBackground: "#161d25", blockBackground: "#1a2028", blockAltBackground: "#212a33", cardBackground: "#222c36", cardAltBackground: "#293541", headingColor: "#dde8f1", bodyTextColor: "#cfd9e2", mutedTextColor: "#6d7d8f", accentColor: "#7eb8da", buttonBackground: "#2f4f62", buttonTextColor: "#dfeef9", borderColor: "#34414d", shadowColor: "rgba(0,0,0,.4)", linkColor: "#97cce9" }, headingFont: "Lato", bodyFont: "Lato", isDark: true },
  { name: "Retro Terminal", colors: { bg: "#0c0c0c", surface: "#1a1a1a", text: "#33ff33", accent: "#ffff33", muted: "#7ca57c", pageBackground: "#080808", canvasBackground: "#0c0c0c", navBackground: "#111111", blockBackground: "#1a1a1a", blockAltBackground: "#202020", cardBackground: "#222222", cardAltBackground: "#282828", headingColor: "#89ff89", bodyTextColor: "#33ff33", mutedTextColor: "#7ca57c", accentColor: "#ffff33", buttonBackground: "#2a3f2a", buttonTextColor: "#b6ff9b", borderColor: "#3e5a3e", shadowColor: "rgba(0,0,0,.5)", linkColor: "#d2ff55" }, headingFont: "Space Grotesk", bodyFont: "Lato", isDark: true },
  { name: "Clean Market", colors: { bg: "#fafafa", surface: "#ffffff", text: "#1a1a1a", accent: "#ff6b35", muted: "#888888", pageBackground: "#f3f3f3", canvasBackground: "#fafafa", navBackground: "#ffffff", blockBackground: "#ffffff", blockAltBackground: "#f6f6f6", cardBackground: "#f8f8f8", cardAltBackground: "#ffffff", headingColor: "#111111", bodyTextColor: "#2b2b2b", mutedTextColor: "#7d7d7d", accentColor: "#ff6b35", buttonBackground: "#ff6b35", buttonTextColor: "#ffffff", borderColor: "#dedede", shadowColor: "rgba(0,0,0,.12)", linkColor: "#d95322" }, headingFont: "Poppins", bodyFont: "Nunito Sans", isDark: false },
  { name: "Ocean", colors: { bg: "#eef6fb", surface: "#ffffff", text: "#1b2f3b", accent: "#1a7ba8", muted: "#5f7380", pageBackground: "#e5eff5", canvasBackground: "#eef6fb", navBackground: "#f7fbff", blockBackground: "#ffffff", blockAltBackground: "#f3f9fd", cardBackground: "#f4f9fc", cardAltBackground: "#ffffff", headingColor: "#163242", bodyTextColor: "#224051", mutedTextColor: "#6c818f", accentColor: "#1a7ba8", buttonBackground: "#1a7ba8", buttonTextColor: "#eaf8ff", borderColor: "#cddce6", shadowColor: "rgba(22,50,66,.16)", linkColor: "#1a7ba8" }, headingFont: "Lato", bodyFont: "Nunito Sans", isDark: false },
  { name: "Sunset", colors: { bg: "#fff1e8", surface: "#fffaf4", text: "#3a241f", accent: "#cc5f2f", muted: "#8b6b60", pageBackground: "#ffe8db", canvasBackground: "#fff1e8", navBackground: "#fff7ef", blockBackground: "#fffaf4", blockAltBackground: "#fff2e6", cardBackground: "#fff0e1", cardAltBackground: "#fff8ef", headingColor: "#4a2c25", bodyTextColor: "#543931", mutedTextColor: "#8b6b60", accentColor: "#cc5f2f", buttonBackground: "#cc5f2f", buttonTextColor: "#fff2e7", borderColor: "#e6c2ae", shadowColor: "rgba(87,51,39,.2)", linkColor: "#c15323" }, headingFont: "Playfair Display", bodyFont: "Lato", isDark: false }
];

const BACKGROUND_STYLE_PRESETS: Record<string, { label: string; description: string; css: Partial<Record<string, string>> }> = {
  clean: { label: "Clean", description: "No effects. Flat background.", css: {} },
  glass: { label: "Glass", description: "Transparent frosted panel with soft blur and border.", css: { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" } },
  neon: { label: "Neon glow", description: "Bright glow border and luminous shadow.", css: { boxShadow: "0 0 20px rgba(0,255,170,0.35), inset 0 0 10px rgba(0,255,170,0.1)", border: "1px solid rgba(0,255,170,0.4)" } },
  soft: { label: "Soft card", description: "Clean rounded surface with soft shadow.", css: { boxShadow: "0 8px 32px rgba(0,0,0,0.08)", borderRadius: "16px", border: "1px solid rgba(0,0,0,0.04)" } },
  bold: { label: "Bold panel", description: "Strong border and high-contrast background.", css: { boxShadow: "0 12px 40px rgba(0,0,0,0.18)", borderRadius: "8px", border: "2px solid var(--sbuild-accent)" } },
  terminal: { label: "Terminal", description: "Retro terminal surface with animated scanlines, blinking cursor, and CRT flicker.", css: { background: "#0c0c0c", color: "#33ff33", border: "1px solid #3e5a3e", fontFamily: "monospace", boxShadow: "inset 0 0 20px rgba(51,255,51,0.05)" } },
  "image-overlay": { label: "Image overlay", description: "Dark gradient for text legibility over images.", css: { background: "linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.7))", color: "#ffffff" } },
};

const BORDER_STYLE_PRESETS: Record<string, { label: string; borderWidth: number; borderColor?: string; borderStyle?: string }> = {
  none: { label: "None", borderWidth: 0 },
  thin: { label: "Thin", borderWidth: 1 },
  accent: { label: "Accent", borderWidth: 2, borderColor: "var(--sbuild-accent)" },
  double: { label: "Double", borderWidth: 3, borderStyle: "double" },
  dashed: { label: "Dashed", borderWidth: 2, borderStyle: "dashed" },
  "glow-edge": { label: "Glow edge", borderWidth: 1, borderColor: "rgba(0,255,170,0.5)" },
};

const SHADOW_STYLE_PRESETS: Record<string, { label: string; shadow: string }> = {
  none: { label: "None", shadow: "" },
  soft: { label: "Soft", shadow: "0 4px 16px rgba(0,0,0,0.06)" },
  lifted: { label: "Lifted", shadow: "0 12px 24px rgba(0,0,0,0.12)" },
  strong: { label: "Strong", shadow: "0 16px 48px rgba(0,0,0,0.22)" },
  neon: { label: "Neon", shadow: "0 0 24px rgba(0,255,170,0.35), 0 0 8px rgba(0,255,170,0.2)" },
  inner: { label: "Inner", shadow: "inset 0 2px 12px rgba(0,0,0,0.08)" },
};

const TEXT_EFFECT_PRESETS: Record<string, { label: string; css: Partial<Record<string, string>> }> = {
  none: { label: "None", css: {} },
  "subtle-glow": { label: "Subtle glow", css: { textShadow: "0 0 8px rgba(255,255,255,0.35)" } },
  "strong-glow": { label: "Strong glow", css: { textShadow: "0 0 16px rgba(0,255,170,0.6)" } },
  outline: { label: "Outline", css: { WebkitTextStroke: "1px currentColor", color: "transparent" } },
  shadow: { label: "Shadow", css: { textShadow: "2px 2px 4px rgba(0,0,0,0.35)" } },
};

const BUTTON_STYLE_PRESETS: Record<string, { label: string; css: Partial<Record<string, string>> }> = {
  solid: { label: "Solid", css: { background: "var(--sbuild-accent)", color: "#ffffff", border: "none" } },
  outline: { label: "Outline", css: { background: "transparent", color: "var(--sbuild-accent)", border: "2px solid var(--sbuild-accent)" } },
  ghost: { label: "Ghost", css: { background: "transparent", color: "var(--sbuild-accent)", border: "1px solid rgba(0,0,0,0.1)" } },
  pill: { label: "Pill", css: { background: "var(--sbuild-accent)", color: "#ffffff", border: "none", borderRadius: "999px" } },
  glow: { label: "Glow", css: { background: "var(--sbuild-accent)", color: "#ffffff", border: "none", boxShadow: "0 0 16px rgba(0,255,170,0.45)" } },
};

const OLD_LIGHT_BACKGROUNDS = new Set(["#fff", "#ffffff", "#fffef9", "#fafafa", "#f6f3e9"]);
const OLD_DARK_TEXT = new Set(["#222", "#222222", "#1f2a24", "#1a1a1a"]);

function normalizedHex(value?: string): string {
  return String(value || "").trim().toLowerCase();
}

function isThemeDerivedColor(value: string | undefined, previous: SBuildProject["globalStyles"]["colors"], kind: "bg" | "text" | "border"): boolean {
  const color = normalizedHex(value);
  if (!color) return true;
  if (kind === "bg") {
    if (OLD_LIGHT_BACKGROUNDS.has(color)) return true;
    const known = [
      previous.bg,
      previous.surface,
      previous.pageBackground,
      previous.canvasBackground,
      previous.navBackground,
      previous.blockBackground,
      previous.blockAltBackground,
      previous.cardBackground,
      previous.cardAltBackground
    ].map((v) => normalizedHex(v));
    return known.includes(color);
  }
  if (kind === "text") {
    if (OLD_DARK_TEXT.has(color)) return true;
    const known = [
      previous.text,
      previous.bodyTextColor,
      previous.headingColor,
      previous.mutedTextColor,
      previous.linkColor
    ].map((v) => normalizedHex(v));
    return known.includes(color);
  }
  const known = [previous.borderColor, previous.accent, previous.accentColor].map((v) => normalizedHex(v));
  return known.includes(color);
}

function shortRowId(rowId?: string): string {
  if (!rowId) return "Single";
  return `Row ${rowId.replace("row-", "").slice(0, 4).toUpperCase()}`;
}

function toRowRenderItems(blocks: Block[]): RowRenderItem[] {
  return groupBlocksIntoRows(blocks).reduce<RowRenderItem[]>((items, row) => {
    if (row.rowId.startsWith("single:") || row.blocks.length <= 1) {
      items.push(...row.blocks.map((block) => ({ kind: "single" as const, block })));
      return items;
    }
    items.push({ kind: "row" as const, rowId: row.rowId, blocks: row.blocks });
    return items;
  }, []);
}

function apiBase(): string { return ""; }

function toRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? input as Record<string, unknown> : {};
}

function toProviderSource(input: unknown): ProviderSource {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value.includes("configured-local") || value === "local") return "local";
  if (value.includes("configured-env") || value === "env") return "env";
  if (value === "missing" || value.includes("missing-key")) return "missing";
  if (value === "not_configured") return "not_configured";
  if (value === "configured") return "configured";
  if (value === "unknown") return "unknown";
  if (value.includes("local")) return "local";
  if (value.includes("env")) return "env";
  if (value.includes("missing")) return "missing";
  if (value.includes("not_configured")) return "not_configured";
  if (value.includes("configured")) return "configured";
  return "unknown";
}

function sourceIsConfigured(source: ProviderSource): boolean {
  return source === "local" || source === "env" || source === "configured";
}

function sourceStatusText(source: ProviderSource, configured: boolean): string {
  if (configured) return source === "unknown" ? "Configured" : `Configured (${source})`;
  if (source === "missing" || source === "not_configured") return "Not configured";
  return "Provider status unavailable — refresh or check Settings.";
}

function normalizeChannel(input: {
  sourceHints: unknown[];
  configuredHint?: unknown;
  maskedKeyHint?: unknown;
  messageHint?: unknown;
}): ChannelStatus {
  let source: ProviderSource = "unknown";
  for (const hint of input.sourceHints) {
    const next = toProviderSource(hint);
    if (next !== "unknown") {
      source = next;
      break;
    }
  }
  const configured = typeof input.configuredHint === "boolean"
    ? input.configuredHint
    : sourceIsConfigured(source);
  const maskedKey = typeof input.maskedKeyHint === "string" && input.maskedKeyHint.trim()
    ? input.maskedKeyHint
    : null;
  const message = typeof input.messageHint === "string" ? input.messageHint : undefined;
  return {
    source,
    configured,
    statusText: sourceStatusText(source, configured),
    maskedKey,
    message
  };
}

function normalizeSecretStatus(raw: unknown): SecretStatus {
  const root = toRecord(raw);
  const status = toRecord(root.status);
  const chat = toRecord(root.chat);
  const chatOpenAI = toRecord(root.chatOpenAI);
  const chatOpenRouter = toRecord(root.chatOpenRouter);
  const imageGen = toRecord(root.imageGen);
  const imageAnalyze = toRecord(root.imageAnalyze);
  return {
    chat: normalizeChannel({
      sourceHints: [chat.source, root.chatKeySource, status.chatApi, status.chat],
      configuredHint: chat.configured,
      maskedKeyHint: chat.maskedKey,
      messageHint: chat.message
    }),
    chatOpenAI: normalizeChannel({
      sourceHints: [chatOpenAI.source, chat.source, root.chatOpenAIKeySource, status.chatApi, status.chat],
      configuredHint: chatOpenAI.configured,
      maskedKeyHint: chatOpenAI.maskedKey,
      messageHint: chatOpenAI.message
    }),
    chatOpenRouter: normalizeChannel({
      sourceHints: [chatOpenRouter.source, root.chatOpenRouterKeySource, status.chatOpenRouter, status.chat],
      configuredHint: chatOpenRouter.configured,
      maskedKeyHint: chatOpenRouter.maskedKey,
      messageHint: chatOpenRouter.message
    }),
    imageGen: normalizeChannel({
      sourceHints: [imageGen.source, root.imageGenKeySource, status.imageApi, status.imageGen],
      configuredHint: imageGen.configured,
      maskedKeyHint: imageGen.maskedKey,
      messageHint: imageGen.message
    }),
    imageAnalyze: normalizeChannel({
      sourceHints: [imageAnalyze.source, root.imageAnalyzeKeySource, status.imageAnalyzeApi, status.imageAnalyze],
      configuredHint: imageAnalyze.configured,
      maskedKeyHint: imageAnalyze.maskedKey,
      messageHint: imageAnalyze.message
    })
  };
}

function normalizedProviderState(input: unknown): SBuildProviderStatus["status"] {
  const value = String(input || "").trim().toLowerCase();
  if (value === "configured") return "configured";
  if (value === "unconfigured" || value === "not_configured") return "unconfigured";
  if (value === "reachable" || value === "connected") return "reachable";
  if (value === "unreachable" || value === "error") return "unreachable";
  if (value === "untested" || value === "unknown") return "untested";
  return "untested";
}

function providerStateFromChannel(channel: ChannelStatus): SBuildProviderStatus["status"] {
  return channel.configured ? "configured" : (channel.source === "missing" || channel.source === "not_configured") ? "unconfigured" : "untested";
}

type NormalizedProviderStatus = {
  name: string;
  status: SBuildProviderStatus["status"];
  message: string;
};

function normalizeLocalModelOptions(models: Array<{ name: string }>): Array<{ name: string }> {
  const seen = new Set<string>();
  return models
    .map((model) => ({ name: String(model.name || "").trim() }))
    .filter((model) => model.name)
    .filter((model) => {
      if (seen.has(model.name)) return false;
      seen.add(model.name);
      return true;
    })
    .sort((a, b) => {
      if (a.name === "qwen2.5:1.5b") return -1;
      if (b.name === "qwen2.5:1.5b") return 1;
      return a.name.localeCompare(b.name);
    });
}

function upsertProviderStatus(list: NormalizedProviderStatus[], next: NormalizedProviderStatus): NormalizedProviderStatus[] {
  const index = list.findIndex((item) => item.name === next.name);
  if (index >= 0) {
    const copy = [...list];
    copy[index] = next;
    return copy;
  }
  return [...list, next];
}

function normalizeProviderStatus(raw: unknown, secrets: SecretStatus): NormalizedProviderStatus[] {
  const root = toRecord(raw);
  const channels = toRecord(root.channels);
  const chatChannel = toRecord(channels.chat);
  const chatSettings = toRecord(root.chatSettings);
  const rawProviders = Array.isArray(root.providers) ? root.providers : [];
  let providers = rawProviders
    .map((item) => toRecord(item))
    .filter((item) => typeof item.name === "string" && String(item.name).trim().length > 0)
    .map((item) => ({
      name: String(item.name),
      status: normalizedProviderState(item.status),
      message: typeof item.message === "string" && item.message.trim().length > 0
        ? item.message
        : "Provider status unavailable — refresh or check Settings."
    }));
  providers = upsertProviderStatus(providers, {
    name: "AI Chat Summary",
    status: typeof chatSettings.selectedProvider === "string" && chatSettings.selectedProvider.trim()
      ? "configured"
      : providerStateFromChannel(secrets.chat),
    message: typeof chatSettings.summary === "string" && chatSettings.summary.trim().length > 0
      ? chatSettings.summary
      : typeof chatChannel.message === "string" && chatChannel.message.trim().length > 0
        ? chatChannel.message
        : secrets.chat.statusText
  });
  providers = upsertProviderStatus(providers, {
    name: "Image Generation API",
    status: providerStateFromChannel(secrets.imageGen),
    message: secrets.imageGen.statusText
  });
  providers = upsertProviderStatus(providers, {
    name: "Image Analysis API",
    status: providerStateFromChannel(secrets.imageAnalyze),
    message: secrets.imageAnalyze.statusText
  });
  return providers;
}

const DEFAULT_SECRET_STATUS = normalizeSecretStatus({});

function formatProviderDisplayName(provider?: string | null): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "local") return "Local Ollama";
  return "API";
}

function formatChatEngineStatus(input: {
  engine?: string | null;
  mode?: string | null;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  timeoutMs?: number | null;
  reason?: string | null;
  fallbackUsed?: boolean;
  fallbackFrom?: string | null;
  fallbackReason?: string | null;
}): string {
  const {
    engine,
    mode,
    provider,
    model,
    latencyMs,
    timeoutMs,
    reason,
    fallbackUsed,
    fallbackFrom,
    fallbackReason
  } = input;
  const fallbackLabel = fallbackUsed && fallbackFrom
    ? ` after fallback from ${formatProviderDisplayName(fallbackFrom)}${fallbackReason ? ` (${fallbackReason})` : ""}`
    : "";
  if (engine === "sbuild-brain" && mode === "deterministic") {
    return `Answered by sBuild Brain context${reason ? ` (${reason})` : ""} · ${latencyMs ?? 0}ms`;
  }
  if (engine === "local-ollama" && mode === "llm") {
    return `Answered by Local Ollama ${model || "model"} · ${latencyMs ?? "?"}ms${fallbackLabel}`;
  }
  if (engine === "openai-api" && mode === "llm") {
    return `Answered by ${formatProviderDisplayName(provider)} ${model || "model"} · ${latencyMs ?? "?"}ms${fallbackLabel}`;
  }
  if (mode === "error" && reason === "llm-timeout") {
    return `Local model ${model || ""} timed out after ${((timeoutMs ?? 22000) / 1000).toFixed(0)}s`;
  }
  if (mode === "error" && reason) {
    return reason;
  }
  if (engine) {
    return `Last answer: ${engine} (${mode || "unknown"})`;
  }
  return "Engine status unavailable.";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${url}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    // Read the body exactly once and surface a useful server message when present.
    let message = `Request failed (${res.status})`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          message = parsed.error || parsed.message || text;
        } catch {
          message = text;
        }
      }
    } catch {
      /* ignore body read failures; fall back to status message */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function blockStyleToCss(block: Block): Record<string, string | number> {
  const s = block.styles || {};
  const container = s.parts?.container || {};
  const layout = s.layout || {};
  const css: Record<string, string | number> = {
    background: container.backgroundColor || s.backgroundColor || "var(--sbuild-block-bg)",
    backgroundImage: (container.backgroundImage || s.backgroundImage) ? `url(${container.backgroundImage || s.backgroundImage})` : "",
    backgroundSize: (container.backgroundFit || s.backgroundSize) === "contain" ? "contain" : (container.backgroundFit || s.backgroundSize) === "fill" ? "100% 100%" : (container.backgroundFit || s.backgroundSize) === "repeat" ? "auto" : "cover",
    backgroundRepeat: s.backgroundImage ? "no-repeat" : "",
    backgroundPosition: s.backgroundPosition || "center center",
    color: container.textColor || s.textColor || "var(--sbuild-text)",
    fontFamily: container.fontFamily || (s.fontFamily
      ? `'${s.fontFamily}', sans-serif`
      : (block.type === "hero" || block.type === "text" || block.type === "cards" ? "var(--sbuild-heading-font)" : "var(--sbuild-body-font)")),
    fontSize: container.fontSize ? `${container.fontSize}px` : s.fontSize ? `${s.fontSize}px` : "",
    fontWeight: container.fontWeight || s.fontWeight || "",
    textAlign: container.textAlign || s.textAlign || "left",
    padding: `${container.padding ?? s.padding ?? 16}px`,
    margin: `${container.margin ?? s.margin ?? 8}px 0`,
    borderRadius: `${container.borderRadius ?? s.borderRadius ?? 12}px`,
    boxShadow: container.shadow || s.shadow || "",
    border: container.borderWidth ? `${container.borderWidth}px solid ${container.borderColor || "var(--sbuild-border)"}` : "",
    opacity: container.opacity ?? 1,
    width: layout.widthPercent ? `${layout.widthPercent}%` : layout.widthMode === "full" ? "100%" : layout.widthMode === "wide" ? "75%" : layout.widthMode === "medium" ? "50%" : layout.widthMode === "narrow" ? "25%" : "100%",
    maxWidth: layout.maxWidthPx ? `${layout.maxWidthPx}px` : "",
    minHeight: layout.minHeightPx ? `${layout.minHeightPx}px` : "",
    height: layout.heightMode === "fixed" && layout.heightPx ? `${layout.heightPx}px` : "",
    alignSelf: layout.alignSelf === "center" ? "center" : layout.alignSelf === "right" ? "flex-end" : layout.alignSelf === "left" ? "flex-start" : "stretch",
    marginLeft: layout.alignSelf === "center" ? "auto" : layout.alignSelf === "right" ? "auto" : "",
    marginRight: layout.alignSelf === "center" ? "auto" : layout.alignSelf === "left" ? "auto" : ""
  };
  if (layout.aspectRatio && layout.aspectRatio !== "free") {
    css.aspectRatio = layout.aspectRatio.replace(":", "/");
  }
  if ((s.effects || []).includes("glow")) css.textShadow = "0 0 12px rgba(70, 130, 255, .5)";
  if ((s.effects || []).includes("gradient-text")) {
    css.background = "linear-gradient(90deg,#1f5fff,#34c48a)";
    css.WebkitBackgroundClip = "text";
    css.color = "transparent";
  }
  if ((s.effects || []).includes("pulse")) css.animation = "pulse 2.2s infinite";
  if ((s.effects || []).includes("hover-grow")) css.transition = "transform .2s ease";
  if ((s.effects || []).includes("parallax")) css.backgroundAttachment = "fixed";

  // Apply preset styles
  const bgPreset = BACKGROUND_STYLE_PRESETS[s.backgroundStyle || ""];
  if (bgPreset) Object.assign(css, bgPreset.css);
  const borderPreset = BORDER_STYLE_PRESETS[s.borderStyle || ""];
  if (borderPreset) {
    if (borderPreset.borderWidth > 0) {
      css.border = `${borderPreset.borderWidth}px ${borderPreset.borderStyle || "solid"} ${borderPreset.borderColor || "var(--sbuild-border)"}`;
    } else {
      css.border = "none";
    }
  }
  const shadowPreset = SHADOW_STYLE_PRESETS[s.shadowStyle || ""];
  if (shadowPreset) css.boxShadow = shadowPreset.shadow;
  const textPreset = TEXT_EFFECT_PRESETS[s.textEffect || ""];
  if (textPreset) Object.assign(css, textPreset.css);
  const btnPreset = BUTTON_STYLE_PRESETS[s.buttonStyle || ""];
  if (btnPreset) Object.assign(css, btnPreset.css);

  return css;
}

function resolveColorMode(value?: string): { mode: "theme" | "transparent" | "color"; raw?: string } {
  const v = (value || "").trim().toLowerCase();
  if (!v || v === "inherit") return { mode: "theme" };
  if (v === "transparent") return { mode: "transparent" };
  return { mode: "color", raw: value };
}

function partStyleToCss(part?: PartStyle, fallbackFont?: "heading" | "body"): Record<string, string | number> {
  if (!part) return fallbackFont ? { fontFamily: fallbackFont === "heading" ? "var(--sbuild-heading-font)" : "var(--sbuild-body-font)" } : {};
  const bg = resolveColorMode(part.backgroundColor);
  const color = resolveColorMode(part.textColor);
  const border = resolveColorMode(part.borderColor);
  const css: Record<string, string | number> = {
    background: bg.mode === "transparent" ? "transparent" : bg.mode === "theme" ? "" : (part.backgroundColor || ""),
    color: color.mode === "transparent" ? "transparent" : color.mode === "theme" ? "" : (part.textColor || ""),
    fontFamily: part.fontFamily ? `'${part.fontFamily}', sans-serif` : fallbackFont ? (fallbackFont === "heading" ? "var(--sbuild-heading-font)" : "var(--sbuild-body-font)") : "",
    fontSize: part.fontSize ? `${part.fontSize}px` : "",
    fontWeight: part.fontWeight || "",
    textAlign: part.textAlign || "",
    padding: part.padding !== undefined ? `${part.padding}px` : "",
    margin: part.margin !== undefined ? `${part.margin}px 0` : "",
    borderRadius: part.borderRadius !== undefined ? `${part.borderRadius}px` : "",
    boxShadow: part.shadow || "",
    opacity: part.opacity ?? 1,
    backgroundImage: part.backgroundImage ? `url(${part.backgroundImage})` : "",
    backgroundSize: part.backgroundFit === "contain" ? "contain" : part.backgroundFit === "fill" ? "100% 100%" : part.backgroundFit === "repeat" ? "auto" : "cover",
    backgroundRepeat: part.backgroundFit === "repeat" ? "repeat" : "no-repeat"
  };
  if (part.borderWidth) {
    css.border = `${part.borderWidth}px ${part.borderStyle || "solid"} ${border.mode === "transparent" ? "transparent" : border.mode === "theme" ? "var(--sbuild-border)" : (part.borderColor || "var(--sbuild-border)")}`;
  }

  // Apply preset styles
  const bgPreset = BACKGROUND_STYLE_PRESETS[part.backgroundStyle || ""];
  if (bgPreset) Object.assign(css, bgPreset.css);
  const borderPreset = BORDER_STYLE_PRESETS[part.borderStyle || ""];
  if (borderPreset) {
    if (borderPreset.borderWidth > 0) {
      css.border = `${borderPreset.borderWidth}px ${borderPreset.borderStyle || "solid"} ${borderPreset.borderColor || "var(--sbuild-border)"}`;
    } else {
      css.border = "none";
    }
  }
  const shadowPreset = SHADOW_STYLE_PRESETS[part.shadowStyle || ""];
  if (shadowPreset) css.boxShadow = shadowPreset.shadow;
  const textPreset = TEXT_EFFECT_PRESETS[part.textEffect || ""];
  if (textPreset) Object.assign(css, textPreset.css);
  const btnPreset = BUTTON_STYLE_PRESETS[part.buttonStyle || ""];
  if (btnPreset) Object.assign(css, btnPreset.css);

  return css;
}

function defaultBlock(type: BlockType): Block {
  const base = { id: `${type}-${Math.random().toString(36).slice(2, 8)}`, type, styles: { padding: 16 } };
  switch (type) {
    case "hero": return { ...base, data: { heading: "New Hero", subheading: "Tell your story", ctaLabel: "Learn More", ctaHref: "#" } };
    case "text": return { ...base, data: { title: "New Section", body: "Add your text here." } };
    case "image": return { ...base, data: { src: "", alt: "Image", caption: "" } };
    case "cards": return { ...base, data: { title: "Cards", cards: [{ id: "c1", title: "Card 1", body: "Description" }, { id: "c2", title: "Card 2", body: "Description" }] } };
    case "hours": return { ...base, data: { title: "Hours", rows: [{ day: "Mon", open: "9:00", close: "17:00" }] } };
    case "gallery": return { ...base, data: { title: "Gallery", images: [{ id: "g1", src: "", alt: "Image" }] } };
    case "contact": return { ...base, data: { title: "Contact", phone: "", email: "", address: "" } };
    case "testimonial": return { ...base, data: { quote: "Great service!", author: "Happy Customer" } };
    case "map": return { ...base, data: { address: "Address", embedUrl: "" } };
    case "marquee": return { ...base, data: { text: "Scrolling highlight text" } };
    case "spacer": return { ...base, data: { height: 36 } };
    case "divider": return { ...base, data: { style: "solid" as DividerStyle, thickness: 2, color: "#ccc", widthPercent: 100, alignment: "center", marginTop: 16, marginBottom: 16 } };
    case "html": return { ...base, data: { html: "<p>Custom HTML</p>" } };
    default: return { ...base, data: { body: "Unknown block" } as TextBlockData };
  }
}

function updateBlock(blocks: Block[], id: string, updater: (b: Block) => Block): Block[] {
  return blocks.map((b) => (b.id === id ? updater(b) : b));
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function blockTypeForTarget(block?: Block): ImageTargetContext["blockType"] {
  if (!block) return "unknown";
  if (block.type === "hero") return "hero";
  if (block.type === "image") return "image";
  if (block.type === "gallery") return "gallery";
  if (block.type === "cards") return "card";
  if (block.type === "testimonial") return "testimonial";
  return "unknown";
}

function usageForTarget(block?: Block): ImageTargetContext["usage"] {
  if (!block) return "custom";
  if (block.type === "hero") return "heroBackground";
  if (block.type === "image") return "inlineImage";
  if (block.type === "gallery") return "galleryItem";
  if (block.type === "cards") return "cardImage";
  return "custom";
}

function inferAspectRatioHint(block?: Block): string | undefined {
  if (!block) return undefined;
  if (block.type === "hero") return "16:9";
  if (block.type === "cards") return "1:1";
  if (block.type === "gallery") return "1:1";
  return undefined;
}

function withSavedStatusText(status: string, dirty: boolean): string {
  if (dirty) return "Unsaved changes";
  if (status.toLowerCase().includes("saved")) return "Saved";
  return "Idle";
}

type EditableTextTag = "h1" | "h2" | "h3" | "p" | "div" | "strong" | "span" | "cite" | "blockquote" | "li";
type EditableTextProps = {
  tag: EditableTextTag;
  value: string;
  editable?: boolean;
  style?: CSSProperties;
  className?: string;
  onText: (value: string) => void;
  onActivateTarget?: () => void;
  onClick?: MouseEventHandler<HTMLElement>;
  onPointerDown?: MouseEventHandler<HTMLElement>;
  onPointerUp?: MouseEventHandler<HTMLElement>;
  onPointerMove?: MouseEventHandler<HTMLElement>;
};

const EditableText = ({ tag, value, editable = true, style, className, onText, onActivateTarget, onClick, onPointerDown, onPointerUp, onPointerMove }: EditableTextProps) => {
  const elRef = useRef<HTMLElement | null>(null);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);
  const Component = tag;

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !shouldSyncEditableTextContent(focusedRef.current, composingRef.current)) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  function commitText(el: HTMLElement) {
    onText(el.textContent || "");
  }

  return (
    <Component
      ref={(node: HTMLElement | null) => { elRef.current = node; }}
      className={className}
      style={style}
      contentEditable={editable}
      suppressContentEditableWarning
      data-sbuild-editable-text="uncontrolled"
      onFocus={() => { focusedRef.current = true; }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(e) => { composingRef.current = false; commitText(e.currentTarget); }}
      onInput={(e) => { if (!composingRef.current) commitText(e.currentTarget); }}
      onBlur={(e) => {
        focusedRef.current = false;
        commitText(e.currentTarget);
      }}
      onClick={onClick}
      onPointerDown={(e) => {
        if (onActivateTarget) {
          onActivateTarget();
          e.stopPropagation();
        }
        if (onPointerDown) onPointerDown(e);
      }}
      onPointerUp={(e) => {
        if (onActivateTarget) {
          e.stopPropagation();
        }
        if (onPointerUp) onPointerUp(e);
      }}
      onPointerMove={onPointerMove}
    />
  );
};

const HeroBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as HeroBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="h1" value={data.heading} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("heading", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <EditableText tag="p" value={data.subheading ?? ""} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("subheading", value)} onActivateTarget={() => onActivateTarget?.("body")} />
      <button className="cta-btn" style={partStyleToCss(parts?.button, "body")}>{data.ctaLabel || "Call to Action"}</button>
    </section>
  );
};

const TextBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as TextBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="h2" value={data.title ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("title", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <EditableText tag="p" value={data.body} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("body", value)} onActivateTarget={() => onActivateTarget?.("body")} />
    </section>
  );
};

const ImageBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as ImageBlockData;
  const fit = block.styles?.backgroundSize || "cover";
  const parts = block.styles?.parts;
  return (
    <section>
      {data.src ? <img src={data.src} alt={data.alt} className="block-image" style={{ objectFit: fit, ...partStyleToCss(parts?.image) }} /> : <div className="image-placeholder" style={partStyleToCss(parts?.image)}>Image Placeholder</div>}
      <EditableText tag="p" value={data.caption ?? ""} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("caption", value)} onActivateTarget={() => onActivateTarget?.("body")} />
    </section>
  );
};

const CardsBlock = ({ block, onText, onCardText, isPreview, onActivateTarget }: { block: Block; onText?: (field: string, value: string) => void; onCardText?: (cardIndex: number, field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as CardsBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="h2" value={data.title ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText?.("title", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <div className="cards-grid">
        {data.cards.map((card, i) => (
          <article key={card.id} style={partStyleToCss(parts?.card, "body")}>
            <EditableText tag="h3" value={card.title} style={partStyleToCss(parts?.cardHeading, "heading")} editable={!isPreview} onText={(value) => onCardText?.(i, "title", value)} onActivateTarget={() => onActivateTarget?.("cardHeading")} />
            <EditableText tag="p" value={card.body} style={partStyleToCss(parts?.cardBody, "body")} editable={!isPreview} onText={(value) => onCardText?.(i, "body", value)} onActivateTarget={() => onActivateTarget?.("cardBody")} />
          </article>
        ))}
      </div>
    </section>
  );
};

const HoursBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as HoursBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="h2" value={data.title ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("title", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <ul>
        {data.rows.map((row, i) => (
          <EditableText key={`${row.day}-${i}`} tag="li" value={`${row.day}: ${row.open} - ${row.close}`} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(text) => onText(`rows.${i}.day`, text.split(":")[0]?.trim() || "")} onActivateTarget={() => onActivateTarget?.("body")} />
        ))}
      </ul>
    </section>
  );
};

const GalleryBlock = ({ block, selectedIndex, onImageSelect, isMobileViewport, onSlotLongPress, isPreview, onText, onActivateTarget }: { block: Block; selectedIndex?: number | null; onImageSelect?: (index: number) => void; isMobileViewport?: boolean; onSlotLongPress?: (index: number) => void; isPreview?: boolean; onText?: (field: string, value: string) => void; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as GalleryBlockData;
  const fit = block.styles?.backgroundSize || "cover";
  const parts = block.styles?.parts;
  const slotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotFiredRef = useRef(false);
  function startSlotLongPress(index: number) {
    slotFiredRef.current = false;
    slotTimerRef.current = setTimeout(() => {
      slotFiredRef.current = true;
      slotTimerRef.current = null;
      onSlotLongPress?.(index);
    }, 500);
  }
  function cancelSlotLongPress() {
    if (slotTimerRef.current) {
      clearTimeout(slotTimerRef.current);
      slotTimerRef.current = null;
    }
  }
  return (
    <section>
      <EditableText tag="h2" value={data.title ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText?.("title", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <div className="gallery-grid">
        {data.images.map((img, i) => (
          <figure
            key={img.id}
            className={`gallery-slot ${selectedIndex === i ? "selected-gallery-slot" : ""}`}
            style={partStyleToCss(parts?.card)}
            tabIndex={onImageSelect ? 0 : undefined}
            role={onImageSelect ? "button" : undefined}
            aria-label={`Select Gallery image ${i + 1}`}
            onClick={(e) => { if (isPreview) return; if (onImageSelect) { e.stopPropagation(); onImageSelect(i); } }}
            onPointerDown={(e) => {
              if (isPreview) return;
              if (isMobileViewport && onSlotLongPress) {
                e.stopPropagation();
                startSlotLongPress(i);
              }
            }}
            onPointerUp={(e) => {
              if (isPreview) return;
              if (isMobileViewport && onSlotLongPress) {
                e.stopPropagation();
                cancelSlotLongPress();
                if (slotFiredRef.current) {
                  slotFiredRef.current = false;
                  return;
                }
              }
              if (onImageSelect) { onImageSelect(i); }
            }}
            onPointerMove={(e) => {
              if (slotTimerRef.current) {
                cancelSlotLongPress();
              }
            }}
            onKeyDown={(e) => { if (onImageSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onImageSelect(i); } }}
          >
            {selectedIndex === i && <span className="gallery-slot-badge">Image {i + 1}</span>}
            {img.src ? <img src={img.src} alt={img.alt} className="block-image" style={{ objectFit: fit, ...partStyleToCss(parts?.image) }} /> : <div className="image-placeholder" style={partStyleToCss(parts?.image)}>Gallery Image</div>}
          </figure>
        ))}
      </div>
    </section>
  );
};

const ContactBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as ContactBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="h2" value={data.title ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("title", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
      <EditableText tag="p" value={data.phone ?? ""} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("phone", value)} onActivateTarget={() => onActivateTarget?.("body")} />
      <EditableText tag="p" value={data.email ?? ""} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("email", value)} onActivateTarget={() => onActivateTarget?.("body")} />
      <EditableText tag="p" value={data.address ?? ""} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("address", value)} onActivateTarget={() => onActivateTarget?.("body")} />
    </section>
  );
};

const TestimonialBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as TestimonialBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <EditableText tag="blockquote" value={`"${data.quote ?? ""}"`} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("quote", value)} onActivateTarget={() => onActivateTarget?.("body")} />
      <EditableText tag="cite" value={data.author ?? ""} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("author", value)} onActivateTarget={() => onActivateTarget?.("heading")} />
    </section>
  );
};

const MapBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as MapBlockData;
  const parts = block.styles?.parts;
  return <section><EditableText tag="h2" value={data.address || "Map placeholder"} style={partStyleToCss(parts?.heading, "heading")} editable={!isPreview} onText={(value) => onText("address", value)} onActivateTarget={() => onActivateTarget?.("heading")} /></section>;
};

const MarqueeBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as MarqueeBlockData;
  const parts = block.styles?.parts;
  return <section className="marquee" style={partStyleToCss(parts?.container)}><EditableText tag="div" value={data.text} style={partStyleToCss(parts?.body, "body")} editable={!isPreview} onText={(value) => onText("text", value)} onActivateTarget={() => onActivateTarget?.("body")} /></section>;
};

const SpacerBlock = ({ block }: { block: Block }) => {
  const data = block.data as SpacerBlockData;
  return <section style={{ height: data.height }} />;
};

const DividerBlock = ({ block }: { block: Block }) => {
  const data = block.data as DividerBlockData;
  const thickness = data.thickness ?? 2;
  const color = data.color || "#cccccc";
  const width = data.widthPercent ?? 100;
  const align = data.alignment || "center";
  const mt = data.marginTop ?? 16;
  const mb = data.marginBottom ?? 16;
  const label = data.label || "";
  const glow = data.glowIntensity ?? 8;

  const alignStyle: React.CSSProperties = {
    marginTop: mt,
    marginBottom: mb,
    marginLeft: align === "center" ? "auto" : align === "right" ? "auto" : 0,
    marginRight: align === "center" ? "auto" : align === "left" ? "auto" : 0,
    width: `${width}%`
  };

  if (data.style === "zigzag") {
    const h = Math.max(thickness * 3, 8);
    const step = 10;
    let pts = "";
    for (let x = 0; x <= 100; x += step) {
      const y = (x / step) % 2 === 0 ? 0 : h;
      pts += `${x},${y} `;
    }
    return (
      <div style={alignStyle}>
        {label && <span style={{ fontSize: 12, color }}>{label}</span>}
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={thickness} />
        </svg>
      </div>
    );
  }

  if (data.style === "wave") {
    const h = Math.max(thickness * 4, 12);
    return (
      <div style={alignStyle}>
        {label && <span style={{ fontSize: 12, color }}>{label}</span>}
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
          <path d={`M0,${h / 2} Q25,0 50,${h / 2} T100,${h / 2}`} fill="none" stroke={color} strokeWidth={thickness} />
        </svg>
      </div>
    );
  }

  if (data.style === "spacer-line") {
    return (
      <div style={{ ...alignStyle, height: Math.max(thickness * 4, 24), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", height: thickness, background: color, borderRadius: thickness }} />
      </div>
    );
  }

  const hrStyle: React.CSSProperties = {
    border: "none",
    height: data.style === "double" ? thickness * 3 : thickness,
    marginTop: mt,
    marginBottom: mb,
    marginLeft: align === "center" ? "auto" : align === "right" ? "auto" : 0,
    marginRight: align === "center" ? "auto" : align === "left" ? "auto" : 0,
    width: `${width}%`
  };

  if (data.style === "solid") hrStyle.background = color;
  if (data.style === "dashed") { hrStyle.background = "transparent"; hrStyle.borderTop = `${thickness}px dashed ${color}`; hrStyle.height = 0; }
  if (data.style === "dotted") { hrStyle.background = "transparent"; hrStyle.borderTop = `${thickness}px dotted ${color}`; hrStyle.height = 0; }
  if (data.style === "double") { hrStyle.background = "transparent"; hrStyle.borderTop = `${thickness}px double ${color}`; hrStyle.borderBottom = `${thickness}px double ${color}`; }
  if (data.style === "gradient") hrStyle.background = `linear-gradient(90deg, transparent, ${color}, transparent)`;
  if (data.style === "glow") { hrStyle.background = color; hrStyle.boxShadow = `0 0 ${glow}px ${color}`; }

  return (
    <div style={alignStyle}>
      {label && <div style={{ textAlign: "center", fontSize: 12, color, marginBottom: 4 }}>{label}</div>}
      <hr style={hrStyle} />
    </div>
  );
};

const HtmlBlock = ({ block }: { block: Block }) => {
  const data = block.data as HtmlBlockData;
  return <section dangerouslySetInnerHTML={{ __html: data.html }} />;
};

function renderTypedBlock(block: Block, onText: (field: string, value: string) => void, onImageSelect?: (index: number) => void, selectedGalleryIndex?: number | null, isMobileViewport?: boolean, onSlotLongPress?: (index: number) => void, isPreview?: boolean, onCardText?: (cardIndex: number, field: string, value: string) => void, onActivateTarget?: (part?: string) => void): JSX.Element {
  switch (block.type) {
    case "hero": return <HeroBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "text": return <TextBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "image": return <ImageBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "cards": return <CardsBlock block={block} onText={onText} onCardText={onCardText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "hours": return <HoursBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "gallery": return <GalleryBlock block={block} selectedIndex={selectedGalleryIndex} onImageSelect={onImageSelect} isMobileViewport={isMobileViewport} onSlotLongPress={onSlotLongPress} isPreview={isPreview} onText={onText} onActivateTarget={onActivateTarget} />;
    case "contact": return <ContactBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "testimonial": return <TestimonialBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "map": return <MapBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "marquee": return <MarqueeBlock block={block} onText={onText} isPreview={isPreview} onActivateTarget={onActivateTarget} />;
    case "spacer": return <SpacerBlock block={block} />;
    case "divider": return <DividerBlock block={block} />;
    case "html": return <HtmlBlock block={block} />;
    default: return <div>Unknown block</div>;
  }
}

function HelpGuide({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "quick-start": true,
  });
  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  const sections = [
    {
      id: "quick-start",
      title: "Quick Start",
      content: (
        <div>
          <p>Pick a page from the <strong>left panel</strong>, then click a block to edit it. Use the <strong>right panel</strong> for Properties, Style, Resize, Images, AI, and Debug.</p>
          <p>Click <strong>Save</strong> when done. Use <strong>Preview</strong> to see the site without editing controls.</p>
        </div>
      ),
    },
    {
      id: "modes",
      title: "Modes",
      content: (
        <div>
          <p><strong>Edit:</strong> Normal site editing.</p>
          <p><strong>Preview:</strong> Read-only view with links and navigation active.</p>
          <p><strong>Markup:</strong> Draw notes for AI only; markup is not published to the website.</p>
          <p><strong>Build:</strong> Local generation/build action.</p>
          <p><strong>Publish:</strong> Currently protected / dry-run only.</p>
        </div>
      ),
    },
    {
      id: "pages",
      title: "Pages / Website Manager",
      content: (
        <div>
          <p>Use <strong>+ New Page</strong> in the left panel to create a page. Use <strong>Website Manager</strong> to open, rename, change slug, show/hide from navigation, set parent, duplicate, or delete pages.</p>
          <p>Parent pages organize content into groups. If a page has a parent, it still appears in the flat navigation bar for now. Hiding a page from nav removes it from the navigation bar without deleting it.</p>
        </div>
      ),
    },
    {
      id: "blocks",
      title: "Blocks",
      content: (
        <div>
          <p>Add blocks from the left panel under <strong>Add Block</strong>. Common block types: hero, text, image, cards, hours, gallery, contact, testimonial, map, marquee, spacer, divider, html.</p>
          <p>Use <strong>Duplicate</strong>, <strong>Delete</strong>, <strong>Up</strong>, and <strong>Down</strong> buttons above the canvas to organize blocks.</p>
        </div>
      ),
    },
    {
      id: "styling",
      title: "Styling",
      content: (
        <div>
          <p><strong>Website Theme</strong> (in the left panel) affects the website preview and content only.</p>
          <p><strong>Builder UI Theme</strong> (in Settings &rarr; General) affects only the editor chrome &mdash; topbar, panels, buttons.</p>
          <p><strong>Selected block styles</strong> override theme defaults for individual blocks.</p>
          <p><strong>Reset selected block colors</strong> resets one block. <strong>Reset blocks to this theme</strong> resets all blocks on the current page/site.</p>
        </div>
      ),
    },
    {
      id: "images",
      title: "Images",
      content: (
        <div>
          <p>Use the <strong>Images</strong> button or <strong>Image Library</strong> to upload images. Use the right panel <strong>Images</strong> tab to change the selected image or background.</p>
          <p>Crop, fit, enhance, and black &amp; white options are available under the Images tab when an image or background is selected.</p>
        </div>
      ),
    },
    {
      id: "ai-markup",
      title: "AI / Markup",
      content: (
        <div>
          <p>Use <strong>Markup</strong> to circle or point at areas before asking AI for changes. Markup is a note layer only &mdash; it is not published to the website.</p>
          <p><strong>Attach to AI</strong> (currently disabled) will let you attach markup to an AI request when available.</p>
          <p>AI will not publish or save anything without your confirmation.</p>
        </div>
      ),
    },
    {
      id: "accounts",
      title: "Accounts",
      content: (
        <div>
          <p><strong>Account Management</strong> (in Settings) lets the current user change their password.</p>
          <p><strong>Admin users</strong> see a <strong>User Management</strong> tab in Settings where they can create, reset passwords for, and manage other users.</p>
          <p><strong>Regular users</strong> do not see User Management. The <strong>Image/API Keys</strong> tab is also admin-only.</p>
        </div>
      ),
    },
    {
      id: "save-revert",
      title: "Save / Revert / Safety",
      content: (
        <div>
          <p><strong>Save</strong> writes changes to the project. <strong>Revert</strong> returns to the last saved state.</p>
          <p><strong>Publish</strong> is intentionally disabled / dry-run until accepted.</p>
          <p>If something looks wrong, check <strong>Settings &rarr; About</strong> for server health, build info, and commit info.</p>
        </div>
      ),
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      content: (
        <div>
          <p><strong>Refresh</strong> the page if the UI seems stale.</p>
          <p>Check <strong>Settings &rarr; About</strong> for server health and build/commit details.</p>
          <p>Use <strong>Copy diagnostics</strong> in Settings &rarr; About when reporting a bug.</p>
          <p>Report what page, block, mode, browser, and device you were using.</p>
        </div>
      ),
    },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>sBuild Help / User Guide</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close Help">✕</button>
        </div>
        <div className="help-guide-content">
          {sections.map((s) => (
            <div key={s.id} className="help-section">
              <button className="help-section-toggle" onClick={() => toggle(s.id)}>
                <span className="help-toggle-icon">{expanded[s.id] ? "▾" : "▸"}</span>
                {s.title}
              </button>
              {expanded[s.id] && <div className="help-section-content">{s.content}</div>}
            </div>
          ))}
        </div>
        <div className="button-row" style={{ marginTop: 12 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [project, setProject] = useState<SBuildProject | null>(null);
  const projectRef = useRef<SBuildProject | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [previewMode, setPreviewMode] = useState(false);
  const [paintMode, setPaintMode] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("properties");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Loading project...");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [fonts, setFonts] = useState<Array<{ family: string }>>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardForm, setWizardForm] = useState({ name: "", businessType: "", description: "", theme: "" });
  const [lastAction, setLastAction] = useState("none");
  const [imagePrompt, setImagePrompt] = useState("");
  const [providerSizeOverride, setProviderSizeOverride] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string>("");
  const [imageSizeDecision, setImageSizeDecision] = useState<ImageSizeDecision | null>(null);
  const [uploadedImages, setUploadedImages] = useState<ImageMeta[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedUploadImage, setSelectedUploadImage] = useState("");
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [photoEditType, setPhotoEditType] = useState("enhance");
  const [photoEditInstruction, setPhotoEditInstruction] = useState("");
  const [photoEditStatus, setPhotoEditStatus] = useState("");
  const [lastEditedImage, setLastEditedImage] = useState("");
  const [paintDraftStrokes, setPaintDraftStrokes] = useState<PaintStroke[]>([]);
  const [paintAppliedStrokes, setPaintAppliedStrokes] = useState<PaintStroke[]>([]);
  const [paintRedoStrokes, setPaintRedoStrokes] = useState<PaintStroke[]>([]);
  const [paintActivePoints, setPaintActivePoints] = useState<PaintPoint[]>([]);
  const [paintTool, setPaintTool] = useState<PaintTool>("brush");
  const [paintDrawMode, setPaintDrawMode] = useState<PaintDrawMode>("free");
  const [paintColor, setPaintColor] = useState("#2b6dff");
  const [paintSize, setPaintSize] = useState(4);
  const [drag, setDrag] = useState<DragState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean; startX: number; startY: number }>({ timer: null, fired: false, startX: 0, startY: 0 });
  const siteHeaderLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean; startX: number; startY: number }>({ timer: null, fired: false, startX: 0, startY: 0 });
  const [themeApplied, setThemeApplied] = useState("");
  const [providerStatus, setProviderStatus] = useState<SBuildProviderStatus[]>([]);
  const [secretInputs, setSecretInputs] = useState({ imageGenApiKey: "", imageAnalyzeApiKey: "", openaiChatApiKey: "", openrouterChatApiKey: "" });
  const [secretStatusMsg, setSecretStatusMsg] = useState("");
  const [resizeStatus, setResizeStatus] = useState("");
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>("fields");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [helpOpen, setHelpOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctCurrentPw, setAcctCurrentPw] = useState("");
  const [acctNewPw, setAcctNewPw] = useState("");
  const [acctConfirmPw, setAcctConfirmPw] = useState("");
  const [acctMsg, setAcctMsg] = useState("");
  const [acctMsgOk, setAcctMsgOk] = useState(false);
  const [userList, setUserList] = useState<Array<{ id: string; username: string; role: string; createdAt: string; disabled?: boolean }>>([]);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const [createMsgOk, setCreateMsgOk] = useState(false);
  const [resetPwUserId, setResetPwUserId] = useState("");
  const [resetPwValue, setResetPwValue] = useState("");
  const [resetPwMsg, setResetPwMsg] = useState("");
  const [resetPwMsgOk, setResetPwMsgOk] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem("sbuild_left_collapsed") === "1");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [markupControlsCollapsed, setMarkupControlsCollapsed] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [markupStageRightInset, setMarkupStageRightInset] = useState(0);
  const [prePreviewLeftCollapsed, setPrePreviewLeftCollapsed] = useState(false);
  const [prePreviewRightCollapsed, setPrePreviewRightCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [rightDrawerMobileOpen, setRightDrawerMobileOpen] = useState(false);
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem("sbuild_editor_theme") || "Light");
  const [builderThemePrefsReady, setBuilderThemePrefsReady] = useState(false);
  const [builderThemeSaveStatus, setBuilderThemeSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [builderThemeSavedAt, setBuilderThemeSavedAt] = useState<string>("");

  async function saveBuilderTheme(): Promise<void> {
    setBuilderThemeSaveStatus("saving");
    try {
      localStorage.setItem("sbuild_editor_theme", editorTheme);
      const res = await fetchJson<{ ok: boolean; preferences?: { updatedAt?: string } }>("/api/account/preferences", {
        method: "PUT",
        body: JSON.stringify({ builderUiTheme: editorTheme })
      });
      if (res?.ok) {
        setBuilderThemeSaveStatus("saved");
        setBuilderThemeSavedAt(res.preferences?.updatedAt || new Date().toISOString());
      } else {
        setBuilderThemeSaveStatus("error");
      }
    } catch {
      setBuilderThemeSaveStatus("error");
    }
  }

  useEffect(() => {
    localStorage.setItem("sbuild_editor_theme", editorTheme);
    if (!builderThemePrefsReady) return;
    void fetchJson("/api/account/preferences", {
      method: "PUT",
      body: JSON.stringify({ builderUiTheme: editorTheme })
    }).catch(() => {
      // ignore preference sync errors; localStorage remains fallback
    });
  }, [editorTheme, builderThemePrefsReady]);

  useEffect(() => {
    if (previewMode) {
      setPrePreviewLeftCollapsed(leftCollapsed);
      setPrePreviewRightCollapsed(rightCollapsed);
      setSelectedBlockId("");
      setSelectedGalleryIndex(null);
      setSelectedSitePart(null);
      setSelectedNavIndex(null);
      setRightDrawerMobileOpen(false);
      setContextMenu(null);
      setLeftCollapsed(true);
      setRightCollapsed(true);
      setPaintMode(false);
      setPaintActivePoints([]);
      setAiTopMenuOpen(false);
      lastFocusedTextBlockId.current = "";
    } else {
      setLeftCollapsed(prePreviewLeftCollapsed);
      setRightCollapsed(prePreviewRightCollapsed);
    }
  }, [previewMode]);

  const isPreview = previewMode;
  const paintExclusiveMode = paintMode && !previewMode;
  const canEditBlocks = !previewMode && !paintMode;

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const [selectedSitePart, setSelectedSitePart] = useState<string | null>(null);
  const [selectedNavIndex, setSelectedNavIndex] = useState<number | null>(null);
  const [layoutHighlight, setLayoutHighlight] = useState(false);
  const [secretStatus, setSecretStatus] = useState<SecretStatus>(DEFAULT_SECRET_STATUS);
  const [providerCheckMessage, setProviderCheckMessage] = useState("");
  const [opencodeAuth, setOpencodeAuth] = useState<{ status: string; message: string; commands: string[]; output?: string } | null>(null);
  const [aiTopMenuOpen, setAiTopMenuOpen] = useState(false);
  const [aiTopMenuTab, setAiTopMenuTab] = useState<AiTopMenuTab>("chat");
  const [aiPanelRect, setAiPanelRect] = useState<AiPanelRect>(() => loadAiPanelRect());
  const [aiPanelDrag, setAiPanelDrag] = useState<AiPanelDragState>(null);
  const [aiPanelResize, setAiPanelResize] = useState<AiPanelResizeState>(null);
  const [aiChatTarget, setAiChatTarget] = useState<AiChatTarget>("block");
  const [lastBrainSource, setLastBrainSource] = useState<string>("");
  const [lastBrainScope, setLastBrainScope] = useState<string>("");
  const [lastEngine, setLastEngine] = useState<string>("");
  const [lastEngineMode, setLastEngineMode] = useState<string>("");
  const [lastEngineReason, setLastEngineReason] = useState<string>("");
  const [lastEngineModel, setLastEngineModel] = useState<string>("");
  const [lastEngineLatencyMs, setLastEngineLatencyMs] = useState<number | null>(null);
  const [lastEngineTimeoutMs, setLastEngineTimeoutMs] = useState<number | null>(null);
  const [lastEngineProvider, setLastEngineProvider] = useState<string>("");
  const [lastFallbackUsed, setLastFallbackUsed] = useState<boolean>(false);
  const [lastFallbackFrom, setLastFallbackFrom] = useState<string>("");
  const [lastFallbackReason, setLastFallbackReason] = useState<string>("");
  const [chatClearedAt, setChatClearedAt] = useState<number | null>(null);
  const [lastDeterministic, setLastDeterministic] = useState<boolean>(false);
  const [aiProposal, setAiProposal] = useState("");
  const [aiStructuredProposal, setAiStructuredProposal] = useState<StructuredSuggestionProposal | null>(null);
  const [aiProposalBlockId, setAiProposalBlockId] = useState("");
  const [aiProposalBlockType, setAiProposalBlockType] = useState("");
  const [aiProposalPending, setAiProposalPending] = useState(false);
  const [aiHasProposal, setAiHasProposal] = useState(false);
  const [aiUndoSnapshot, setAiUndoSnapshot] = useState<{ pageId: string; blocks: Block[] } | null>(null);
  const [aiImgGenPrompt, setAiImgGenPrompt] = useState("");
  const [aiImgGenTarget, setAiImgGenTarget] = useState<"block" | "library">("library");
  const [aiImgGenStatus, setAiImgGenStatus] = useState("");
  const [aiImgGenResult, setAiImgGenResult] = useState("");
  const [aiImgGenPreviewId, setAiImgGenPreviewId] = useState<string>("");
  const [aiImgGenIsPreview, setAiImgGenIsPreview] = useState<boolean>(true);
  const [aiEnhanceType, setAiEnhanceType] = useState("enhance");
  const [aiEnhancePrompt, setAiEnhancePrompt] = useState("");
  const [aiEnhanceSourceOverride, setAiEnhanceSourceOverride] = useState<string | null>(null);
  const [aiEnhanceSourceLabel, setAiEnhanceSourceLabel] = useState<string>("");
  const [imageEditModalOpen, setImageEditModalOpen] = useState(false);
  const [imageEditModalTab, setImageEditModalTab] = useState<"options" | "preview" | "history">("options");
  const [imageEditSnapshot, setImageEditSnapshot] = useState<{ src: string; label: string; openedAt: number } | null>(null);
  const [imageEditApplied, setImageEditApplied] = useState(false);
  const [imageEditCustomInstruction, setImageEditCustomInstruction] = useState("");
  const [chatProviderMode, setChatProviderMode] = useState("auto");
  const [chatLocalModel, setChatLocalModel] = useState("");
  const [chatOpenAIModel, setChatOpenAIModel] = useState("gpt-4o-mini");
  const [chatOpenRouterModel, setChatOpenRouterModel] = useState("openai/gpt-4o-mini");
  const [chatFallbackEnabled, setChatFallbackEnabled] = useState(true);
  const [chatFallbackTimeoutSec, setChatFallbackTimeoutSec] = useState(12);
  const [chatOpenAIKeyInput, setChatOpenAIKeyInput] = useState("");
  const [chatOpenRouterKeyInput, setChatOpenRouterKeyInput] = useState("");
  const [localModels, setLocalModels] = useState<Array<{ name: string }>>([]);
  const [imageGenStyle, setImageGenStyle] = useState<string>("custom");
  const [imageGenSize, setImageGenSize] = useState<string>("fit-block");
  const [imageGenPlacement, setImageGenPlacement] = useState<string>("preview-only");
  const [imageLibraryFilter, setImageLibraryFilter] = useState<ImageLibraryFilter>("all");
  const [imageTileFit, setImageTileFit] = useState<ImageTileFit>("cover");
  const [imageDiagnostics, setImageDiagnostics] = useState<Record<string, ImageDiagnostics>>({});
  const [providerConfigSaved, setProviderConfigSaved] = useState(false);
  const [aiEnhanceStatus, setAiEnhanceStatus] = useState("");
  const [imageLibraryTab, setImageLibraryTab] = useState<"browse" | "upload" | "settings">("browse");
  const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());
  const [imageActionPanelOpen, setImageActionPanelOpen] = useState(false);
  const [imageActionTab, setImageActionTab] = useState<"actions" | "details" | "history">("actions");
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkDeleteMessage, setBulkDeleteMessage] = useState("");
  const [aiEnhanceResult, setAiEnhanceResult] = useState("");
  const [buildInfo, setBuildInfo] = useState<SBuildBuildInfo | null>(null);
  const [buildInfoStatus, setBuildInfoStatus] = useState<BuildInfoStatus>("loading");
  const [buildInfoError, setBuildInfoError] = useState("");
  const [versionBannerDismissed, setVersionBannerDismissed] = useState(false);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState>(null);
  const [selectedThemeName, setSelectedThemeName] = useState(themePresets[0].name);
  const [selectedPart, setSelectedPart] = useState<keyof BlockPartStyles>("container");
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);
  const lastFocusedTextBlockId = useRef<string>("");
  const [copiedBlockStyle, setCopiedBlockStyle] = useState<Block["styles"] | null>(null);
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [imageManagerTarget, setImageManagerTarget] = useState<"block-bg" | "part-bg" | "hero" | "image-block">("part-bg");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [photoFolder, setPhotoFolder] = useState("project/images");
  const [folderList, setFolderList] = useState<string[]>(["project/images"]);
  const [folderManagerStatus, setFolderManagerStatus] = useState("");
  const [folderManagerStatusOk, setFolderManagerStatusOk] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("project/images");
  const [renameTarget, setRenameTarget] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [moveTargetFolder, setMoveTargetFolder] = useState("project/images");
  const [selectMode, setSelectMode] = useState(true);
  const [loadedProjectSource, setLoadedProjectSource] = useState("unknown");
  const chatProviderStatus = providerStatus.find((provider) => provider.name === "AI Chat Summary") || null;
  const displayVersion = getDisplayVersion(buildInfo, buildInfoStatus);
  const buildIdentity = getBuildIdentityState(buildInfo, buildInfoStatus);
  const showVersionIdentityBanner = !versionBannerDismissed && (
    buildIdentity.status === "mismatch" || buildInfoStatus === "unavailable"
  );
  const [loadedProjectUpdatedAt, setLoadedProjectUpdatedAt] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutSectionRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || isMobileViewport) return;
    localStorage.setItem(AI_PANEL_STORAGE_KEY, JSON.stringify({ version: AI_PANEL_STORAGE_VERSION, ...aiPanelRect }));
  }, [aiPanelRect, isMobileViewport]);

  useEffect(() => {
    if (!aiTopMenuOpen || isMobileViewport) return;
    const update = () => setAiPanelRect((current) => clampAiPanelRect(current));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [aiTopMenuOpen, isMobileViewport]);

  useEffect(() => {
    if (isMobileViewport) {
      setAiPanelDrag(null);
      setAiPanelResize(null);
      return;
    }
    if (!aiPanelDrag && !aiPanelResize) return;
    const handleMove = (event: PointerEvent) => {
      if (aiPanelDrag && event.pointerId === aiPanelDrag.pointerId) {
        setAiPanelRect((current) => clampAiPanelRect({
          ...current,
          x: event.clientX - aiPanelDrag.offsetX,
          y: event.clientY - aiPanelDrag.offsetY
        }));
      }
      if (aiPanelResize && event.pointerId === aiPanelResize.pointerId) {
        const dx = event.clientX - aiPanelResize.startX;
        const dy = event.clientY - aiPanelResize.startY;
        setAiPanelRect((current) => clampAiPanelRect({
          ...current,
          width: aiPanelResize.startWidth + dx,
          height: aiPanelResize.startHeight + dy
        }));
      }
    };
    const handleUp = (event: PointerEvent) => {
      if (aiPanelDrag && event.pointerId === aiPanelDrag.pointerId) setAiPanelDrag(null);
      if (aiPanelResize && event.pointerId === aiPanelResize.pointerId) setAiPanelResize(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [aiPanelDrag, aiPanelResize, isMobileViewport]);

  const [websiteManagerOpen, setWebsiteManagerOpen] = useState(false);
  const [newPageFlowOpen, setNewPageFlowOpen] = useState(false);
  const [newPageStep, setNewPageStep] = useState(0);
  const [newPageName, setNewPageName] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageParentId, setNewPageParentId] = useState<string>("");
  const [newPageShowInNav, setNewPageShowInNav] = useState(true);
  const [newPageTemplate, setNewPageTemplate] = useState("blank");
  const [websiteManagerError, setWebsiteManagerError] = useState("");

  function resetNewPageFlow() {
    setNewPageStep(0);
    setNewPageName("");
    setNewPageSlug("");
    setNewPageParentId("");
    setNewPageShowInNav(true);
    setNewPageTemplate("blank");
    setWebsiteManagerError("");
  }

  function handleCreatePage() {
    if (!project) return;
    if (!newPageName.trim()) {
      setWebsiteManagerError("Page name is required.");
      return;
    }
    const rawSlug = newPageSlug || generateSlug(newPageName);
    const slug = getUniqueSlug(rawSlug, project.pages);
    const blocks = getStarterBlocks(newPageTemplate, selectedPage?.blocks || []);
    const page = createPage(newPageName.trim(), project.pages, {
      parentId: newPageParentId || undefined,
      showInNav: newPageShowInNav,
      template: newPageTemplate,
      blocks,
    });
    page.slug = slug;
    const nextPages = [...project.pages, page];
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setSelectedPageId(page.id);
    setDirty(true);
    setStatus("Page created");
    setNewPageFlowOpen(false);
    setWebsiteManagerOpen(false);
    resetNewPageFlow();
  }

  function handleDuplicatePage(pageId: string) {
    if (!project) return;
    const page = project.pages.find((p) => p.id === pageId);
    if (!page) return;
    const dup = duplicatePage(page, project.pages);
    const nextPages = [...project.pages, dup];
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setSelectedPageId(dup.id);
    setDirty(true);
    setStatus("Page duplicated");
    setWebsiteManagerOpen(false);
  }

  function handleDeletePage(pageId: string) {
    if (!project) return;
    if (project.pages.length <= 1) {
      setWebsiteManagerError("Cannot delete the last page.");
      return;
    }
    const pageName = project.pages.find((p) => p.id === pageId)?.title || "this page";
    if (!window.confirm(`Delete "${pageName}"? This cannot be undone.`)) return;
    const { pages: nextPages, fallbackId } = deletePageHelper(project.pages, pageId);
    if (selectedPageId === pageId && fallbackId) setSelectedPageId(fallbackId);
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setDirty(true);
    setStatus("Page deleted");
  }

  function handleRenamePage(pageId: string, newTitle: string) {
    if (!project) return;
    if (!newTitle.trim()) return;
    const nextPages = project.pages.map((p) => p.id === pageId ? renamePage(p, newTitle.trim()) : p);
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setDirty(true);
    setStatus("Page renamed");
  }

  function handleUpdatePageSlug(pageId: string, newSlug: string) {
    if (!project) return;
    const page = project.pages.find((p) => p.id === pageId);
    if (!page) return;
    const updated = updatePageSlug(page, newSlug, project.pages);
    const nextPages = project.pages.map((p) => p.id === pageId ? updated : p);
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setDirty(true);
    setStatus("Page slug updated");
  }

  function handleToggleShowInNav(pageId: string) {
    if (!project) return;
    const nextPages = project.pages.map((p) => p.id === pageId ? { ...p, showInNav: !p.showInNav } : p);
    const navItems = buildNavItems(nextPages);
    setProject({ ...project, pages: nextPages, site: { ...project.site, nav: navItems }, updatedAt: new Date().toISOString() });
    setDirty(true);
  }

  function handleSetParentPage(pageId: string, parentId: string) {
    if (!project) return;
    const nextPages = project.pages.map((p) => p.id === pageId ? { ...p, parentId: parentId || undefined } : p);
    setProject({ ...project, pages: nextPages, updatedAt: new Date().toISOString() });
    setDirty(true);
    setStatus("Parent page updated");
  }

  // Friendly block type labels
  const blockTypeLabels: Record<BlockType, string> = {
    hero: "Hero section",
    text: "Text section",
    image: "Image section",
    cards: "Cards section",
    hours: "Hours section",
    gallery: "Gallery section",
    contact: "Contact section",
    testimonial: "Testimonial section",
    map: "Map section",
    marquee: "Marquee section",
    spacer: "Spacer",
    divider: "Divider",
    html: "HTML block"
  };

  // Friendly part labels
  const partLabels: Record<keyof BlockPartStyles, string> = {
    container: "Whole block",
    heading: "Heading",
    body: "Body text",
    button: "Button/CTA",
    card: "Cards/items",
    cardHeading: "Card heading",
    cardBody: "Card body",
    nav: "Navigation",
    image: "Image/background"
  };

  // Preset mappings
  const SIZE_PRESETS = { Small: 14, Normal: 18, Large: 24, XL: 32 };
  const WEIGHT_PRESETS = { Normal: 400, Medium: 600, Bold: 700, "Extra Bold": 800 };
  const PADDING_PRESETS = { None: 0, Tight: 8, Normal: 16, Spacious: 32, Huge: 64 };
  const MARGIN_PRESETS = { None: 0, Tight: 4, Normal: 8, Spacious: 24 };
  const BORDER_PRESETS = { None: 0, Thin: 1, Medium: 2, Thick: 4 };
  const RADIUS_PRESETS = { Square: 0, Soft: 6, Rounded: 12, Pill: 999 };
  const SHADOW_PRESETS: Record<string, string> = {
    None: "",
    Soft: "0 2px 8px rgba(0,0,0,.08)",
    Medium: "0 4px 16px rgba(0,0,0,.12)",
    Strong: "0 8px 32px rgba(0,0,0,.18)",
    Glow: "0 0 20px rgba(70,130,255,.3)"
  };

  // Gradient helpers
  function readGradientFromPart(part?: PartStyle): { colors: string[]; direction: string; type: "linear" | "radial" | "conic" } {
    const grad = part?.backgroundColor || "";
    const isGradient = grad.includes("gradient");
    // Only trust structured fields if backgroundColor is actually a gradient
    if (isGradient && part?.gradientType && part.gradientColors && part.gradientColors.length >= 2) {
      return {
        colors: part.gradientColors,
        direction: part.gradientDirection || "135deg",
        type: part.gradientType
      };
    }
    if (!isGradient) {
      return { colors: ["#ff6b6b", "#feca57"], direction: "135deg", type: "linear" };
    }
    const type: "linear" | "radial" | "conic" = grad.includes("conic-gradient") ? "conic" : grad.includes("radial-gradient") ? "radial" : "linear";
    const dirMatch = grad.match(/gradient\(([^,]+),/);
    const direction = dirMatch ? dirMatch[1].trim() : "135deg";
    const colors = grad.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g) || ["#ff6b6b", "#feca57"];
    return { colors, direction, type };
  }

  function buildGradientCss(colors: string[], direction: string, type: "linear" | "radial" | "conic"): string {
    const c = colors.join(", ");
    if (type === "radial") return `radial-gradient(${direction}, ${c})`;
    if (type === "conic") return `conic-gradient(from ${direction}, ${c})`;
    return `linear-gradient(${direction}, ${c})`;
  }

  function applyGradientToPart(colors: string[], direction: string, type: "linear" | "radial" | "conic") {
    const css = buildGradientCss(colors, direction, type);
    updateSelectedPartStyle({
      backgroundColor: css,
      backgroundImage: undefined,
      gradientType: type,
      gradientColors: colors,
      gradientDirection: direction
    });
  }

  const GRADIENT_PRESETS: Record<string, { colors: string[]; direction: string; type: "linear" | "radial" | "conic" }> = {
    Sunset: { colors: ["#ff6b6b", "#feca57"], direction: "135deg", type: "linear" },
    Forest: { colors: ["#1dd1a1", "#10ac84"], direction: "135deg", type: "linear" },
    Ocean: { colors: ["#48dbfb", "#0abde3"], direction: "135deg", type: "linear" },
    Neon: { colors: ["#ff9ff3", "#f368e0", "#00d2ff"], direction: "135deg", type: "linear" },
    Candy: { colors: ["#ff6b6b", "#feca57", "#48dbfb"], direction: "90deg", type: "linear" },
    Fire: { colors: ["#ff4d4d", "#ff9f43", "#feca57"], direction: "180deg", type: "linear" },
    Steel: { colors: ["#636e72", "#b2bec3", "#dfe6e9"], direction: "135deg", type: "linear" },
    "Soft light": { colors: ["#feca57", "#ff9ff3"], direction: "135deg", type: "linear" },
    Custom: { colors: ["#ff6b6b", "#feca57"], direction: "135deg", type: "linear" }
  };

  const GRADIENT_DIRECTIONS: Record<string, string> = {
    "Top → Bottom": "180deg",
    "Bottom → Top": "0deg",
    "Left → Right": "90deg",
    "Right → Left": "270deg",
    "Diagonal ↘": "135deg",
    "Diagonal ↗": "45deg",
    "Radial center": "circle",
    "Radial corner": "circle at top left"
  };

  const selectedPage = useMemo(() => project?.pages.find((p) => p.id === selectedPageId) || project?.pages[0], [project, selectedPageId]);
  const selectedBlock = selectedPage?.blocks.find((b) => b.id === selectedBlockId) || selectedPage?.blocks[0];
  const currentPageMarkupAnnotations = useMemo(
    () => (project?.markupAnnotations || []).filter((annotation) => annotation.type === "note" && annotation.pageId === selectedPage?.id),
    [project?.markupAnnotations, selectedPage?.id]
  );
  const currentPageFreehandStrokes = useMemo(
    () => (project?.markupFreehandStrokes || []).filter((stroke) => stroke.pageId === selectedPage?.id),
    [project?.markupFreehandStrokes, selectedPage?.id]
  );
  const rowRenderItems = useMemo(() => toRowRenderItems(selectedPage?.blocks || []), [selectedPage?.blocks]);
  const shouldStackRows = deviceMode === "phone";
  const usedImageUrls = useMemo(() => collectUsedImageUrls(project), [project]);
  const filteredUploadedImages = useMemo(
    () => uploadedImages.filter((img) => imagePassesFilter(img, imageLibraryFilter, imageDiagnostics[img.url], usedImageUrls)),
    [uploadedImages, imageLibraryFilter, imageDiagnostics, usedImageUrls]
  );

  function closeTransientOverlays() {
    setContextMenu(null);
    setRightDrawerMobileOpen(false);
  }

  useEffect(() => {
    if (selectedBlock?.type !== "gallery" && selectedGalleryIndex !== null) setSelectedGalleryIndex(null);
  }, [selectedBlock?.id, selectedBlock?.type, selectedGalleryIndex]);

  async function loadBuildInfo() {
    setBuildInfoStatus("loading");
    try {
      const data = await fetchJson<SBuildBuildInfo>("/health");
      setBuildInfo(data);
      setBuildInfoStatus("ok");
      setBuildInfoError("");
    } catch (err) {
      setBuildInfo(null);
      setBuildInfoStatus("unavailable");
      setBuildInfoError(err instanceof Error ? err.message : "health unavailable");
    }
  }

  useEffect(() => {
    void loadProject();
    void loadFonts();
    void loadImages();
    void loadBuildInfo();
    void loadPhotoFolder();
    void refreshFolderList();
    void (async () => {
      const secrets = await loadSecretsStatus();
      await loadProviders(secrets);
      await discoverLocalModels();
      await loadProviderConfig();
      try {
        const pref = await fetchJson<{ ok: boolean; preferences?: { builderUiTheme?: string } }>("/api/account/preferences");
        const nextTheme = pref.preferences?.builderUiTheme === "Dark" ? "Dark" : pref.preferences?.builderUiTheme === "Light" ? "Light" : null;
        if (nextTheme) setEditorTheme(nextTheme);
      } catch {
        // ignore; localStorage fallback stays active
      } finally {
        setBuilderThemePrefsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("sbuild_left_collapsed", leftCollapsed ? "1" : "0");
  }, [leftCollapsed]);

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth <= 768);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setLeftCollapsed(true);
      setRightDrawerMobileOpen(false);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    if (userRole !== null && userRole !== "admin") {
      if (settingsTab === "keys" || settingsTab === "users") {
        setSettingsTab("general");
      }
    }
  }, [userRole, settingsTab]);

  const topbarRef = useRef<HTMLElement>(null);
  const statusPillRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const canvasControlsRef = useRef<HTMLDivElement>(null);
  const [debugToolbarH, setDebugToolbarH] = useState(0);
  const [debugStatusPillH, setDebugStatusPillH] = useState(0);
  const [debugStatusOverflow, setDebugStatusOverflow] = useState(false);
  const [debugSpacerH, setDebugSpacerH] = useState(0);
  const [debugToolbarBottom, setDebugToolbarBottom] = useState(0);
  const [debugCanvasControlsTop, setDebugCanvasControlsTop] = useState(0);
  const [debugGapPx, setDebugGapPx] = useState(0);
  const [debugDuplicateOffset, setDebugDuplicateOffset] = useState(false);
  const [debugTopbarPaddingTop, setDebugTopbarPaddingTop] = useState(0);
  const [debugMeasurementMissing, setDebugMeasurementMissing] = useState(false);
  const mobileLayoutReady = Boolean(project && selectedPage);
  useEffect(() => {
    if (!isMobileViewport || !mobileLayoutReady) {
      document.documentElement.style.removeProperty("--mobile-topbar-h");
      document.documentElement.style.removeProperty("--mobile-toolbar-h");
      setDebugToolbarH(0);
      setDebugStatusPillH(0);
      setDebugStatusOverflow(false);
      setDebugSpacerH(0);
      setDebugToolbarBottom(0);
      setDebugCanvasControlsTop(0);
      setDebugGapPx(0);
      setDebugDuplicateOffset(false);
      setDebugTopbarPaddingTop(0);
      setDebugMeasurementMissing(false);
      return;
    }
    const update = () => {
      const el = topbarRef.current;
      if (!el) {
        setDebugMeasurementMissing(true);
        return;
      }
      const h = Math.round(el.getBoundingClientRect().height);
      const computed = window.getComputedStyle(el);
      const topPadding = Math.round(Number.parseFloat(computed.paddingTop || "0") || 0);
      const visible = computed.display !== "none" && computed.visibility !== "hidden";
      if (visible && h <= 0) {
        setDebugMeasurementMissing(true);
        return;
      }
      document.documentElement.style.setProperty("--mobile-topbar-h", `${h}px`);
      document.documentElement.style.setProperty("--mobile-toolbar-h", `${h}px`);
      setDebugToolbarH(h);
      setDebugTopbarPaddingTop(topPadding);
      setDebugMeasurementMissing(false);
      if (statusPillRef.current) {
        setDebugStatusPillH(Math.round(statusPillRef.current.getBoundingClientRect().height));
        setDebugStatusOverflow(statusPillRef.current.scrollHeight > statusPillRef.current.clientHeight);
      }
      requestAnimationFrame(() => {
        if (spacerRef.current) {
          setDebugSpacerH(Math.round(spacerRef.current.getBoundingClientRect().height));
        }
        const tbBottom = topbarRef.current ? Math.round(topbarRef.current.getBoundingClientRect().bottom) : 0;
        const ccTop = canvasControlsRef.current ? Math.round(canvasControlsRef.current.getBoundingClientRect().top) : 0;
        const gapPx = ccTop - tbBottom;
        setDebugToolbarBottom(tbBottom);
        setDebugCanvasControlsTop(ccTop);
        setDebugGapPx(gapPx);
        setDebugDuplicateOffset(gapPx > 48);
        if (visible && (tbBottom <= 0 || ccTop <= 0)) {
          setDebugMeasurementMissing(true);
        }
      });
    };
    update();
    const raf1 = requestAnimationFrame(update);
    const raf2 = requestAnimationFrame(update);
    const el = topbarRef.current;
    if (!el) {
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    const obs = new ResizeObserver(update);
    obs.observe(el);
    if (statusPillRef.current) obs.observe(statusPillRef.current);
    if (spacerRef.current) obs.observe(spacerRef.current);
    if (canvasControlsRef.current) obs.observe(canvasControlsRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      obs.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [isMobileViewport, mobileLayoutReady, leftCollapsed]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("wheel", closeMenu, { passive: true });
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("wheel", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  useEffect(() => {
    const onToggle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (e.key === "Escape" && imageManagerOpen) {
        setImageManagerOpen(false);
        return;
      }
      if ((e.ctrlKey && e.key.toLowerCase() === "b") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "b")) {
        e.preventDefault();
        setLeftCollapsed((prev) => {
          const next = !prev;
          setStatus(next ? "Left panel collapsed" : "Left panel opened");
          return next;
        });
      }
    };
    window.addEventListener("keydown", onToggle);
    return () => window.removeEventListener("keydown", onToggle);
  }, [imageManagerOpen, helpOpen]);

  useEffect(() => {
    if (!resizeDrag) return;
    const onMove = (e: PointerEvent) => {
      if (!selectedPage || !selectedBlock || selectedBlock.id !== resizeDrag.blockId) return;
      const dx = e.clientX - resizeDrag.startX;
      const dy = e.clientY - resizeDrag.startY;
      const nextWidth = snapWidthPercent(clampWidthPercent(resizeDrag.startWidth + Math.round(dx / 4)));
      const nextMinHeight = snapMinHeight(clampMinHeight(resizeDrag.startMinHeight + Math.round(dy)));
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          layout: {
            ...(b.styles?.layout || {}),
            widthMode: "custom",
            widthPercent: resizeDrag.handle === "right" ? nextWidth : (b.styles?.layout?.widthPercent || resizeDrag.startWidth),
            minHeightPx: resizeDrag.handle === "bottom" ? nextMinHeight : (b.styles?.layout?.minHeightPx || resizeDrag.startMinHeight)
          }
        }
      }));
      setResizeStatus(`Width ${nextWidth}% · Min height ${nextMinHeight}px`);
    };
    const onUp = () => setResizeDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeDrag, selectedPage, selectedBlock]);

  useEffect(() => {
    if (!project) return;
    const colors = project.globalStyles.colors;
    const dark = ["Farmstand Dark", "Slimy Neon", "Midnight Orchard", "Retro Terminal"].includes(themeApplied)
      || [colors.bg, colors.surface].some((c) => /^#/.test(c) && parseInt(c.slice(1, 3), 16) < 80);
    const frames = document.querySelectorAll(".canvas-frame, .canvas-area, .sbuild-site-preview, .sbuild-rendered-page");
    frames.forEach((el) => {
      const target = el as HTMLElement;
      target.style.setProperty("--sbuild-editor-bg", colors.pageBackground || (dark ? colors.bg : "#f3ecdc"));
      target.style.setProperty("--sbuild-canvas-bg", colors.canvasBackground || colors.bg);
      target.style.setProperty("--sbuild-surface", colors.surface);
      target.style.setProperty("--sbuild-surface-2", colors.blockAltBackground || (dark ? "rgba(255,255,255,0.04)" : "#fffef9"));
      target.style.setProperty("--sbuild-border", colors.borderColor || (dark ? "rgba(255,255,255,0.18)" : "#d5cfbe"));
      target.style.setProperty("--sbuild-text", colors.bodyTextColor || colors.text);
      target.style.setProperty("--sbuild-muted", colors.mutedTextColor || colors.muted);
      target.style.setProperty("--sbuild-accent", colors.accentColor || colors.accent);
      target.style.setProperty("--sbuild-nav-bg", colors.navBackground || (dark ? "rgba(12,12,18,0.86)" : colors.surface));
      target.style.setProperty("--sbuild-block-bg", colors.blockBackground || colors.surface);
      target.style.setProperty("--sbuild-card-bg", colors.cardBackground || (dark ? "rgba(255,255,255,0.06)" : "#f7efdc"));
      target.style.setProperty("--sbuild-button-bg", colors.buttonBackground || (dark ? "rgba(255,255,255,0.08)" : colors.surface));
      target.style.setProperty("--sbuild-button-text", colors.buttonTextColor || colors.text);
      target.style.setProperty("--sbuild-heading-font", project.globalStyles.headingFont || "Nunito Sans");
      target.style.setProperty("--sbuild-body-font", project.globalStyles.bodyFont || "Nunito Sans");
    });
  }, [project, themeApplied]);

  useEffect(() => {
    if (!project || selectedPageId) return;
    const page = project.pages[0];
    setSelectedPageId(page.id);
    setSelectedBlockId(page.blocks[0]?.id || "");
  }, [project, selectedPageId]);

  async function loadProject() {
    try {
      const data = await fetchJson<{ ok: boolean; project: SBuildProject; loadedProjectSource?: string; loadedProjectUpdatedAt?: string; lastLoadedAt?: string; projectPath?: string }>("/api/project");
      const migrated = { ...data.project, pages: migrateLegacyProject(data.project.pages) };
      setProject(migrated);
      setPaintMode(false);
      setPaintDraftStrokes([]);
      setPaintAppliedStrokes([]);
      setPaintRedoStrokes([]);
      setPaintActivePoints([]);
      setLoadedProjectSource(data.loadedProjectSource || "unknown");
      setLoadedProjectUpdatedAt(data.loadedProjectUpdatedAt || "");
      setLastLoadedAt(data.lastLoadedAt || new Date().toISOString());
      setProjectPath(data.projectPath || "");
      // Restore theme from persisted project.selectedTheme
      const savedTheme = data.project.selectedTheme;
      if (savedTheme) {
        const matched = themePresets.find((t) => t.name === savedTheme);
        if (matched) {
          setSelectedThemeName(matched.name);
          setThemeApplied(matched.name);
        } else {
          setSelectedThemeName(savedTheme);
          setThemeApplied(savedTheme);
        }
      } else {
        // Fallback: match by color (legacy behavior)
        const matched = themePresets.find((t) => t.colors.bg === data.project.globalStyles.colors.bg && t.colors.surface === data.project.globalStyles.colors.surface);
        if (matched) {
          setSelectedThemeName(matched.name);
          setThemeApplied(matched.name);
        }
      }
      setStatus(`Project loaded from ${data.loadedProjectSource || "unknown"}`);
    } catch (error) {
      setStatus(`Failed to load project: ${String(error)}`);
    }
  }

  async function loadFonts() {
    try {
      const data = await fetchJson<{ fonts: Array<{ family: string }> }>("/api/fonts");
      setFonts(data.fonts || []);
    } catch { setFonts([]); }
  }

  async function loadImages() {
    try {
      const data = await fetchJson<{ ok: boolean; images: ImageMeta[]; folder?: string }>("/api/images");
      const all = data.images || [];
      const next = all.filter((img) => isRenderableImageMeta(img));
      setUploadedImages(next);
      if (data.folder) setPhotoFolder(data.folder);
      setSelectedImageUrls((prev) => {
        const known = new Set(next.map((img) => img.url));
        const filtered = Array.from(prev).filter((url) => known.has(url));
        return filtered.length === prev.size ? prev : new Set(filtered);
      });
      if (selectedUploadImage && !next.some((img) => img.url === selectedUploadImage)) {
        setSelectedUploadImage(next[0]?.url || "");
      } else if (!selectedUploadImage && next.length > 0) {
        setSelectedUploadImage(next[0].url);
      }
    } catch { setUploadedImages([]); }
  }

  async function bulkDeleteImages(paths: string[]): Promise<{ ok: boolean; deletedCount: number; skippedCount: number; results: Array<{ path: string; deleted: boolean; error?: string; skipped?: string }> }> {
    if (paths.length === 0) return { ok: true, deletedCount: 0, skippedCount: 0, results: [] };
    const request = createImageDeleteRequest(paths);
    const data = await fetchJson<{ ok: boolean; deletedCount: number; skippedCount: number; results: Array<{ path: string; deleted: boolean; error?: string; skipped?: string }> }>(request.url, request.init);
    await loadImages();
    return data;
  }

  function toggleImageSelected(url: string): void {
    setSelectedImageUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAllFilteredImages(): void {
    setSelectedImageUrls(new Set(filteredUploadedImages.map((img) => img.url)));
  }

  function clearImageSelection(): void {
    setSelectedImageUrls(new Set());
  }

  function openImageActionPanel(): void {
    if (!selectedUploadImage) return;
    setImageActionPanelOpen(true);
    setImageActionTab("actions");
  }

  function captureImageDiagnostics(url: string, name: string, element: HTMLImageElement) {
    if (imageDiagnostics[url]) return;
    const width = element.naturalWidth || 0;
    const height = element.naturalHeight || 0;
    const likelyTallCapture = (width > 0 && height > 0 && height / Math.max(width, 1) >= 1.55) || isLikelyScreenshotName(name);
    let likelyWhite = false;
    if (width > 0 && height > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(element, 0, 0, 24, 24);
          const imageData = ctx.getImageData(0, 0, 24, 24).data;
          let total = 0;
          let totalSquared = 0;
          const pixels = imageData.length / 4;
          for (let i = 0; i < imageData.length; i += 4) {
            const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
            total += brightness;
            totalSquared += brightness * brightness;
          }
          const avg = total / Math.max(pixels, 1);
          const variance = totalSquared / Math.max(pixels, 1) - avg * avg;
          likelyWhite = avg >= 246 && variance <= 95;
        }
      } catch {
        likelyWhite = false;
      }
    }
    setImageDiagnostics((prev) => ({
      ...prev,
      [url]: { width, height, likelyWhite, likelyTallCapture }
    }));
  }

  async function loadPhotoFolder() {
    try {
      const data = await fetchJson<{ ok: boolean; folder?: string }>("/api/images/folder");
      if (data.folder) setPhotoFolder(data.folder);
    } catch {
      // ignore
    }
  }

  async function savePhotoFolder() {
    try {
      const data = await fetchJson<{ ok: boolean; message?: string; error?: string }>("/api/images/folder", {
        method: "POST",
        body: JSON.stringify({ folder: photoFolder })
      });
      setStatus(data.ok ? (data.message || "Folder saved") : (data.error || "Failed to save folder"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to save folder: ${message}`);
    }
  }

  async function refreshFolderList(): Promise<void> {
    try {
      const data = await fetchJson<{ ok: boolean; folders?: string[]; error?: string }>("/api/images/folder/list");
      if (data.ok && Array.isArray(data.folders)) {
        setFolderList(data.folders);
        if (!data.folders.includes(photoFolder)) setPhotoFolder(data.folders[0] || "project/images");
      } else {
        setFolderManagerStatus(data.error || "Failed to list folders.");
        setFolderManagerStatusOk(false);
      }
    } catch (error) {
      setFolderManagerStatus(`Failed to list folders: ${error instanceof Error ? error.message : String(error)}`);
      setFolderManagerStatusOk(false);
    }
  }

  async function createImageFolder(): Promise<void> {
    const name = newFolderName.trim();
    if (!name) {
      setFolderManagerStatus("Enter a folder name first.");
      setFolderManagerStatusOk(false);
      return;
    }
    try {
      const data = await fetchJson<{ ok: boolean; folder?: string; error?: string }>("/api/images/folder/create", {
        method: "POST",
        body: JSON.stringify({ parent: newFolderParent, name })
      });
      if (data.ok) {
        setFolderManagerStatus(`Created folder ${data.folder}.`);
        setFolderManagerStatusOk(true);
        setNewFolderName("");
        await refreshFolderList();
      } else {
        setFolderManagerStatus(data.error || "Failed to create folder.");
        setFolderManagerStatusOk(false);
      }
    } catch (error) {
      setFolderManagerStatus(`Failed to create folder: ${error instanceof Error ? error.message : String(error)}`);
      setFolderManagerStatusOk(false);
    }
  }

  async function renameImageFolder(): Promise<void> {
    if (!renameTarget || !renameValue.trim()) {
      setFolderManagerStatus("Select a folder and enter a new name first.");
      setFolderManagerStatusOk(false);
      return;
    }
    const parent = renameTarget.includes("/") ? renameTarget.slice(0, renameTarget.lastIndexOf("/")) : "project/images";
    const to = `${parent}/${renameValue.trim()}`.replace(/^project\/images\//, "project/images/");
    try {
      const data = await fetchJson<{ ok: boolean; error?: string; message?: string }>("/api/images/folder/rename", {
        method: "POST",
        body: JSON.stringify({ from: renameTarget, to })
      });
      if (data.ok) {
        setFolderManagerStatus(data.message || "Folder renamed.");
        setFolderManagerStatusOk(true);
        setRenameValue("");
        setRenameTarget("");
        await refreshFolderList();
      } else {
        setFolderManagerStatus(data.error || "Failed to rename folder.");
        setFolderManagerStatusOk(false);
      }
    } catch (error) {
      setFolderManagerStatus(`Failed to rename folder: ${error instanceof Error ? error.message : String(error)}`);
      setFolderManagerStatusOk(false);
    }
  }

  async function deleteImageFolder(folder: string): Promise<void> {
    if (!folder || folder === "project/images") {
      setFolderManagerStatus("Cannot delete the root folder.");
      setFolderManagerStatusOk(false);
      return;
    }
    if (!window.confirm(`Delete empty folder ${folder}? This cannot be undone.`)) return;
    try {
      const data = await fetchJson<{ ok: boolean; error?: string; message?: string }>("/api/images/folder/delete", {
        method: "POST",
        body: JSON.stringify({ folder })
      });
      if (data.ok) {
        setFolderManagerStatus(data.message || "Folder deleted.");
        setFolderManagerStatusOk(true);
        await refreshFolderList();
      } else {
        setFolderManagerStatus(data.error || "Failed to delete folder.");
        setFolderManagerStatusOk(false);
      }
    } catch (error) {
      setFolderManagerStatus(`Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`);
      setFolderManagerStatusOk(false);
    }
  }

  async function moveSelectedImagesTo(targetFolder: string): Promise<void> {
    if (selectedImageUrls.size === 0) {
      setFolderManagerStatus("Select one or more images to move first.");
      setFolderManagerStatusOk(false);
      return;
    }
    const paths = Array.from(selectedImageUrls).map((url) => {
      const trimmed = url.replace(/^\/+/, "");
      if (trimmed.startsWith("project/images/")) return trimmed.slice("project/images/".length);
      return trimmed;
    });
    try {
      const data = await fetchJson<{ ok: boolean; movedCount?: number; error?: string; results?: Array<{ path: string; moved: boolean; error?: string }> }>("/api/images/move", {
        method: "POST",
        body: JSON.stringify({ paths, targetFolder })
      });
      if (data.ok) {
        setFolderManagerStatus(`Moved ${data.movedCount || 0} image(s) into ${targetFolder}.`);
        setFolderManagerStatusOk(true);
        clearImageSelection();
        await loadImages();
      } else {
        const firstError = (data.results || []).find((r) => !r.moved && r.error);
        setFolderManagerStatus(firstError?.error || data.error || "Move failed.");
        setFolderManagerStatusOk(false);
      }
    } catch (error) {
      setFolderManagerStatus(`Failed to move images: ${error instanceof Error ? error.message : String(error)}`);
      setFolderManagerStatusOk(false);
    }
  }

  async function loadProviders(secretsSnapshot: SecretStatus = secretStatus) {
    try {
      const data = await fetchJson<unknown>("/api/ai/providers/status");
      setProviderStatus(normalizeProviderStatus(data, secretsSnapshot));
    } catch {
      setProviderStatus(normalizeProviderStatus({}, secretsSnapshot));
    }
  }

  async function loadSecretsStatus(): Promise<SecretStatus> {
    try {
      const data = await fetchJson<unknown>("/api/secrets/status");
      const normalized = normalizeSecretStatus(data);
      setSecretStatus(normalized);
      return normalized;
    } catch {
      try {
        const fallback = await fetchJson<unknown>("/api/status");
        const normalized = normalizeSecretStatus(fallback);
        setSecretStatus(normalized);
        return normalized;
      } catch {
        setSecretStatus(DEFAULT_SECRET_STATUS);
        return DEFAULT_SECRET_STATUS;
      }
    }
  }

  async function discoverLocalModels() {
    try {
      const data = await fetchJson<{ ok: boolean; ollama: { reachable: boolean; models: Array<{ name: string }> } }>("/api/ai/providers/discover");
      if (data.ok && data.ollama?.models) {
        const nextModels = normalizeLocalModelOptions(data.ollama.models);
        setLocalModels(nextModels);
        setChatLocalModel((current) => {
          if (chatProviderMode !== "local") return current;
          if (current && nextModels.some((model) => model.name === current)) return current;
          if (nextModels.some((model) => model.name === "qwen2.5:1.5b")) return "qwen2.5:1.5b";
          return nextModels[0]?.name || "";
        });
      } else {
        setLocalModels([]);
      }
    } catch {
      setLocalModels([]);
    }
  }

  async function loadProviderConfig() {
    try {
      const data = await fetchJson<{
        ok: boolean;
        providerMode: string;
        localModel: string;
        openaiModel: string;
        openrouterModel: string;
        fallbackEnabled: boolean;
        fallbackTimeoutSec: number;
        openaiApiKeySource: string;
        openrouterApiKeySource: string;
        openaiMaskedApiKey: string | null;
        openrouterMaskedApiKey: string | null;
      }>("/api/ai/providers/config");
      if (data.ok) {
        setChatProviderMode(data.providerMode || "auto");
        setChatLocalModel(data.localModel || "");
        setChatOpenAIModel(data.openaiModel || "gpt-4o-mini");
        setChatOpenRouterModel(data.openrouterModel || "openai/gpt-4o-mini");
        setChatFallbackEnabled(data.fallbackEnabled !== false);
        setChatFallbackTimeoutSec(Number(data.fallbackTimeoutSec || 12));
        setChatOpenAIKeyInput("");
        setChatOpenRouterKeyInput("");
        const keyNotes = [
          data.openaiMaskedApiKey ? `OpenAI key: ${data.openaiMaskedApiKey} (${data.openaiApiKeySource})` : "OpenAI key: not configured",
          data.openrouterMaskedApiKey ? `OpenRouter key: ${data.openrouterMaskedApiKey} (${data.openrouterApiKeySource})` : "OpenRouter key: not configured"
        ];
        setProviderCheckMessage((prev) => prev || keyNotes.join(" | "));
      }
    } catch {
      // ignore
    }
  }

  async function saveProviderConfig() {
    try {
      const previousImageGen = secretStatus.imageGen.statusText;
      const previousImageAnalyze = secretStatus.imageAnalyze.statusText;
      await fetchJson("/api/ai/providers/config", {
        method: "POST",
        body: JSON.stringify({
          providerMode: chatProviderMode,
          localModel: chatLocalModel,
          openaiModel: chatOpenAIModel,
          openrouterModel: chatOpenRouterModel,
          fallbackEnabled: chatFallbackEnabled,
          fallbackTimeoutSec: chatFallbackTimeoutSec,
          openaiApiKey: chatOpenAIKeyInput,
          openrouterApiKey: chatOpenRouterKeyInput
        })
      });
      setProviderConfigSaved(true);
      setTimeout(() => setProviderConfigSaved(false), 2000);
      setChatOpenAIKeyInput("");
      setChatOpenRouterKeyInput("");
      await discoverLocalModels();
      const refreshedSecrets = await loadSecretsStatus();
      await loadProviders(refreshedSecrets);
      if (refreshedSecrets.imageGen.statusText === previousImageGen && refreshedSecrets.imageAnalyze.statusText === previousImageAnalyze) {
        setProviderCheckMessage("Provider saved. Image Gen and Image Analyze key status unchanged.");
      }
    } catch {
      // ignore
    }
  }

  async function fetchUserInfo() {
    try {
      const data = await fetchJson<{ ok: boolean; user: { username: string; role: string } }>("/api/account/me");
      if (data.ok) {
        setUserName(data.user.username);
        setUserRole(data.user.role);
      }
    } catch {
      setUserName(null);
      setUserRole(null);
    }
  }

  async function fetchUsers() {
    try {
      const data = await fetchJson<{ ok: boolean; users: Array<{ id: string; username: string; role: string; createdAt: string; disabled?: boolean }> }>("/api/admin/users");
      if (data.ok) setUserList(data.users);
    } catch {
      setUserList([]);
    }
  }

  function patchCurrentPage(nextPage: SBuildPage) {
    if (!project || !selectedPage) return;
    const pages = project.pages.map((p) => (p.id === selectedPage.id ? nextPage : p));
    setProject({ ...project, pages, updatedAt: new Date().toISOString() });
    setDirty(true);
  }

  function patchBlock(blockId: string, mutator: (block: Block) => Block) {
    if (!selectedPage) return;
    patchCurrentPage({ ...selectedPage, blocks: updateBlock(selectedPage.blocks, blockId, mutator) });
  }

  function patchSelectedBlock(mutator: (block: Block) => Block) {
    if (!selectedPage || !selectedBlock) return;
    patchBlock(selectedBlock.id, mutator);
  }

  function patchSelectedBlockData(patch: Record<string, unknown>) {
    patchSelectedBlock((b) => ({ ...b, data: { ...(b.data as Record<string, unknown>), ...patch } }));
  }

  function updateGlobalColor<K extends keyof NonNullable<SBuildProject["globalStyles"]["colors"]>>(key: K, value: string) {
    if (!project) return;
    setProject({ ...project, globalStyles: { ...project.globalStyles, colors: { ...project.globalStyles.colors, [key]: value } } });
    setDirty(true);
  }

  function updateSelectedPartStyle(patch: Partial<PartStyle>) {
    patchSelectedBlock((b) => ({
      ...b,
      styles: {
        ...(b.styles || {}),
        parts: {
          ...(b.styles?.parts || {}),
          [selectedPart]: {
            ...((b.styles?.parts?.[selectedPart] || {}) as PartStyle),
            ...patch
          }
        }
      }
    }));
  }

  function resetSelectedPartToTheme() {
    patchSelectedBlock((b) => {
      const nextParts = { ...(b.styles?.parts || {}) };
      delete nextParts[selectedPart];
      return { ...b, styles: { ...(b.styles || {}), parts: nextParts } };
    });
    setStatus(`Reset ${String(selectedPart)} to theme`);
  }

  function resetWholeBlockToTheme() {
    patchSelectedBlock((b) => ({
      ...b,
      styles: {
        ...(b.styles || {}),
        backgroundColor: undefined,
        backgroundImage: undefined,
        backgroundStyle: undefined,
        textColor: undefined,
        fontFamily: undefined,
        parts: {}
      }
    }));
    setStatus("Reset whole block to theme");
  }

  function friendlySelectedLabel(): string {
    if (!selectedBlock) return "No block selected";
    const blockLabel = blockTypeLabels[selectedBlock.type] || selectedBlock.type;
    const partLabel = partLabels[selectedPart];
    return partLabel ? `${blockLabel} → ${partLabel}` : blockLabel;
  }

  function selectBlock(blockId: string) {
    if (previewMode || paintMode) return;
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    lastFocusedTextBlockId.current = blockId;
    if (!isMobileViewport) setRightCollapsed(false);
  }

  function selectBlockQuiet(blockId: string) {
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    lastFocusedTextBlockId.current = blockId;
  }

  function selectSiteHeaderContainer() {
    if (previewMode || paintMode) return;
    setSelectedSitePart("site-header");
    setSelectedNavIndex(null);
    setSelectedBlockId("");
    setSelectedGalleryIndex(null);
    setStatus("Site header container selected");
  }

  function activateBlockTextTarget(blockId: string, part?: string) {
    if (previewMode || paintMode) return;
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    if (part) setSelectedPart(part as keyof BlockPartStyles);
    lastFocusedTextBlockId.current = blockId;
  }

  function openBlockDrawer(blockId: string) {
    if (previewMode || paintMode) return;
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightDrawerMobileOpen(true);
    setRightCollapsed(false);
    setRightTab("properties");
    setStatus("Edit drawer opened");
  }

  function selectGallerySlot(blockId: string, index: number) {
    if (previewMode || paintMode) return;
    setSelectedBlockId(blockId);
    setSelectedPart("image");
    setSelectedGalleryIndex(index);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightTab("images");
    setStatus(`Selected Gallery image ${index + 1}`);
  }

  function openGallerySlotDrawer(blockId: string, index: number) {
    if (previewMode || paintMode) return;
    setSelectedBlockId(blockId);
    setSelectedPart("image");
    setSelectedGalleryIndex(index);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightTab("images");
    setRightDrawerMobileOpen(true);
    setRightCollapsed(false);
    setStatus(`Editing Gallery image ${index + 1}`);
  }

  function computeAiTarget(): { kind: "site-header" | "block" | "none"; blockId?: string; blockType?: string; label: string } {
    const siteHeaderParts = new Set(["site-title", "nav", "site-header"]);
    if (selectedSitePart && siteHeaderParts.has(selectedSitePart)) {
      return { kind: "site-header", label: "site header" };
    }
    const targetId = lastFocusedTextBlockId.current || selectedBlockId;
    if (targetId) {
      const block = selectedPage?.blocks.find((b) => b.id === targetId);
      if (block && !["spacer", "divider", "html"].includes(block.type)) {
        return { kind: "block", blockId: block.id, blockType: block.type, label: `${blockTypeLabels[block.type] || block.type} · ${block.id}` };
      }
    }
    const editableBlocks = selectedPage?.blocks.filter((b) => !["spacer", "divider", "html"].includes(b.type)) || [];
    if (editableBlocks.length > 0) {
      const target = editableBlocks[0];
      return { kind: "block", blockId: target.id, blockType: target.type, label: `${blockTypeLabels[target.type] || target.type} · ${target.id}` };
    }
    return { kind: "none", label: "none" };
  }

  function openAiDrawer(targetBlockId?: string) {
    if (previewMode || paintMode) {
      setStatus("AI is not available in Preview mode");
      return;
    }

    setRightTab("ai");
    setRightDrawerMobileOpen(true);
    setRightCollapsed(false);

    if (targetBlockId) {
      const block = selectedPage?.blocks.find((b) => b.id === targetBlockId);
      if (block) {
        if (targetBlockId !== selectedBlockId) {
          setSelectedBlockId(targetBlockId);
          setSelectedGalleryIndex(null);
          setSelectedSitePart(null);
          setSelectedNavIndex(null);
        }
        const label = `${blockTypeLabels[block.type] || block.type} · ${block.id}`;
        setStatus(`AI panel: block ${label}`);
        return;
      }
    }

    const target = computeAiTarget();
    if (target.kind === "site-header") {
      setStatus("AI panel: site header");
      return;
    }
    if (target.kind === "block" && target.blockId) {
      if (target.blockId !== selectedBlockId) {
        setSelectedBlockId(target.blockId);
        setSelectedGalleryIndex(null);
        setSelectedSitePart(null);
        setSelectedNavIndex(null);
      }
      setStatus(`AI panel: block ${target.label}`);
      return;
    }
    setStatus("Select a block to use AI");
  }

  function toggleAiTopMenu() {
    setAiTopMenuOpen((prev) => !prev);
  }

  function aiChatTargetLabel(): string {
    if (aiChatTarget === "site") return "Whole Site";
    if (aiChatTarget === "page") return `Current Page (${selectedPage?.title || "unknown"})`;
    const target = computeAiTarget();
    if (target.kind === "block") return `Selected Block (${blockTypeLabels[target.blockType as BlockType] || target.blockType || "unknown"})`;
    if (target.kind === "site-header") return "Selected Block (site header)";
    return "Selected Block (none)";
  }

  function pushChatMessage(next: Omit<ChatItem, "id" | "timestamp"> & { timestamp?: number }) {
    const timestamp = next.timestamp ?? Date.now();
    setChatHistory((history) => [...history, {
      id: `${next.role}-${timestamp}-${history.length}`,
      timestamp,
      ...next
    }]);
  }

  function scrollChatToBottom() {
    if (!chatMessagesRef.current) return;
    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    setTimeout(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      }
    }, 16);
    setTimeout(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      }
    }, 120);
  }

  useEffect(() => {
    if (aiTopMenuTab !== "chat") return;
    scrollChatToBottom();
  }, [aiTopMenuTab, chatHistory.length, aiProposalPending]);

  useEffect(() => {
    if (aiTopMenuTab !== "chat" || !aiTopMenuOpen) return;
    const last = chatHistory[chatHistory.length - 1];
    if (!last) return;
    const id = last.id;
    requestAnimationFrame(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      }
    });
    const t = setTimeout(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      }
    }, 250);
    return () => clearTimeout(t);
  }, [chatHistory.map((m) => m.id).join("|"), aiTopMenuOpen, aiTopMenuTab]);

  useEffect(() => {
    if (!aiTopMenuOpen) return;
    if (aiTopMenuTab === "chat") {
      scrollChatToBottom();
    }
  }, [aiTopMenuOpen, aiTopMenuTab]);

  function resetAiPanelPosition() {
    setAiPanelRect(defaultAiPanelRect());
  }

  function handleAiPanelDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (isMobileViewport) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    const rect = aiPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAiPanelDrag({
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    });
  }

  function handleAiPanelResizeStart(event: React.PointerEvent<HTMLButtonElement>, handle: AiPanelResizeHandle) {
    if (isMobileViewport) return;
    event.stopPropagation();
    setAiPanelResize({
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: aiPanelRect.width,
      startHeight: aiPanelRect.height
    });
  }

  function extractBlockContent(block: Block): string {
    const parts: string[] = [`[${blockTypeLabels[block.type] || block.type} block]`];
    const d = block.data as Record<string, unknown>;
    const s = block.styles || {};
    if (d.heading) parts.push(`Heading: ${d.heading}`);
    if (d.subheading) parts.push(`Subheading: ${d.subheading}`);
    if (d.body) parts.push(`Body: ${String(d.body).slice(0, 500)}`);
    if (d.text) parts.push(`Text: ${String(d.text).slice(0, 500)}`);
    if (d.title) parts.push(`Title: ${d.title}`);
    if (d.cards && Array.isArray(d.cards)) {
      (d.cards as Array<Record<string, unknown>>).forEach((item, i) => {
        const itemParts: string[] = [];
        if (item.heading || item.title) itemParts.push(String(item.heading || item.title));
        if (item.subheading || item.description) itemParts.push(String(item.subheading || item.description));
        if (item.body || item.text) itemParts.push(String(item.body || item.text).slice(0, 200));
        if (itemParts.length) parts.push(`  Card ${i + 1}: ${itemParts.join(" / ")}`);
      });
    }
    if (d.items && Array.isArray(d.items)) {
      (d.items as Array<Record<string, unknown>>).forEach((item, i) => {
        const itemParts: string[] = [];
        if (item.heading || item.title) itemParts.push(String(item.heading || item.title));
        if (item.subheading || item.description) itemParts.push(String(item.subheading || item.description));
        if (item.body || item.text) itemParts.push(String(item.body || item.text).slice(0, 200));
        if (itemParts.length) parts.push(`  Item ${i + 1}: ${itemParts.join(" / ")}`);
      });
    }
    if (d.rows && Array.isArray(d.rows)) {
      (d.rows as Array<Record<string, unknown>>).forEach((row, i) => {
        const day = String(row.day || `Row ${i + 1}`).trim();
        const open = String(row.open || "").trim();
        const close = String(row.close || "").trim();
        const note = String(row.note || "").trim();
        const range = open || close ? `${open || "?"}-${close || "?"}` : "(hours not set)";
        parts.push(`  Hours ${i + 1}: ${day} ${range}${note ? ` (${note})` : ""}`.trim());
      });
    }
    if (d.images && Array.isArray(d.images)) {
      parts.push(`  ${d.images.length} gallery image(s)`);
    }
    if (s.backgroundImage) parts.push(`(has background image)`);
    return parts.join("\n");
  }

  function extractPageContent(scope: "page" | "site"): string {
    if (!project) return "";
    const pages = scope === "site" ? project.pages : (selectedPage ? [selectedPage] : []);
    const sections: string[] = [];
    for (const page of pages) {
      sections.push(`\n=== Page: ${page.title || page.slug || "home"} ===`);
      for (const block of page.blocks) {
        sections.push(extractBlockContent(block));
      }
    }
    return sections.join("\n");
  }

  async function aiAskSuggest() {
    const prompt = chatInput.trim();
    if (!prompt) return;
    setAiProposalPending(true);
    setAiProposal("");
    setAiStructuredProposal(null);
    setAiHasProposal(false);
    pushChatMessage({ role: "user", text: prompt });
    scrollChatToBottom();
    setChatInput("");
    const startedAt = Date.now();
    try {
      const target = computeAiTarget();
      const data = await fetchJson<{ ok: boolean; suggestion?: string; error?: string; provider?: string; model?: string; source?: string; message?: string; latencyMs?: number; hasProposal?: boolean; proposal?: StructuredSuggestionProposal | null; engine?: string; mode?: string; engineModel?: string; engineLatencyMs?: number; engineTimeoutMs?: number | null; engineContextUsed?: string[]; engineReason?: string; deterministicAnswer?: boolean; fallbackUsed?: boolean; fallbackFrom?: string | null; fallbackReason?: string | null }>("/api/ai/suggest", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          targetKind: aiChatTarget,
          blockId: aiChatTarget === "block" ? (target.blockId || selectedBlockId) : "",
          blockType: aiChatTarget === "block" ? (target.blockType || selectedBlock?.type || "") : "",
          chatHistory: chatHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          pageContent: aiChatTarget !== "block" ? extractPageContent(aiChatTarget === "site" ? "site" : "page") : "",
          blockContent: aiChatTarget === "block" && selectedBlock ? extractBlockContent(selectedBlock) : undefined,
          projectContext: project || undefined,
          selectedBlockId: aiChatTarget === "block" ? (target.blockId || selectedBlockId || "") : "",
          selectedPageId: selectedPageId || selectedPage?.id || ""
        })
      });
      if (data.ok && data.suggestion) {
        setAiProposal(data.suggestion);
        setAiStructuredProposal(data.proposal || null);
        const hasValidProposal = Boolean(data.proposal?.replaceText) && canEditBlocks;
        setAiHasProposal(hasValidProposal);
        setAiProposalBlockId(aiChatTarget === "block" ? (target.blockId || selectedBlockId) : "");
        setAiProposalBlockType(aiChatTarget === "block" ? (target.blockType || selectedBlock?.type || "") : "");
        const isTimeoutMsg = data.suggestion.includes("timed out") || data.suggestion.startsWith("Local model timed out");
        pushChatMessage({
          role: "assistant",
          text: data.suggestion!,
          provider: data.provider,
          model: data.model,
          source: data.source,
          engine: data.engine,
          mode: data.mode,
          engineModel: data.engineModel,
          engineReason: data.engineReason,
          deterministicAnswer: data.deterministicAnswer,
          latencyMs: data.latencyMs ?? (Date.now() - startedAt),
          retryPrompt: isTimeoutMsg ? prompt : undefined,
          fallbackUsed: data.fallbackUsed === true,
          fallbackFrom: typeof data.fallbackFrom === "string" ? data.fallbackFrom : null,
          fallbackReason: typeof data.fallbackReason === "string" ? data.fallbackReason : null
        });
        setLastEngine(data.engine || "");
        setLastEngineMode(data.mode || "");
        setLastEngineReason(data.engineReason || "");
        setLastEngineModel(data.engineModel || data.model || "");
        setLastEngineLatencyMs(typeof data.engineLatencyMs === "number" ? data.engineLatencyMs : (data.latencyMs ?? Date.now() - startedAt));
        setLastEngineTimeoutMs(typeof data.engineTimeoutMs === "number" ? data.engineTimeoutMs : null);
        setLastEngineProvider(data.provider || "");
        setLastFallbackUsed(data.fallbackUsed === true);
        setLastFallbackFrom(typeof data.fallbackFrom === "string" ? data.fallbackFrom : "");
        setLastFallbackReason(typeof data.fallbackReason === "string" ? data.fallbackReason : "");
        setLastDeterministic(data.deterministicAnswer === true);
        setProviderCheckMessage(formatChatEngineStatus({
          engine: data.engine,
          mode: data.mode,
          provider: data.provider,
          model: data.engineModel || data.model,
          latencyMs: data.engineLatencyMs ?? data.latencyMs ?? (Date.now() - startedAt),
          timeoutMs: data.engineTimeoutMs,
          reason: data.mode === "error" && data.engineReason === "llm-timeout"
            ? "llm-timeout"
            : data.mode === "error"
              ? (data.message || data.engineReason || "provider-error")
              : data.engineReason,
          fallbackUsed: data.fallbackUsed === true,
          fallbackFrom: typeof data.fallbackFrom === "string" ? data.fallbackFrom : null,
          fallbackReason: typeof data.fallbackReason === "string" ? data.fallbackReason : null
        }));
      } else {
        const rawMsg = data.error || "Provider not configured.";
        const msg = data.source === "missing"
          ? `${rawMsg} Check Settings to configure a provider.`
          : rawMsg;
        setAiProposal("");
        setAiStructuredProposal(null);
        setAiHasProposal(false);
        pushChatMessage({
          role: "assistant",
          text: msg,
          provider: data.provider,
          model: data.model,
          source: data.source,
          latencyMs: data.latencyMs ?? (Date.now() - startedAt),
          retryPrompt: prompt,
          fallbackUsed: data.fallbackUsed === true,
          fallbackFrom: typeof data.fallbackFrom === "string" ? data.fallbackFrom : null,
          fallbackReason: typeof data.fallbackReason === "string" ? data.fallbackReason : null
        });
        if (data.message) setProviderCheckMessage(data.message);
      }
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const detail = error instanceof Error ? error.message : String(error);
      const isTimeout = detail.includes("abort") || detail.includes("timeout") || elapsed > 25000;
      const lastModel = chatProviderStatus?.message || providerCheckMessage || "the local model";
      const msg = isTimeout
        ? `${lastModel} timed out after ${(elapsed / 1000).toFixed(1)}s. Ollama is still configured — click Retry to try again, or use a shorter prompt.`
        : `Request failed (${lastModel} is configured): ${detail}`;
      setProviderCheckMessage(msg);
      setAiHasProposal(false);
      setAiStructuredProposal(null);
      pushChatMessage({ role: "assistant", text: msg, latencyMs: elapsed, retryPrompt: prompt });
    } finally {
      setAiProposalPending(false);
      scrollChatToBottom();
    }
  }

  function applyAiProposal() {
    if (!aiStructuredProposal?.replaceText) return;
    const targetId = aiProposalBlockId || selectedBlockId;
    if (!targetId) {
      setStatus("No block selected to apply suggestion to");
      return;
    }
    if (!selectedPage) return;
    setAiUndoSnapshot({ pageId: selectedPage.id, blocks: JSON.parse(JSON.stringify(selectedPage.blocks)) });
    const mutator = (b: Block): Block => {
      const bd = b.data as Record<string, unknown>;
      const tf = aiStructuredProposal.targetField;
      if (tf === "heading" && typeof bd.heading === "string") {
        return { ...b, data: { ...b.data, heading: aiStructuredProposal.replaceText } };
      }
      if (tf === "subheading" && typeof bd.subheading === "string") {
        return { ...b, data: { ...b.data, subheading: aiStructuredProposal.replaceText } };
      }
      if (tf === "body" && typeof bd.body === "string") {
        return { ...b, data: { ...b.data, body: aiStructuredProposal.replaceText } };
      }
      if (typeof bd.subheading === "string") {
        return { ...b, data: { ...b.data, subheading: aiStructuredProposal.replaceText } };
      }
      if (typeof bd.heading === "string") {
        return { ...b, data: { ...b.data, heading: aiStructuredProposal.replaceText } };
      }
      if (typeof bd.body === "string") {
        return { ...b, data: { ...b.data, body: aiStructuredProposal.replaceText } };
      }
      if (typeof bd.text === "string") {
        return { ...b, data: { ...b.data, text: aiStructuredProposal.replaceText } };
      }
      return b;
    };
    patchCurrentPage({ ...selectedPage, blocks: updateBlock(selectedPage.blocks, targetId, mutator) });
    setDirty(true);
    setLastAction("ai-apply-proposal");
    setStatus("AI suggestion applied to local editor state. Save to persist.");
    setAiProposal("");
    setAiStructuredProposal(null);
    setAiProposalBlockId("");
    setAiProposalBlockType("");
  }

  function undoAiChange() {
    if (!aiUndoSnapshot || !selectedPage) return;
    if (selectedPage.id !== aiUndoSnapshot.pageId) {
      setAiUndoSnapshot(null);
      return;
    }
    patchCurrentPage({ ...selectedPage, blocks: aiUndoSnapshot.blocks });
    setDirty(true);
    setLastAction("ai-undo");
    setStatus("AI change undone.");
    setAiUndoSnapshot(null);
  }

  function clearAiChat() {
    setAiProposal("");
    setAiStructuredProposal(null);
    setAiProposalBlockId("");
    setAiProposalBlockType("");
    setAiHasProposal(false);
    setChatHistory([]);
    setChatInput("");
    setChatClearedAt(Date.now());
    setAiUndoSnapshot(null);
    setAiHistoryView(false);
    setProviderCheckMessage("Visible chat cleared. Saved history stays hidden until you explicitly restore it.");
  }

  async function loadChatHistory() {
    try {
      const data = await fetchJson<{ ok: boolean; messages?: Array<{ role: string; text: string; timestamp: number; provider?: string; model?: string; source?: string; latencyMs?: number }> }>("/api/ai/chat/history");
      if (data.ok && Array.isArray(data.messages) && data.messages.length > 0) {
        const items: ChatItem[] = data.messages.map((m, i) => ({
          id: `history-${m.timestamp}-${i}`,
          role: m.role as "user" | "assistant",
          text: m.text,
          timestamp: m.timestamp,
          provider: m.provider,
          model: m.model,
          source: m.source,
          latencyMs: m.latencyMs
        }));
        setChatHistory(items);
        if (aiTopMenuTab === "chat") {
          scrollChatToBottom();
        }
      }
    } catch {
      // silently ignore - history is optional
    }
  }

  async function deleteChatHistory() {
    if (!window.confirm("Delete all chat history for this project? This cannot be undone.")) return;
    try {
      await fetchJson<{ ok: boolean }>("/api/ai/chat/history", { method: "DELETE", body: JSON.stringify({}) });
      setChatHistory([]);
      setAiProposal("");
      setAiStructuredProposal(null);
      setAiHasProposal(false);
      setProviderCheckMessage("Chat history deleted.");
    } catch {
      setProviderCheckMessage("Failed to delete chat history.");
    }
  }

  const [chatSaveStatus, setChatSaveStatus] = useState("");

  function saveChat() {
    if (chatHistory.length === 0) return;
    void (async () => {
      try {
        const data = await fetchJson<{ ok: boolean; savedAt?: string; message?: string }>("/api/ai/chat/save", {
          method: "POST",
          body: JSON.stringify({
            messages: chatHistory.map((m) => ({
              role: m.role,
              text: m.text,
              timestamp: m.timestamp,
              provider: m.provider || undefined,
              model: m.model || undefined,
              source: m.source || undefined,
              latencyMs: m.latencyMs != null ? m.latencyMs : undefined
            }))
          })
        });
        if (data.ok) {
          const time = data.savedAt ? new Date(data.savedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
          setChatSaveStatus(`Saved at ${time}`);
          setTimeout(() => setChatSaveStatus(""), 3000);
        } else {
          setChatSaveStatus("Save failed.");
          setTimeout(() => setChatSaveStatus(""), 3000);
        }
      } catch {
        setChatSaveStatus("Save failed.");
        setTimeout(() => setChatSaveStatus(""), 3000);
      }
    })();
  }

  const [aiHistoryView, setAiHistoryView] = useState(false);
  const [aiHistoryMessages, setAiHistoryMessages] = useState<ChatItem[]>([]);

  function restoreChat() {
    void (async () => {
      try {
        const data = await fetchJson<{ ok: boolean; messages?: Array<{ role: string; text: string; timestamp: number; provider?: string; model?: string; source?: string; latencyMs?: number }> }>("/api/ai/chat/history");
        if (data.ok && Array.isArray(data.messages)) {
          const items: ChatItem[] = data.messages.map((m, i) => ({
            id: `restore-${m.timestamp}-${i}`,
            role: m.role as "user" | "assistant",
            text: m.text,
            timestamp: m.timestamp,
            provider: m.provider,
            model: m.model,
            source: m.source,
            latencyMs: m.latencyMs
          }));
          setChatHistory(items);
          setProviderCheckMessage(`Restored ${items.length} messages.`);
          setTimeout(() => setProviderCheckMessage(""), 3000);
          scrollChatToBottom();
        } else {
          setProviderCheckMessage("No saved history to restore.");
          setTimeout(() => setProviderCheckMessage(""), 3000);
        }
      } catch {
        setProviderCheckMessage("Failed to restore chat.");
        setTimeout(() => setProviderCheckMessage(""), 3000);
      }
    })();
  }

  function viewHistory() {
    void (async () => {
      try {
        const data = await fetchJson<{ ok: boolean; messages?: Array<{ role: string; text: string; timestamp: number; provider?: string; model?: string; source?: string; latencyMs?: number }> }>("/api/ai/chat/history");
        if (data.ok && Array.isArray(data.messages) && data.messages.length > 0) {
          setAiHistoryMessages(data.messages.map((m, i) => ({
            id: `histview-${m.timestamp}-${i}`,
            role: m.role as "user" | "assistant",
            text: m.text,
            timestamp: m.timestamp,
            provider: m.provider,
            model: m.model,
            source: m.source,
            latencyMs: m.latencyMs
          })));
          setAiHistoryView(true);
        } else {
          setProviderCheckMessage("No saved history.");
          setTimeout(() => setProviderCheckMessage(""), 3000);
        }
      } catch {
        setProviderCheckMessage("Failed to load history.");
        setTimeout(() => setProviderCheckMessage(""), 3000);
      }
    })();
  }

  function stripRawProposalJson(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"kind"\s*:\s*"replace-copy"[\s\S]*?```/gi, "").trim();
    cleaned = cleaned.replace(/\{\s*"kind"\s*:\s*"replace-copy"\s*,\s*"replaceText"\s*:\s*"[^"]*"\s*\}/g, "").trim();
    if (cleaned) return cleaned;
    const inlineMatch = text.match(/"replaceText"\s*:\s*"([^"]+)"/);
    if (inlineMatch) return `The suggested replacement is: "${inlineMatch[1]}"`;
    return text;
  }

  function renderChatMessage(msg: ChatItem) {
    const displayText = msg.role === "assistant" ? stripRawProposalJson(msg.text) : msg.text;
    return (
      <div key={msg.id} className={`ai-chat-msg ai-chat-msg-${msg.role}`}>
        <div className="ai-chat-msg-role">{msg.role === "user" ? "You" : "AI"}</div>
        <div className="ai-chat-msg-text">{displayText}</div>
        {msg.retryPrompt && (
          <button
            className="ai-chat-retry-btn"
            onClick={() => setChatInput(msg.retryPrompt!)}
            title="Put this prompt back in the input to retry"
          >Retry</button>
        )}
        <div className="ai-chat-msg-footer">{chatFooterText(msg)}</div>
      </div>
    );
  }

  async function aiGenerateImage() {
    const prompt = aiImgGenPrompt.trim();
    if (!prompt) { setAiImgGenStatus("Enter an image prompt first."); return; }
    if (aiImgGenPreviewId) {
      try {
        await fetchJson(`/api/ai/preview-image/${encodeURIComponent(aiImgGenPreviewId)}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    setAiImgGenStatus("Generating image...");
    setAiImgGenResult("");
    setAiImgGenPreviewId("");
    setAiImgGenIsPreview(true);
    try {
      const targetContext = currentTargetContext();
      const stylePreset = IMAGE_GEN_STYLE_PRESETS.find((s) => s.id === imageGenStyle);
      const sizePreset = IMAGE_GEN_SIZE_PRESETS.find((s) => s.id === imageGenSize);
      let finalPrompt = prompt;
      if (stylePreset && stylePreset.id !== "custom" && stylePreset.promptSuffix) {
        finalPrompt = `${prompt}\n\n${stylePreset.promptSuffix}`;
      }
      const data = await fetchJson<{ ok: boolean; previewOnly?: boolean; previewId?: string; unavailable?: boolean; message?: string; imageUrl?: string; error?: string; warnings?: string[] }>("/api/ai/image", {
        method: "POST",
        body: JSON.stringify({ prompt: finalPrompt, targetContext, explicitSize: sizePreset?.providerSize || undefined, preview: true })
      });
      if (!data.ok || !data.imageUrl) {
        setAiImgGenStatus(data.message || data.error || "Image generation unavailable.");
        return;
      }
      setAiImgGenResult(data.imageUrl);
      setAiImgGenPreviewId(data.previewId || "");
      setAiImgGenIsPreview(data.previewOnly !== false);
      setAiImgGenStatus(`Image generated.${(data.warnings || []).join(" ")} Preview only — use Save to Library, Apply, or Save and Apply.`);
    } catch (error) {
      setAiImgGenStatus(`Image generation unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function aiSavePreviewToLibrary(): Promise<void> {
    if (!aiImgGenPreviewId) {
      setAiImgGenStatus("No preview to save. Generate an image first.");
      return;
    }
    try {
      const data = await fetchJson<{ ok: boolean; imageUrl?: string; error?: string }>(`/api/ai/preview-image/${encodeURIComponent(aiImgGenPreviewId)}/promote`, {
        method: "POST",
        body: JSON.stringify({ promptHint: aiImgGenPrompt.slice(0, 64) })
      });
      if (!data.ok || !data.imageUrl) {
        setAiImgGenStatus(data.error || "Save failed.");
        return;
      }
      setAiImgGenResult(data.imageUrl);
      setAiImgGenIsPreview(false);
      setAiImgGenPreviewId("");
      setAiImgGenStatus("Saved to Image Library. Use Apply to push it to the selected block.");
      await loadImages();
    } catch (error) {
      setAiImgGenStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function aiApplyPreviewToBlock(): Promise<void> {
    if (!aiImgGenResult) {
      setAiImgGenStatus("No preview to apply. Generate an image first.");
      return;
    }
    let urlToApply = aiImgGenResult;
    if (aiImgGenIsPreview && aiImgGenPreviewId) {
      try {
        const data = await fetchJson<{ ok: boolean; imageUrl?: string; error?: string }>(`/api/ai/preview-image/${encodeURIComponent(aiImgGenPreviewId)}/promote`, {
          method: "POST",
          body: JSON.stringify({ promptHint: aiImgGenPrompt.slice(0, 64) })
        });
        if (data.ok && data.imageUrl) {
          setAiImgGenResult(data.imageUrl);
          urlToApply = data.imageUrl;
          setAiImgGenIsPreview(false);
          setAiImgGenPreviewId("");
          await loadImages();
        }
      } catch { /* fall through and try to apply the preview URL directly */ }
    }
    if (!selectedBlock) {
      setAiImgGenStatus("Select a block first, then apply.");
      return;
    }
    applyImageToSelectedBlock(urlToApply, "AI generated image");
    setDirty(true);
    setLastAction("ai-apply-image");
    setAiImgGenStatus("Applied to selected block. Save project to persist.");
  }

  async function aiSaveAndApplyPreview(): Promise<void> {
    await aiSavePreviewToLibrary();
    if (aiImgGenResult && selectedBlock) {
      applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
      setDirty(true);
      setLastAction("ai-save-apply-image");
      setAiImgGenStatus("Saved to Image Library AND applied to selected block. Save project to persist.");
    } else if (aiImgGenResult) {
      setAiImgGenStatus("Saved to Image Library. Select a block to apply.");
    }
  }

  async function aiDiscardPreview(): Promise<void> {
    if (aiImgGenPreviewId) {
      try {
        await fetchJson(`/api/ai/preview-image/${encodeURIComponent(aiImgGenPreviewId)}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    setAiImgGenResult("");
    setAiImgGenPreviewId("");
    setAiImgGenIsPreview(false);
    setAiImgGenStatus("Preview discarded.");
  }

  function aiUseImageInBlock() {
    if (!aiImgGenResult) return;
    const placement = imageGenPlacement;
    if (placement === "preview-only" || placement === "save-library") {
      setAiImgGenStatus("Preview only — nothing applied. Use Save to Library or Apply to Selected Block to make changes.");
      return;
    }
    const block = selectedBlock;
    if (!block || (block.type !== "image" && block.type !== "hero" && block.type !== "gallery" && block.type !== "cards")) {
      setAiImgGenStatus("Select an image, hero, or gallery block first.");
      return;
    }
    if (placement === "fit-block") {
      if (block.type === "hero" || block.type === "cards") {
        patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: aiImgGenResult, backgroundSize: "contain", backgroundPosition: "center center" } }));
      } else if (block.type === "image") {
        patchSelectedBlock((b) => ({ ...b, data: { ...(b.data as ImageBlockData), src: aiImgGenResult, alt: "AI generated image" }, styles: { ...(b.styles || {}), backgroundSize: "contain" } }));
      } else {
        applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
      }
    } else if (placement === "fill-block") {
      if (block.type === "hero" || block.type === "cards") {
        patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: aiImgGenResult, backgroundSize: "fill", backgroundPosition: "center center" } }));
      } else {
        patchSelectedBlock((b) => ({ ...b, data: { ...(b.data as ImageBlockData), src: aiImgGenResult, alt: "AI generated image" }, styles: { ...(b.styles || {}), backgroundSize: "fill" } }));
      }
    } else if (placement === "center-focal") {
      if (block.type === "hero" || block.type === "cards") {
        patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: aiImgGenResult, backgroundSize: "cover", backgroundPosition: "center center" } }));
      } else {
        applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
      }
    } else if (placement === "top-center") {
      if (block.type === "hero" || block.type === "cards") {
        patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: aiImgGenResult, backgroundSize: "cover", backgroundPosition: "center top" } }));
      } else {
        applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
      }
    } else if (placement === "bottom-center") {
      if (block.type === "hero" || block.type === "cards") {
        patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: aiImgGenResult, backgroundSize: "cover", backgroundPosition: "center bottom" } }));
      } else {
        applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
      }
    } else {
      applyImageToSelectedBlock(aiImgGenResult, "AI generated image");
    }
    setDirty(true);
    setLastAction("ai-use-image");
    setAiImgGenStatus("Image applied to selected block. Save to persist.");
  }

  async function aiSaveImageToLibrary() {
    if (!aiImgGenResult) return;
    setAiImgGenStatus("Image saved to library.");
  }

  async function aiAddImageToGallery() {
    if (!aiImgGenResult) return;
    const block = selectedBlock;
    if (!block || block.type !== "gallery") {
      setAiImgGenStatus("Select a gallery block first to add image.");
      return;
    }
    addGalleryImage(aiImgGenResult);
    setDirty(true);
    setAiImgGenStatus("Image added to gallery. Save to persist.");
  }

  function clearAiImageGen() {
    setAiImgGenPrompt("");
    setAiImgGenStatus("");
    setAiImgGenResult("");
  }

  function getSelectedEnhanceSource(): {
    kind: "image-block" | "gallery-image" | "background" | "gallery-empty" | "none";
    blockId?: string;
    blockType?: string;
    imageIndex?: number;
    src?: string;
    label: string;
    reason?: string;
  } {
    const block = selectedBlock;
    if (!block) {
      return { kind: "none", label: "No block selected", reason: "Select an image block, gallery image, or background first." };
    }
    if (block.type === "gallery" && selectedGalleryIndex !== null) {
      const galleryData = block.data as GalleryBlockData;
      const slot = galleryData.images[selectedGalleryIndex];
      if (slot && slot.src) {
        return { kind: "gallery-image", blockId: block.id, blockType: "gallery", imageIndex: selectedGalleryIndex, src: slot.src, label: `Gallery image ${selectedGalleryIndex + 1}` };
      }
      return { kind: "gallery-empty", blockId: block.id, blockType: "gallery", imageIndex: selectedGalleryIndex, label: `Gallery image ${selectedGalleryIndex + 1}`, reason: "Selected gallery image has no image set." };
    }
    if (block.type === "image") {
      const imageData = block.data as ImageBlockData;
      if (imageData.src) {
        return { kind: "image-block", blockId: block.id, blockType: "image", src: imageData.src, label: "Image block" };
      }
      return { kind: "none", blockId: block.id, blockType: "image", label: "Image block — no image set", reason: "Select an image block, gallery image, or background first." };
    }
    if (block.type === "hero") {
      const bgImage = block.styles?.backgroundImage || "";
      if (bgImage) {
        return { kind: "background", blockId: block.id, blockType: "hero", src: bgImage, label: "Hero background" };
      }
    }
    const bgImage = block.styles?.backgroundImage || "";
    if (bgImage) {
      return { kind: "background", blockId: block.id, blockType: block.type, src: bgImage, label: `${blockTypeLabels[block.type] || block.type} background` };
    }
    return { kind: "none", label: "No image source", reason: "Select an image block, gallery image, or background first." };
  }

  function hasSelectedImageTarget(): boolean {
    if (!selectedBlock) return false;
    return selectedBlock.type === "image" || selectedBlock.type === "hero" || selectedBlock.type === "gallery";
  }

  async function aiEnhanceImage() {
    const overrideSrc = aiEnhanceSourceOverride;
    const source = overrideSrc ? { kind: "override" as const, src: overrideSrc, label: "Generated image", reason: undefined } : getSelectedEnhanceSource();
    if (!source.src) {
      setAiEnhanceStatus(source.reason || "Select an image block, gallery image, or background first.");
      return;
    }
    setAiEnhanceStatus("Processing image...");
    setAiEnhanceResult("");
    try {
      const data = await fetchJson<{ ok: boolean; unavailable?: boolean; message?: string; editedImageUrl?: string; error?: string }>("/api/ai/image-edit", {
        method: "POST",
        body: JSON.stringify({
          imagePath: source.src,
          editType: aiEnhanceType,
          instruction: aiEnhancePrompt,
          targetContext: currentTargetContext()
        })
      });
      if (!data.ok || !data.editedImageUrl) {
        setAiEnhanceStatus(data.message || data.error || "Image enhancement unavailable.");
        return;
      }
      setAiEnhanceResult(data.editedImageUrl);
      setAiEnhanceStatus("Enhanced image ready. Source locked to enhanced image for further edits.");
      setAiEnhanceSourceOverride(data.editedImageUrl);
    } catch (error) {
      setAiEnhanceStatus(`Image enhancement unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function applyAiEnhancedImage() {
    if (!aiEnhanceResult) return;
    applyImageToSelectedBlock(aiEnhanceResult, `AI enhanced (${aiEnhanceType})`);
    setDirty(true);
    setLastAction("ai-apply-enhance");
    setAiEnhanceStatus("Enhanced image applied. Save to persist.");
    setImageEditApplied(true);
  }

  function openImageEditModal(src: string, label: string) {
    setAiEnhanceSourceOverride(src);
    setAiEnhanceSourceLabel(label);
    setAiEnhanceResult("");
    setAiEnhanceStatus("");
    setAiEnhanceType("enhance");
    setImageEditSnapshot({ src, label, openedAt: Date.now() });
    setImageEditApplied(false);
    setImageEditModalTab("options");
    setImageEditModalOpen(true);
  }

  function closeImageEditModal() {
    setImageEditModalOpen(false);
  }

  function cancelImageEditModal() {
    setImageEditModalOpen(false);
    setImageEditSnapshot(null);
    setAiEnhanceResult("");
    setAiEnhanceStatus("");
    setAiEnhanceType("enhance");
    setImageEditCustomInstruction("");
  }

  function clearAiEnhance() {
    setAiEnhanceStatus("");
    setAiEnhanceResult("");
    setAiEnhancePrompt("");
    setAiEnhanceSourceOverride(null);
  }

  function targetSummary(): string {
    if (selectedSitePart === "site-header") return "Target: Site header - whole header";
    if (selectedSitePart === "site-title") return "Target: Site header - site title";
    if (selectedSitePart === "nav" && selectedNavIndex !== null) return `Target: Site header - nav link ${selectedNavIndex + 1}`;
    if (!selectedBlock) return "Target: none selected yet";
    const blockLabel = blockTypeLabels[selectedBlock.type] || selectedBlock.type;
    const blockIdShort = selectedBlock.id.length > 14 ? `${selectedBlock.id.slice(0, 14)}...` : selectedBlock.id;
    if (selectedBlock.type === "gallery" && selectedGalleryIndex !== null) return `Target: ${blockLabel} #${blockIdShort} - image ${selectedGalleryIndex + 1}`;
    if (selectedBlock.type === "gallery") return `Target: ${blockLabel} #${blockIdShort} - add to gallery`;
    if (selectedBlock.type === "image") return `Target: ${blockLabel} #${blockIdShort} - photo`;
    if (selectedBlock.type === "hero") return `Target: ${blockLabel} #${blockIdShort} - background`;
    return `Target: ${blockLabel} #${blockIdShort} - background`;
  }

  function mobileDrawerHeading(): string {
    if (selectedSitePart === "site-header") return "Editing Site header";
    if (selectedSitePart === "site-title") return "Editing Site title";
    if (selectedSitePart === "nav" && selectedNavIndex !== null) return `Editing Nav link ${selectedNavIndex + 1}`;
    if (!selectedBlock) return "Edit selection";
    const blockLabel = blockTypeLabels[selectedBlock.type] || selectedBlock.type;
    return `Editing ${blockLabel}`;
  }

  function showImagesAction(): boolean {
    if (!selectedBlock) return false;
    return selectedBlock.type === "gallery" || selectedBlock.type === "image" || selectedBlock.type === "hero";
  }

  function contentActionLabel(): string {
    if (!selectedBlock) return "No image content target selected";
    if (selectedBlock.type === "gallery") return selectedGalleryIndex !== null ? `Replace Gallery image ${selectedGalleryIndex + 1}` : "Add to Gallery (append new image)";
    if (selectedBlock.type === "image") return "Set as this Image block's photo";
    return "Select an Image block or Gallery image slot to use this as image content.";
  }

  function cropFitTargetLabel(): string {
    if (!selectedBlock) return "Select a block, Image block, or Gallery image slot first.";
    if (selectedBlock.type === "gallery") return selectedGalleryIndex !== null ? `Gallery image ${selectedGalleryIndex + 1}` : "Select a Gallery image slot first.";
    if (selectedBlock.type === "hero") return "Hero background";
    if (selectedBlock.type === "image") return "Image block photo";
    return `${blockTypeLabels[selectedBlock.type] || selectedBlock.type} background`;
  }

  function hasValidCropFitTarget(): boolean {
    return Boolean(selectedBlock && (selectedBlock.type !== "gallery" || selectedGalleryIndex !== null));
  }

  function setSelectedBlockBackground(url: string) {
    if (!selectedBlock || !url) return;
    patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: url, backgroundSize: "cover", backgroundPosition: "center center" } }));
    setStatus(selectedBlock.type === "hero" ? "Set as Hero background" : `Set as ${blockTypeLabels[selectedBlock.type] || selectedBlock.type} background`);
  }

  function replaceImageBlockPhoto(url: string, altText = "Selected image") {
    if (!url) return;
    patchSelectedBlock((b) => ({ ...b, data: { ...(b.data as Record<string, unknown>), src: url, alt: altText } }));
    setStatus("Image block photo updated.");
  }

  function replaceGalleryImage(url: string, altText = "Selected gallery image") {
    if (!selectedBlock || selectedBlock.type !== "gallery" || selectedGalleryIndex === null || !url) return;
    const targetNumber = selectedGalleryIndex + 1;
    patchSelectedBlock((b) => {
      const data = b.data as GalleryBlockData;
      if (selectedGalleryIndex < 0 || selectedGalleryIndex >= data.images.length) return b;
      const images = [...data.images];
      images[selectedGalleryIndex] = { ...images[selectedGalleryIndex], src: url, alt: altText };
      return { ...b, data: { ...data, images } };
    });
    setStatus(`Replaced Gallery image ${targetNumber}`);
  }

  function addGalleryImage(url: string, altText = "Gallery image") {
    if (!selectedBlock || selectedBlock.type !== "gallery" || !url) return;
    patchSelectedBlock((b) => {
      const data = b.data as GalleryBlockData;
      const images = [...data.images, { id: `g-${Date.now()}`, src: url, alt: altText }];
      return { ...b, data: { ...data, images } };
    });
    setStatus("Added image to Gallery");
  }

  function applySelectedImageContent(url: string) {
    if (!selectedBlock || !url) return;
    if (selectedBlock.type === "image") {
      replaceImageBlockPhoto(url);
      return;
    }
    if (selectedBlock.type === "gallery") {
      if (selectedGalleryIndex !== null) replaceGalleryImage(url);
      else addGalleryImage(url);
    }
  }

  function openImageManager(target: "block-bg" | "part-bg" | "hero" | "image-block") {
    setImageManagerTarget(target);
    setImageManagerOpen(true);
  }

  function applyImageFromManager(url: string) {
    if (!selectedBlock || !selectedPage) return;
    if (imageManagerTarget === "part-bg") {
      updateSelectedPartStyle({ backgroundImage: url, backgroundFit: "cover" });
    } else if (imageManagerTarget === "block-bg") {
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundImage: url,
          backgroundSize: "cover",
          backgroundPosition: "center center"
        }
      }));
    } else if (imageManagerTarget === "hero") {
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundImage: url,
          backgroundSize: "cover",
          backgroundPosition: "center center"
        }
      }));
    } else if (imageManagerTarget === "image-block") {
      patchSelectedBlock((b) => ({
        ...b,
        data: { ...(b.data as Record<string, unknown>), src: url, alt: "Selected image" }
      }));
    }
    setImageManagerOpen(false);
    setStatus(`Applied image to ${friendlySelectedLabel()}`);
  }

  function currentTargetContext(): ImageTargetContext {
    return {
      blockType: blockTypeForTarget(selectedBlock),
      usage: usageForTarget(selectedBlock),
      viewportHint: deviceMode === "phone" ? "mobile" : deviceMode === "tablet" ? "tablet" : "desktop",
      aspectRatioHint: inferAspectRatioHint(selectedBlock),
      currentBlockId: selectedBlock?.id,
      currentImagePath: selectedBlock?.type === "image" ? (selectedBlock.data as ImageBlockData).src : selectedBlock?.type === "gallery" && selectedGalleryIndex !== null ? (selectedBlock.data as GalleryBlockData).images[selectedGalleryIndex]?.src : undefined,
      cropMode: selectedBlock?.type === "hero" ? "cover" : selectedBlock?.type === "image" ? "contain" : "cover",
      imageSlot: selectedGalleryIndex !== null ? selectedGalleryIndex : undefined
    };
  }

  function applyImageToSelectedBlock(nextImage: string, altText: string) {
    if (!selectedPage || !nextImage) return;
    if (selectedBlock?.type === "image") {
      patchSelectedBlock((b) => ({ ...b, data: { ...(b.data as ImageBlockData), src: nextImage, alt: altText, caption: (b.data as ImageBlockData).caption || "AI image" } }));
      return;
    }
    if (selectedBlock?.type === "hero") {
      patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: nextImage, backgroundSize: "cover", backgroundPosition: "center center" } }));
      return;
    }
    if (selectedBlock?.type === "gallery") {
      patchSelectedBlock((b) => {
        const data = b.data as GalleryBlockData;
        const images = [...data.images];
        if (selectedGalleryIndex !== null && selectedGalleryIndex >= 0 && selectedGalleryIndex < images.length) {
          images[selectedGalleryIndex] = { ...images[selectedGalleryIndex], src: nextImage, alt: altText };
        } else {
          images.push({ id: `g-${Date.now()}`, src: nextImage, alt: altText });
        }
        return { ...b, data: { ...data, images } };
      });
      return;
    }
    if (selectedBlock?.type === "cards") {
      patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: nextImage, backgroundSize: "cover", backgroundPosition: "center center" } }));
      return;
    }
    const imgBlock = defaultBlock("image");
    imgBlock.data = { src: nextImage, alt: altText, caption: "Applied image" } as ImageBlockData;
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, imgBlock] });
    setSelectedBlockId(imgBlock.id);
  }

  async function saveProject() {
    const latestProject = projectRef.current;
    if (!latestProject) return;
    setStatus("Saving...");
    try {
      const data = await fetchJson<{ ok: boolean; lastSavedAt?: string; projectPath?: string }>("/api/project", { method: "PUT", body: JSON.stringify({ project: latestProject }) });
      if (!data.ok) throw new Error("Server reported the save did not succeed");
      setLastSavedAt(data.lastSavedAt || new Date().toISOString());
      setProjectPath(data.projectPath || projectPath);
      setDirty(false);
      setStatus("Saved");
      setLastAction("save");
    } catch (error) {
      // Keep unsaved state so the user can retry; never leave the UI stuck at "Saving...".
      const failure = getSaveFailureState(error);
      setDirty(failure.dirty);
      setStatus(failure.status);
      setLastAction(failure.lastAction);
    }
  }

  async function revertProject() {
    setStatus("Reverting to last save...");
    try {
      const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/project");
      if (data.ok && data.project) {
        const migrated = { ...data.project, pages: migrateLegacyProject(data.project.pages) };
        setProject(migrated);
        setDirty(false);
        setStatus("Reverted to last save");
        setLastAction("revert");
      } else {
        setStatus("Revert failed: no saved project found");
      }
    } catch {
      setStatus("Revert failed: could not load project");
    }
  }

  async function runBuild() {
    setStatus("Building static site...");
    const data = await fetchJson<{ ok: boolean; result?: { outputDir: string } }>("/api/build", { method: "POST", body: "{}" });
    setStatus(data.ok ? `Build complete: ${data.result?.outputDir}` : "Build failed");
    setLastAction("build");
  }

  async function runPublish() {
    setStatus("Publishing...");
    const data = await fetchJson<{ ok: boolean; dryRun?: boolean; target?: string }>("/api/publish", { method: "POST", body: "{}" });
    if (data.ok) { setStatus(data.dryRun ? `Dry-run publish complete → ${data.target}` : `Published → ${data.target}`); setLastAction("publish"); }
  }

  async function chat() {
    if (!chatInput.trim()) return;
    const prompt = chatInput.trim();
    pushChatMessage({ role: "user", text: prompt });
    setChatInput("");
    const startedAt = Date.now();
    try {
      const data = await fetchJson<{ response: string; provider?: string; model?: string; source?: string; message?: string; latencyMs?: number; engine?: string; mode?: string; engineModel?: string; engineLatencyMs?: number; engineTimeoutMs?: number | null; engineReason?: string; deterministicAnswer?: boolean; fallbackUsed?: boolean; fallbackFrom?: string | null; fallbackReason?: string | null }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ prompt, chatHistory: chatHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })), projectContext: project, selectedBlockId: selectedBlockId || undefined, selectedPageId: selectedPageId || undefined }) });
      const isTimeoutMsg = typeof data.response === "string" && /timed out/i.test(data.response);
      const engine = data.engine || (data.provider === "local"
        ? "local-ollama"
        : data.provider === "openai" || data.provider === "openrouter"
          ? "openai-api"
          : "unavailable");
      const mode = data.mode || (isTimeoutMsg ? "error" : "llm");
      const latency = data.engineLatencyMs ?? data.latencyMs ?? (Date.now() - startedAt);
      pushChatMessage({
        role: "assistant",
        text: data.response,
        provider: data.provider,
        model: data.model,
        source: data.source,
        engine,
        mode,
        engineModel: data.engineModel || data.model,
        engineReason: data.engineReason || (isTimeoutMsg ? "llm-timeout" : "llm-ok"),
        latencyMs: latency,
        fallbackUsed: data.fallbackUsed === true,
        fallbackFrom: typeof data.fallbackFrom === "string" ? data.fallbackFrom : null,
        fallbackReason: typeof data.fallbackReason === "string" ? data.fallbackReason : null
      });
      setLastEngine(engine);
      setLastEngineMode(mode);
      setLastEngineReason(data.engineReason || (isTimeoutMsg ? "llm-timeout" : "llm-ok"));
      setLastEngineModel(data.engineModel || data.model || "");
      setLastEngineLatencyMs(latency);
      setLastEngineTimeoutMs(data.engineTimeoutMs ?? null);
      setLastEngineProvider(data.provider || "");
      setLastFallbackUsed(data.fallbackUsed === true);
      setLastFallbackFrom(typeof data.fallbackFrom === "string" ? data.fallbackFrom : "");
      setLastFallbackReason(typeof data.fallbackReason === "string" ? data.fallbackReason : "");
      setLastDeterministic(data.deterministicAnswer === true);
      setProviderCheckMessage(formatChatEngineStatus({
        engine,
        mode,
        provider: data.provider,
        model: data.engineModel || data.model,
        latencyMs: latency,
        timeoutMs: data.engineTimeoutMs,
        reason: mode === "error" && isTimeoutMsg
          ? "llm-timeout"
          : mode === "error"
            ? (data.message || data.engineReason || "provider-error")
            : data.engineReason,
        fallbackUsed: data.fallbackUsed === true,
        fallbackFrom: typeof data.fallbackFrom === "string" ? data.fallbackFrom : null,
        fallbackReason: typeof data.fallbackReason === "string" ? data.fallbackReason : null
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushChatMessage({ role: "assistant", text: `AI chat unavailable: ${message}`, latencyMs: Date.now() - startedAt });
    }
  }

  async function quickRewrite(mode: "rewrite" | "shorten" | "lengthen" | "tone") {
    if (!selectedBlock) return;
    const prompt = `${mode.toUpperCase()} this content: ${JSON.stringify(selectedBlock.data)}`;
    setChatInput(prompt);
    await chat();
  }

  async function runWizard() {
    const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/ai/wizard", { method: "POST", body: JSON.stringify(wizardForm) });
    if (data.ok) { setProject({ ...data.project, pages: migrateLegacyProject(data.project.pages) }); setDirty(true); setShowWizard(false); setStatus("Wizard applied"); setLastAction("wizard"); }
  }

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImage(true); setPhotoEditStatus("Uploading...");
    try {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("images", file));
      const response = await fetch("/api/images", { method: "POST", body });
      const data = (await response.json()) as { ok: boolean; uploads?: Array<{ url: string }> };
      if (!response.ok || !data.ok) { setPhotoEditStatus("Upload failed."); return; }
      const firstUrl = data.uploads?.[0]?.url;
      await loadImages();
      if (firstUrl) setSelectedUploadImage(firstUrl);
      setPhotoEditStatus("Upload complete."); setLastAction("upload-image");
    } catch (error) { setPhotoEditStatus(`Upload failed: ${String(error)}`); }
    finally { setUploadingImage(false); }
  }

  async function generateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt) { setImageStatus("Enter an image prompt first."); return; }
    const targetContext = currentTargetContext();
    setImageStatus("Generating image for selected block...");
    const data = await fetchJson<{ ok: boolean; unavailable?: boolean; message?: string; imageUrl?: string; originalImageUrl?: string; warnings?: string[]; sizeDecision?: ImageSizeDecision; error?: string }>("/api/ai/image", {
      method: "POST",
      body: JSON.stringify({ prompt, targetContext, explicitSize: providerSizeOverride || undefined })
    });
    if (data.sizeDecision) setImageSizeDecision(data.sizeDecision);
    const nextImage = data.imageUrl || "";
    const warningText = (data.warnings || []).join(" ");
    if (!data.ok || !nextImage) {
      setImageStatus(data.message || data.error || "Image generation unavailable.");
      if (warningText) setImageStatus((current) => `${current} ${warningText}`.trim());
      return;
    }
    setLastGeneratedImage(nextImage);
    setImageStatus(`Image ready for ${targetContext.blockType}.${warningText ? ` ${warningText}` : ""}`);
    setLastAction("image-generate");
    applyImageToSelectedBlock(nextImage, prompt);
  }

  async function applyPhotoEdit(overrides?: { editType?: string; instruction?: string }) {
    if (!selectedUploadImage) { setPhotoEditStatus("Select an uploaded image first."); return; }
    const type = overrides?.editType ?? photoEditType;
    const instruction = overrides?.instruction ?? photoEditInstruction;
    if (type === "crop-fit" && !hasValidCropFitTarget()) {
      setPhotoEditStatus("Crop/Fit is disabled: select a block, Image block, or Gallery image slot first.");
      return;
    }
    const targetContext = currentTargetContext();
    const data = await fetchJson<{ ok: boolean; unavailable?: boolean; message?: string; error?: string; editedImageUrl?: string; originalImageUrl?: string; sizeDecision?: ImageSizeDecision; warnings?: string[] }>("/api/images/edit", {
      method: "POST",
      body: JSON.stringify({ imagePath: selectedUploadImage, instruction, editType: type, targetContext })
    });
    if (data.sizeDecision) setImageSizeDecision(data.sizeDecision);
    if (!data.ok || !data.editedImageUrl) { setPhotoEditStatus(data.message || data.error || "Photo edit unavailable."); return; }
    setLastEditedImage(data.editedImageUrl);
    if (type === "crop-fit") {
      if (selectedBlock?.type === "gallery") replaceGalleryImage(data.editedImageUrl, `Edited photo (${type})`);
      else if (selectedBlock?.type === "image") replaceImageBlockPhoto(data.editedImageUrl, `Edited photo (${type})`);
      else setSelectedBlockBackground(data.editedImageUrl);
    } else {
      applyImageToSelectedBlock(data.editedImageUrl, `Edited photo (${type})`);
    }
    await loadImages();
    setPhotoEditStatus(`Edited photo ready for ${type === "crop-fit" ? cropFitTargetLabel() : targetSummary().replace(/^Target: /, "")}. ${(data.warnings || []).join(" ")}`.trim());
    setLastAction("photo-edit");
  }

  function renderCurrentTargetCard() {
    const showSitePart = selectedSitePart === "site-title" || selectedSitePart === "nav" || selectedSitePart === "site-header";
    return (
      <div className="image-target-card">
        <strong>{targetSummary()}</strong>
        {showSitePart && <span>Click a block to edit image content. Site header/nav fields appear in the Props tab.</span>}
        {!showSitePart && <span>{selectedBlock ? `Selected block: ${blockTypeLabels[selectedBlock.type] || selectedBlock.type} (${selectedBlock.id.slice(0, 8)})` : "Select an Image block or Gallery image slot to use image content actions."}</span>}
      </div>
    );
  }

  function renderImageManagerActions(closeAfterApply: boolean) {
    const hasImage = Boolean(selectedUploadImage);
    const canUseContent = selectedBlock?.type === "image" || selectedBlock?.type === "gallery";
    const cropTarget = cropFitTargetLabel();
    const isGalleryNoSlot = selectedBlock?.type === "gallery" && selectedGalleryIndex === null;
    const isGalleryWithSlot = selectedBlock?.type === "gallery" && selectedGalleryIndex !== null;
    return (
      <div className="image-manager-actions">
        {renderCurrentTargetCard()}
        <p className="hint">Selected image: {hasImage ? selectedUploadImage.split("/").pop() : "Choose a project image first."}</p>
        <div className="image-action-stack">
          <button
            onClick={() => {
              if (!selectedUploadImage) return;
              applySelectedImageContent(selectedUploadImage);
              if (closeAfterApply) setImageManagerOpen(false);
            }}
            disabled={!hasImage || !canUseContent}
            title={canUseContent ? contentActionLabel() : "Select an Image block or Gallery image slot to use this as image content."}
          >
            {contentActionLabel()}
          </button>
          {isGalleryNoSlot && <p className="hint action-explain">No gallery slot selected. This image will be appended as a new gallery item.</p>}
          {isGalleryWithSlot && <p className="hint action-explain">Selected gallery slot will be replaced. "Add to Gallery" appends a new image.</p>}
          {isGalleryNoSlot && <p className="hint action-explain">Select a gallery slot to replace a specific image, or use Add to Gallery to append.</p>}
          {!canUseContent && <p className="hint action-explain">Select an Image block or Gallery image slot to use this as image content.</p>}
          {isGalleryWithSlot && hasImage && (
            <button
              onClick={() => {
                if (!selectedUploadImage) return;
                addGalleryImage(selectedUploadImage);
                if (closeAfterApply) setImageManagerOpen(false);
              }}
            >
              Add to Gallery as new image
            </button>
          )}
          <button
            onClick={() => {
              if (!selectedUploadImage) return;
              setSelectedBlockBackground(selectedUploadImage);
              if (closeAfterApply) setImageManagerOpen(false);
            }}
            disabled={!hasImage || !selectedBlock}
          >
            {selectedBlock?.type === "hero" ? "Set as Hero background" : "Set as block background"}
          </button>
          {imageManagerTarget === "part-bg" && (
            <button
              onClick={() => {
                if (!selectedUploadImage) return;
                applyImageFromManager(selectedUploadImage);
                if (closeAfterApply) setImageManagerOpen(false);
              }}
              disabled={!hasImage || !selectedBlock}
            >
              Set as selected style image
            </button>
          )}
        </div>
        <div className="crop-fit-card">
          <strong>Crop/Fit target: {cropTarget}</strong>
          <button
            onClick={() => void applyPhotoEdit({ editType: "crop-fit", instruction: `Crop/fit to ${cropTarget}` })}
            disabled={!hasImage || !hasValidCropFitTarget()}
            title={hasValidCropFitTarget() ? `Crop/Fit and replace ${cropTarget}` : "Select a block, Image block, or Gallery image slot first."}
          >
            {hasValidCropFitTarget() ? `Crop/Fit and replace ${cropTarget}` : "Crop/Fit disabled"}
          </button>
          {!hasValidCropFitTarget() && <p className="hint action-explain">Select a block, Image block, or Gallery image slot first.</p>}
        </div>
        <div className="image-action-stack">
          <h4>Edit Selected Image</h4>
          <button
            data-testid="open-image-edit-modal"
            disabled={!hasImage}
            onClick={() => {
              if (!selectedUploadImage) return;
              const label = selectedUploadImage.split("/").pop() || "Selected image";
              openImageEditModal(selectedUploadImage, label);
            }}
          >
            Edit image (full options)
          </button>
          <button disabled={!hasImage} onClick={() => { setPhotoEditType("enhance"); setPhotoEditInstruction("Enhance"); void applyPhotoEdit({ editType: "enhance", instruction: "Enhance" }); }}>Quick Enhance</button>
          <button disabled={!hasImage} onClick={() => { setPhotoEditType("black-white"); setPhotoEditInstruction("Black and white"); void applyPhotoEdit({ editType: "black-white", instruction: "Black and white" }); }}>Quick B&amp;W</button>
        </div>
      </div>
    );
  }

  function duplicateBlock(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    const target = selectedPage.blocks.find((b) => b.id === targetId);
    if (!target) return;
    const copy: Block = { ...target, id: `${target.id}-copy-${Math.random().toString(36).slice(2, 6)}` };
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, copy] });
    setSelectedBlockId(copy.id);
    setSelectedGalleryIndex(null);
    setLastAction("duplicate-block");
  }

  function deleteBlock(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const next = selectedPage.blocks.filter((b) => b.id !== targetId);
    patchCurrentPage({ ...selectedPage, blocks: next });
    setSelectedBlockId(next[0]?.id || "");
    setSelectedGalleryIndex(null);
    setLastAction("delete-block");
    setContextMenu(null);
  }

  function moveBlock(direction: "up" | "down", blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const index = selectedPage.blocks.findIndex((b) => b.id === targetId);
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= selectedPage.blocks.length) return;
    patchCurrentPage({ ...selectedPage, blocks: move(selectedPage.blocks, index, to) });
    setLastAction(`move-${direction}`);
    setStatus(direction === "up" ? "Moved block up" : "Moved block down");
    setContextMenu(null);
  }

  function applyTheme(index: number) {
    if (!project) return;
    const theme = themePresets[index];
    const previousColors = project.globalStyles.colors;
    const nextGlobalColors = { ...project.globalStyles.colors, ...theme.colors };
    setSelectedThemeName(theme.name);
    const nextPages = project.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        const hasExplicitBg = !isThemeDerivedColor(block.styles?.backgroundColor, previousColors, "bg");
        const hasExplicitText = !isThemeDerivedColor(block.styles?.textColor, previousColors, "text");
        const nextParts = { ...(block.styles?.parts || {}) };
        for (const partKey of Object.keys(nextParts) as Array<keyof BlockPartStyles>) {
          const part = nextParts[partKey];
          if (!part) continue;
          nextParts[partKey] = {
            ...part,
            backgroundColor: isThemeDerivedColor(part.backgroundColor, previousColors, "bg") ? undefined : part.backgroundColor,
            textColor: isThemeDerivedColor(part.textColor, previousColors, "text") ? undefined : part.textColor,
            borderColor: isThemeDerivedColor(part.borderColor, previousColors, "border") ? undefined : part.borderColor
          };
        }
        return {
          ...block,
          styles: {
            ...(block.styles || {}),
            backgroundColor: hasExplicitBg ? block.styles?.backgroundColor : nextGlobalColors.blockBackground || theme.colors.surface,
            textColor: hasExplicitText ? block.styles?.textColor : nextGlobalColors.bodyTextColor || theme.colors.text,
            fontFamily: block.styles?.fontFamily || (block.type === "hero" || block.type === "text" || block.type === "cards" ? (theme.headingFont || project.globalStyles.headingFont) : (theme.bodyFont || project.globalStyles.bodyFont)),
            parts: nextParts
          }
        };
      })
    }));
    setProject({
      ...project,
      selectedTheme: theme.name,
      globalStyles: {
        ...project.globalStyles,
        headingFont: theme.headingFont || project.globalStyles.headingFont,
        bodyFont: theme.bodyFont || project.globalStyles.bodyFont,
        colors: nextGlobalColors
      },
      pages: nextPages
    });
    setDirty(true);
    setLastAction(`theme-${theme.name}`);
    setThemeApplied(theme.name);
    setStatus(`Theme changed to ${theme.name}. Custom block edits stay preserved.`);
  }

  function openResizeLayoutForBlock(blockId: string) {
    const block = selectedPage?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightTab("properties");
    setPropertiesTab("resize");
    setRightDrawerMobileOpen(true);
    setRightCollapsed(false);
    setLayoutHighlight(true);
    setResizeStatus(`Resize/Layout controls open for ${block.type} ${block.id}`);
    setStatus(`Resize/Layout controls open for ${block.type} ${block.id}`);
    setTimeout(() => {
      layoutSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      layoutSectionRef.current?.focus();
    }, 60);
    setTimeout(() => setLayoutHighlight(false), 2600);
  }

  function applyQuickWidth(mode: (typeof QUICK_WIDTHS)[number]) {
    const widthPercent = WIDTH_PRESETS[mode];
    patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), widthMode: mode === "half" ? "medium" : mode === "third" ? "narrow" : mode, widthPercent } } }));
    setResizeStatus(`Width ${widthPercent}%`);
  }

  function applyQuickHeight(mode: (typeof QUICK_HEIGHTS)[number]) {
    const minHeightPx = mode === "auto" ? undefined : mode === "short" ? 140 : mode === "medium" ? 240 : 380;
    patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), minHeightPx, heightMode: "auto" } } }));
    setResizeStatus(mode === "auto" ? "Height auto" : `Min height ${minHeightPx}px`);
  }

  function applyQuickAspect(aspect: string) {
    patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), aspectRatio: aspect === "free" ? "free" : aspect } } }));
    setResizeStatus(`Ratio ${aspect}`);
  }

  function startNewRow(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    patchCurrentPage({ ...selectedPage, blocks: updateBlock(selectedPage.blocks, targetId, (b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), rowId: `row-${Date.now()}` } } })) });
    setStatus("Started new row");
  }

  function placeWithPrevious(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const idx = selectedPage.blocks.findIndex((b) => b.id === targetId);
    const joined = joinAdjacentBlocks(selectedPage.blocks, idx, "previous");
    if (joined === selectedPage.blocks) return;
    patchCurrentPage({ ...selectedPage, blocks: joined });
    setStatus("Placed block with block above");
  }

  function placeWithNext(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const idx = selectedPage.blocks.findIndex((b) => b.id === targetId);
    const joined = joinAdjacentBlocks(selectedPage.blocks, idx, "next");
    if (joined === selectedPage.blocks) return;
    patchCurrentPage({ ...selectedPage, blocks: joined });
    setStatus("Placed block with block below");
  }

  function removeFromRow(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const idx = selectedPage.blocks.findIndex((b) => b.id === targetId);
    patchCurrentPage({ ...selectedPage, blocks: leaveRowForBlock(selectedPage.blocks, idx) });
    setStatus("Removed block from row");
  }

  function resetBlockColorsToTheme(blockId?: string) {
    if (!project || !selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const targetBlock = selectedPage.blocks.find(b => b.id === targetId);
    patchCurrentPage({
      ...selectedPage,
      blocks: updateBlock(selectedPage.blocks, targetId, (b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundColor: undefined,
          backgroundImage: undefined,
          backgroundStyle: undefined,
          textColor: undefined,
          fontFamily: undefined,
          parts: {}
        }
      }))
    });
    setStatus(`Selected ${targetBlock ? (blockTypeLabels[targetBlock.type] || targetBlock.type) : "block"} section colors reset to theme.`);
  }

  function applyThemeToAllBlocks() {
    if (!project) return;
    setProject({
      ...project,
      pages: project.pages.map((page) => ({
        ...page,
        blocks: page.blocks.map((b) => ({
          ...b,
          styles: {
            ...(b.styles || {}),
            backgroundColor: undefined,
            backgroundImage: undefined,
            backgroundStyle: undefined,
            textColor: undefined,
            fontFamily: b.type === "hero" || b.type === "text" || b.type === "cards" ? project.globalStyles.headingFont : project.globalStyles.bodyFont,
            parts: {}
          }
        }))
      }))
    });
    setDirty(true);
    setStatus(`Blocks reset to ${selectedThemeName} theme.`);
  }

  function addBlock(type: BlockType) {
    if (!selectedPage) return;
    const b = defaultBlock(type);
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, b] });
    setSelectedBlockId(b.id);
    setSelectedGalleryIndex(null);
    setLastAction(`add-${type}`);
  }

  function updateNav(index: number, patch: Partial<SBuildNavItem>) {
    if (!project) return;
    const nav = [...project.site.nav];
    nav[index] = { ...nav[index], ...patch };
    setProject({ ...project, site: { ...project.site, nav } });
    setDirty(true);
    setLastAction("edit-nav");
  }

  function addNav() {
    if (!project) return;
    const nav = [...project.site.nav, { id: `nav-${Date.now()}`, label: "New", href: "#" }];
    setProject({ ...project, site: { ...project.site, nav } });
    setDirty(true);
  }

  function removeNav(index: number) {
    if (!project) return;
    const nav = project.site.nav.filter((_, i) => i !== index);
    setProject({ ...project, site: { ...project.site, nav } });
    setDirty(true);
  }

  function moveNav(index: number, direction: "up" | "down") {
    if (!project) return;
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= project.site.nav.length) return;
    const nav = move(project.site.nav, index, to);
    setProject({ ...project, site: { ...project.site, nav } });
    setDirty(true);
    setLastAction(`nav-move-${direction}`);
  }

  function addRecentFont(name: string) {
    const key = "sbuild_recent_fonts";
    const current = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    const next = [name, ...current.filter((f) => f !== name)].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(next));
  }

  const filteredFonts = useMemo(() => {
    const q = fontSearch.toLowerCase();
    return fonts.filter((f) => f.family.toLowerCase().includes(q)).slice(0, 50);
  }, [fonts, fontSearch]);

  function getMarkupPaintStageElement(eventTarget?: EventTarget | null) {
    const target = eventTarget instanceof Element ? eventTarget : null;
    return target?.closest(".markup-workspace-canvas-area") || document.querySelector(".markup-workspace-canvas-area");
  }

  function pointerPoint(e: React.PointerEvent<Element>): PaintPoint {
    const stage = getMarkupPaintStageElement(e.target) || (e.target as Element).closest(".canvas-frame");
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    return { x: Math.round(x), y: Math.round(y) };
  }

  function getPaintCanvasSize() {
    const rect = getMarkupPaintStageElement()?.getBoundingClientRect() || canvasRef.current?.getBoundingClientRect();
    return {
      width: rect && rect.width > 0 ? rect.width : 1,
      height: rect && rect.height > 0 ? rect.height : 1
    };
  }

  function projectStrokeToPaintStroke(stroke: MarkupFreehandStroke): PaintStroke {
    const { width, height } = getPaintCanvasSize();
    return {
      id: stroke.id,
      tool: "brush",
      mode: "free",
      color: stroke.color,
      size: stroke.size,
      opacity: stroke.opacity ?? 1,
      points: stroke.points.map((point) => ({
        x: Math.round(point.x * width),
        y: Math.round(point.y * height)
      }))
    };
  }

  function paintStrokeToProjectStroke(stroke: PaintStroke, pageId: string, blockId: string | undefined, createdAt: string): MarkupFreehandStroke {
    const { width, height } = getPaintCanvasSize();
    return {
      id: stroke.id,
      pageId,
      blockId,
      points: stroke.points.slice(0, 2000).map((point) => ({
        x: Math.min(1, Math.max(0, point.x / width)),
        y: Math.min(1, Math.max(0, point.y / height))
      })),
      color: stroke.color,
      size: stroke.size,
      opacity: 1,
      createdAt
    };
  }

  function seedAppliedFreehandStrokes() {
    setPaintAppliedStrokes(currentPageFreehandStrokes.map(projectStrokeToPaintStroke));
  }

  useEffect(() => {
    if (!paintMode) return;
    seedAppliedFreehandStrokes();
    setPaintDraftStrokes([]);
    setPaintRedoStrokes([]);
    setPaintActivePoints([]);
  }, [paintMode, selectedPage?.id, project?.markupFreehandStrokes]);

  useEffect(() => {
    if (!paintMode || isMobileViewport) {
      setMarkupStageRightInset(0);
      return;
    }
    function measureMarkupStageInset() {
      const drawer = document.querySelector(".right-drawer");
      if (!drawer) { setMarkupStageRightInset(0); return; }
      const rect = drawer.getBoundingClientRect();
      if (rect.width <= 0 || rect.left <= 0) { setMarkupStageRightInset(0); return; }
      setMarkupStageRightInset(Math.max(0, Math.round(window.innerWidth - rect.left)));
    }
    measureMarkupStageInset();
    window.addEventListener("resize", measureMarkupStageInset);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureMarkupStageInset) : null;
    if (ro) {
      const drawer = document.querySelector(".right-drawer");
      if (drawer) ro.observe(drawer);
    }
    return () => {
      window.removeEventListener("resize", measureMarkupStageInset);
      if (ro) ro.disconnect();
    };
  }, [paintMode, isMobileViewport, rightCollapsed]);

  function beginPaint(e: React.PointerEvent<SVGSVGElement>) {
    if (!paintMode || previewMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointerPoint(e);
    if (paintTool === "eraser") {
      e.preventDefault();
      e.stopPropagation();
      setPaintDraftStrokes((strokes) => {
        const removed = strokes[strokes.length - 1];
        if (removed) setPaintRedoStrokes((redo) => [...redo, removed]);
        return strokes.slice(0, -1);
      });
      setStatus("Removed last markup stroke");
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (paintDrawMode === "line") {
      setPaintActivePoints([point, point]);
      return;
    }
    setPaintActivePoints([point]);
  }

  function movePaint(e: React.PointerEvent<SVGSVGElement>) {
    if (!paintMode || previewMode || paintTool === "eraser" || paintActivePoints.length === 0) return;
    const point = pointerPoint(e);
    e.preventDefault();
    e.stopPropagation();
    if (paintDrawMode === "line") {
      setPaintActivePoints((pts) => [pts[0], point]);
      return;
    }
    setPaintActivePoints((pts) => [...pts, point]);
  }

  function endPaint(e: React.PointerEvent<SVGSVGElement>) {
    if (!paintMode || previewMode || paintTool === "eraser") return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (paintActivePoints.length < 2) {
      setPaintActivePoints([]);
      return;
    }
    const stroke: PaintStroke = {
      id: `stroke-${Date.now()}`,
      tool: "brush",
      mode: paintDrawMode,
      color: paintColor,
      size: paintSize,
      opacity: MARKUP_DRAFT_STROKE_OPACITY,
      points: paintActivePoints
    };
    setPaintDraftStrokes((strokes) => [...strokes, stroke]);
    setPaintRedoStrokes([]);
    setPaintActivePoints([]);
    setStatus("Markup stroke added");
  }

  function visibleMarkupStrokeOpacity(opacity: number | undefined, fallback: number) {
    return Math.max(opacity ?? fallback, MARKUP_STROKE_MIN_VISIBLE_OPACITY);
  }

  function renderMarkupStroke(key: string, points: PaintPoint[], color: string, size: number, opacity: number | undefined, fallbackOpacity: number) {
    const pointsValue = points.map((p) => `${p.x},${p.y}`).join(" ");
    const visibleOpacity = visibleMarkupStrokeOpacity(opacity, fallbackOpacity);
    return (
      <g key={key} className="markup-freehand-stroke">
        <polyline points={pointsValue} fill="none" stroke="#ffffff" strokeWidth={size + MARKUP_STROKE_OUTER_HALO_WIDTH_OFFSET} strokeOpacity={MARKUP_STROKE_OUTER_HALO_OPACITY} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pointsValue} fill="none" stroke="#0b1020" strokeWidth={size + MARKUP_STROKE_INNER_HALO_WIDTH_OFFSET} strokeOpacity={MARKUP_STROKE_INNER_HALO_OPACITY} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pointsValue} fill="none" stroke={color} strokeWidth={size} strokeOpacity={visibleOpacity} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  function clearPaintDraft() {
    setPaintDraftStrokes([]);
    setPaintRedoStrokes([]);
    setPaintActivePoints([]);
    setStatus("Markup cleared");
  }

  function undoPaintDraft() {
    setPaintDraftStrokes((strokes) => {
      const removed = strokes[strokes.length - 1];
      if (!removed) return strokes;
      setPaintRedoStrokes((redo) => [...redo, removed]);
      setStatus("Undid last draft stroke");
      return strokes.slice(0, -1);
    });
  }

  function redoPaintDraft() {
    setPaintRedoStrokes((redo) => {
      const restored = redo[redo.length - 1];
      if (!restored) return redo;
      setPaintDraftStrokes((strokes) => [...strokes, restored]);
      setStatus("Redid draft stroke");
      return redo.slice(0, -1);
    });
  }

  function applyPaintOverlay() {
    if (!selectedPage || paintDraftStrokes.length === 0) {
      setStatus("No markup to keep");
      return;
    }
    const timestamp = new Date().toISOString();
    const keptStrokes = paintDraftStrokes.map((stroke) =>
      paintStrokeToProjectStroke(stroke, selectedPage.id, selectedBlock?.id, timestamp)
    );
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        markupFreehandStrokes: [...(current.markupFreehandStrokes || []), ...keptStrokes]
      };
    });
    setPaintAppliedStrokes((strokes) => [...strokes, ...paintDraftStrokes.map((stroke) => ({ ...stroke, opacity: MARKUP_APPLIED_STROKE_OPACITY }))]);
    setPaintDraftStrokes([]);
    setPaintRedoStrokes([]);
    setPaintActivePoints([]);
    setDirty(true);
    setLastAction("paint-apply-overlay");
    setStatus("Free draw kept with project draft");
  }

  function discardPaintAndExit() {
    setPaintDraftStrokes([]);
    setPaintRedoStrokes([]);
    setPaintActivePoints([]);
    setPaintMode(false);
    setStatus("Closed Markup; unsaved draft strokes discarded");
  }

  function clearAppliedFreeDraw() {
    if (!selectedPage) {
      setStatus("Select a page before clearing free draw");
      return;
    }
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        markupFreehandStrokes: (current.markupFreehandStrokes || []).filter((stroke) => stroke.pageId !== selectedPage.id)
      };
    });
    setPaintAppliedStrokes([]);
    setPaintRedoStrokes([]);
    setDirty(true);
    setLastAction("paint-clear-free-draw");
    setStatus("Cleared saved free draw for this page");
  }

  function updateMarkupAnnotations(updater: (annotations: MarkupAnnotation[]) => MarkupAnnotation[]) {
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        markupAnnotations: updater(current.markupAnnotations || [])
      };
    });
    setDirty(true);
  }

  function createMarkupNote() {
    if (!selectedPage) {
      setStatus("Select a page before adding a Markup note");
      return;
    }
    const timestamp = new Date().toISOString();
    const note: MarkupAnnotation = {
      id: `note-${Date.now()}`,
      type: "note",
      pageId: selectedPage.id,
      blockId: selectedBlock?.id,
      x: 0.5,
      y: 0.5,
      text: "New markup note",
      color: paintColor,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    updateMarkupAnnotations((annotations) => [...annotations, note]);
    setLastAction("markup-note-create");
    setStatus("Markup note added");
  }

  function updateMarkupNoteText(id: string, text: string) {
    const timestamp = new Date().toISOString();
    updateMarkupAnnotations((annotations) =>
      annotations.map((annotation) =>
        annotation.id === id ? { ...annotation, text, updatedAt: timestamp } : annotation
      )
    );
    setLastAction("markup-note-edit");
    setStatus("Markup note updated");
  }

  function moveMarkupNote(id: string, x: number, y: number) {
    const timestamp = new Date().toISOString();
    updateMarkupAnnotations((annotations) => moveMarkupAnnotation(annotations, id, x, y, timestamp));
    setLastAction("markup-note-move");
    setStatus("Markup note moved");
  }

  function deleteMarkupNote(id: string) {
    updateMarkupAnnotations((annotations) => annotations.filter((annotation) => annotation.id !== id));
    setLastAction("markup-note-delete");
    setStatus("Markup note deleted");
  }

  // Drag reorder handlers
  function handleDragStart(blockId: string, index: number) {
    setDrag({ blockId, startIndex: index, currentIndex: index });
    setStatus(`Dragging block: ${blockId}`);
  }

  function handleDragEnter(targetIndex: number) {
    if (!drag || !selectedPage) return;
    if (drag.currentIndex === targetIndex) return;
    const newBlocks = move(selectedPage.blocks, drag.currentIndex, targetIndex);
    patchCurrentPage({ ...selectedPage, blocks: newBlocks });
    setDrag({ ...drag, currentIndex: targetIndex });
  }

  function handleDragEnd() {
    if (!drag) return;
    setStatus(`Moved block ${drag.startIndex} → ${drag.currentIndex}`);
    setDrag(null);
  }

  // Context menu handlers
  function openContextMenu(e: React.MouseEvent | React.TouchEvent, blockId: string) {
    if (previewMode || paintMode) return;
    e.preventDefault();
    e.stopPropagation();
    let x = 0, y = 0;
    if ("clientX" in e) { x = e.clientX; y = e.clientY; }
    else if ("touches" in e && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    const menuWidth = 240;
    const menuHeight = 380;
    const clampedX = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, x));
    const clampedY = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, y));
    setContextMenu({ visible: true, x: clampedX, y: clampedY, blockId });
  }

  function startLongPress(blockId: string, x: number, y: number) {
    longPressRef.current.fired = false;
    longPressRef.current.startX = x;
    longPressRef.current.startY = y;
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.fired = true;
      longPressRef.current.timer = null;
      openBlockDrawer(blockId);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }

  function openSiteHeaderDrawer(sitePart: "site-title" | "nav" | "site-header", navIndex?: number) {
    setSelectedSitePart(sitePart);
    if (navIndex !== undefined) setSelectedNavIndex(navIndex);
    else setSelectedNavIndex(null);
    setSelectedBlockId("");
    setSelectedGalleryIndex(null);
    setRightDrawerMobileOpen(true);
    setRightCollapsed(false);
    setRightTab("properties");
    if (sitePart === "site-header") setStatus("Editing site header container");
    else if (sitePart === "site-title") setStatus("Editing site title");
    else setStatus(`Editing nav link ${(navIndex ?? 0) + 1}`);
  }

  function openSiteHeaderContextMenu(e: React.MouseEvent | React.TouchEvent) {
    if (previewMode || paintMode) return;
    e.preventDefault();
    e.stopPropagation();
    let x = 0, y = 0;
    if ("clientX" in e) { x = e.clientX; y = e.clientY; }
    else if ("touches" in e && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    const menuWidth = 240;
    const menuHeight = 280;
    const clampedX = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, x));
    const clampedY = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, y));
    setContextMenu({ visible: true, x: clampedX, y: clampedY, blockId: "", isSiteHeader: true });
  }

  function startSiteHeaderLongPress(sitePart: "site-title" | "nav" | "site-header", x: number, y: number, navIndex?: number) {
    siteHeaderLongPressRef.current.fired = false;
    siteHeaderLongPressRef.current.startX = x;
    siteHeaderLongPressRef.current.startY = y;
    siteHeaderLongPressRef.current.timer = setTimeout(() => {
      siteHeaderLongPressRef.current.fired = true;
      siteHeaderLongPressRef.current.timer = null;
      openSiteHeaderDrawer(sitePart, navIndex);
    }, 500);
  }

  function cancelSiteHeaderLongPress() {
    if (siteHeaderLongPressRef.current.timer) {
      clearTimeout(siteHeaderLongPressRef.current.timer);
      siteHeaderLongPressRef.current.timer = null;
    }
  }

  function handleBlockPointerDown(e: React.PointerEvent, blockId: string, index: number) {
    if (e.button !== 0) return;
    if (previewMode || paintMode) return;
    const target = e.target as HTMLElement;
    if (isMobileViewport && target.closest('.gallery-slot')) {
      return;
    }
    startLongPress(blockId, e.clientX, e.clientY);
  }

  function handleBlockPointerUp(e: React.PointerEvent, blockId: string, index: number) {
    cancelLongPress();
    if (longPressRef.current.fired) {
      longPressRef.current.fired = false;
      return;
    }
    if (previewMode || paintMode) return;
    const target = e.target as HTMLElement;
    if (isMobileViewport && target.closest('.gallery-slot')) {
      return;
    }
    if (isMobileViewport) {
      // Mobile single tap: select only, do not open drawer
      setSelectedBlockId(blockId);
      setSelectedGalleryIndex(null);
      setSelectedSitePart(null);
      setSelectedNavIndex(null);
      lastFocusedTextBlockId.current = blockId;
      return;
    }
    if (!drag) selectBlock(blockId);
  }

  function handleBlockPointerMove(e: React.PointerEvent, blockId: string, index: number) {
    if (previewMode || paintMode) return;
    if (longPressRef.current.timer) {
      const dx = Math.abs(e.clientX - longPressRef.current.startX);
      const dy = Math.abs(e.clientY - longPressRef.current.startY);
      if (dx > 12 || dy > 12) {
        cancelLongPress();
      }
    }
    if (drag && drag.blockId === blockId) {
      // dragging
    }
  }

  async function saveSecrets() {
    setSecretStatusMsg("Saving...");
    try {
      await fetchJson("/api/secrets/image-keys", {
        method: "POST",
        body: JSON.stringify({
          imageGenApiKey: secretInputs.imageGenApiKey,
          imageAnalyzeApiKey: secretInputs.imageAnalyzeApiKey,
          openaiChatApiKey: secretInputs.openaiChatApiKey,
          openrouterChatApiKey: secretInputs.openrouterChatApiKey
        })
      });
      setSecretStatusMsg("Keys saved locally.");
      setStatus("Secret key saved");
      setSecretInputs({ imageGenApiKey: "", imageAnalyzeApiKey: "", openaiChatApiKey: "", openrouterChatApiKey: "" });
      const refreshedSecrets = await loadSecretsStatus();
      await loadProviders(refreshedSecrets);
      if (refreshedSecrets.imageGen.configured) {
        setAiImgGenStatus(`Image generation provider ready (${refreshedSecrets.imageGen.source}).`);
      }
    } catch (error) {
      setSecretStatusMsg(`Failed: ${String(error)}`);
    }
  }

  async function testProvider(provider: string) {
    setSecretStatusMsg(`Testing ${provider}...`);
    try {
      const data = await fetchJson<{ ok: boolean; status: string; message: string; provider?: string; model?: string; latencyMs?: number; errorCategory?: string }>("/api/ai/providers/test", { method: "POST", body: JSON.stringify({ provider }) });
      const label = formatProviderDisplayName(data.provider || provider);
      const suffix = data.model ? ` · ${data.model}` : "";
      const latency = typeof data.latencyMs === "number" ? ` · ${data.latencyMs}ms` : "";
      const category = data.errorCategory ? ` · ${data.errorCategory}` : "";
      const message = `${label}: ${data.status}${suffix}${latency}${category} — ${data.message}`;
      setSecretStatusMsg(message);
      setProviderCheckMessage(message);
      setStatus(`Provider status checked: ${label} (${data.status})`);
      const refreshedSecrets = await loadSecretsStatus();
      await loadProviders(refreshedSecrets);
    } catch (error) {
      setSecretStatusMsg(`Test failed: ${String(error)}`);
    }
  }

  async function checkOpenCodeAuth() {
    try {
      const data = await fetchJson<{ ok: boolean; status: string; message: string; commands: string[]; output?: string }>("/api/ai/opencode/auth-status");
      setOpencodeAuth({ status: data.status, message: data.message, commands: data.commands || [], output: data.output });
      setStatus(`Provider status checked: OpenCode (${data.status})`);
    } catch (error) {
      setOpencodeAuth({ status: "unknown", message: `Check failed: ${String(error)}`, commands: ["opencode auth status", "opencode auth login"] });
    }
  }

  function renderRightDrawerBody() {
    if (!project || !selectedPage) return null;
    return <>
          {rightTab === "properties" && (selectedBlock || selectedSitePart) && (
            <div className="panel">
              {selectedSitePart && (() => {
                if (selectedSitePart === "site-header") return (
                  <div className="site-header-edit">
                    <h4>Editing Site Header Container</h4>
                    <p className="hint">Style the whole site header container — background, padding, border.</p>
                    <label>Site title
                      <input value={project.site.siteName} onChange={(e) => { setProject({ ...project, site: { ...project.site, siteName: e.target.value } }); setDirty(true); setLastAction("edit-site-title"); }} />
                    </label>
                    <h4 style={{ marginTop: 16 }}>Navigation Links</h4>
                    {project.site.nav.map((item, i) => (
                      <div key={item.id} className="nav-edit-row">
                        <input value={item.label} onChange={(e) => { const nav = [...project.site.nav]; nav[i] = { ...nav[i], label: e.target.value }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); }} />
                        <input value={item.href} onChange={(e) => { const nav = [...project.site.nav]; nav[i] = { ...nav[i], href: e.target.value }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); }} />
                        <button onClick={() => removeNav(i)}>X</button>
                      </div>
                    ))}
                    <button onClick={addNav} style={{ marginTop: 8 }}>Add Nav Link</button>
                  </div>
                );
                if (selectedSitePart === "site-title") return (
                  <div className="site-header-edit">
                    <h4>Editing Site Header</h4>
                    <label>Site title
                      <input value={project.site.siteName} onChange={(e) => { setProject({ ...project, site: { ...project.site, siteName: e.target.value } }); setDirty(true); setLastAction("edit-site-title"); }} />
                    </label>
                  </div>
                );
                if (selectedSitePart === "nav" && selectedNavIndex !== null && selectedNavIndex >= 0 && selectedNavIndex < project.site.nav.length) {
                  const navItem = project.site.nav[selectedNavIndex];
                  return (
                    <div className="site-header-edit">
                      <h4>Editing Site Header → Nav link {selectedNavIndex + 1}</h4>
                      <label>Nav label
                        <input value={navItem.label} onChange={(e) => { const nav = [...project.site.nav]; nav[selectedNavIndex] = { ...nav[selectedNavIndex], label: e.target.value }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); setLastAction("edit-nav-label"); }} />
                      </label>
                      <label>Nav href/anchor
                        <input value={navItem.href} onChange={(e) => { const nav = [...project.site.nav]; nav[selectedNavIndex] = { ...nav[selectedNavIndex], href: e.target.value }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); setLastAction("edit-nav-href"); }} />
                      </label>
                    </div>
                  );
                }
                return null;
              })()}
              {selectedBlock && (
              <>
              <h3>Block Fields</h3>
              <div className="button-row">
                <button className={propertiesTab === "fields" ? "selected" : ""} onClick={() => setPropertiesTab("fields")}>Fields</button>
                <button className={propertiesTab === "resize" ? "selected" : ""} onClick={() => setPropertiesTab("resize")}>Resize</button>
              </div>
              <p className="panel-status">
                <strong>Properties debug:</strong> {selectedBlock.type} · {selectedBlock.id}
              </p>

              {propertiesTab === "fields" && <>
              {selectedBlock.type === "hero" && (
                <>
                  <label>Heading <input value={(selectedBlock.data as HeroBlockData).heading || ""} onChange={(e) => patchSelectedBlockData({ heading: e.target.value })} /></label>
                  <label>Subheading <input value={(selectedBlock.data as HeroBlockData).subheading || ""} onChange={(e) => patchSelectedBlockData({ subheading: e.target.value })} /></label>
                  <label>CTA Label <input value={(selectedBlock.data as HeroBlockData).ctaLabel || ""} onChange={(e) => patchSelectedBlockData({ ctaLabel: e.target.value })} /></label>
                  <label>CTA Link <input value={(selectedBlock.data as HeroBlockData).ctaHref || ""} onChange={(e) => patchSelectedBlockData({ ctaHref: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "text" && (
                <>
                  <label>Title <input value={(selectedBlock.data as TextBlockData).title || ""} onChange={(e) => patchSelectedBlockData({ title: e.target.value })} /></label>
                  <label>Body <textarea rows={4} value={(selectedBlock.data as TextBlockData).body || ""} onChange={(e) => patchSelectedBlockData({ body: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "image" && (
                <>
                  <label>Image Path <input value={(selectedBlock.data as ImageBlockData).src || ""} onChange={(e) => patchSelectedBlockData({ src: e.target.value })} /></label>
                  <label>Alt Text <input value={(selectedBlock.data as ImageBlockData).alt || ""} onChange={(e) => patchSelectedBlockData({ alt: e.target.value })} /></label>
                  <label>Caption <input value={(selectedBlock.data as ImageBlockData).caption || ""} onChange={(e) => patchSelectedBlockData({ caption: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "cards" && (
                <>
                  <label>Section Title <input value={(selectedBlock.data as CardsBlockData).title || ""} onChange={(e) => patchSelectedBlockData({ title: e.target.value })} /></label>
                  {(selectedBlock.data as CardsBlockData).cards.map((card, i) => (
                    <div key={card.id} className="nested-row">
                      <label>Card {i + 1} Title <input value={card.title} onChange={(e) => { const cards = [...(selectedBlock.data as CardsBlockData).cards]; cards[i] = { ...cards[i], title: e.target.value }; patchSelectedBlockData({ cards }); }} /></label>
                      <label>Card {i + 1} Body <input value={card.body} onChange={(e) => { const cards = [...(selectedBlock.data as CardsBlockData).cards]; cards[i] = { ...cards[i], body: e.target.value }; patchSelectedBlockData({ cards }); }} /></label>
                    </div>
                  ))}
                </>
              )}
              {selectedBlock.type === "hours" && (
                <>
                  <label>Section Title <input value={(selectedBlock.data as HoursBlockData).title || ""} onChange={(e) => patchSelectedBlockData({ title: e.target.value })} /></label>
                  {(selectedBlock.data as HoursBlockData).rows.map((row, i) => (
                    <div key={`${row.day}-${i}`} className="nested-row">
                      <label>Day <input value={row.day} onChange={(e) => { const rows = [...(selectedBlock.data as HoursBlockData).rows]; rows[i] = { ...rows[i], day: e.target.value }; patchSelectedBlockData({ rows }); }} /></label>
                      <label>Open <input value={row.open} onChange={(e) => { const rows = [...(selectedBlock.data as HoursBlockData).rows]; rows[i] = { ...rows[i], open: e.target.value }; patchSelectedBlockData({ rows }); }} /></label>
                      <label>Close <input value={row.close} onChange={(e) => { const rows = [...(selectedBlock.data as HoursBlockData).rows]; rows[i] = { ...rows[i], close: e.target.value }; patchSelectedBlockData({ rows }); }} /></label>
                    </div>
                  ))}
                </>
              )}
              {selectedBlock.type === "gallery" && (
                <>
                  <label>Section Title <input value={(selectedBlock.data as GalleryBlockData).title || ""} onChange={(e) => patchSelectedBlockData({ title: e.target.value })} /></label>
                  {(selectedBlock.data as GalleryBlockData).images.map((img, i) => (
                    <div key={img.id} className="nested-row">
                      <label>Image {i + 1} Path <input value={img.src || ""} onChange={(e) => { const images = [...(selectedBlock.data as GalleryBlockData).images]; images[i] = { ...images[i], src: e.target.value }; patchSelectedBlockData({ images }); }} /></label>
                      <label>Image {i + 1} Alt <input value={img.alt || ""} onChange={(e) => { const images = [...(selectedBlock.data as GalleryBlockData).images]; images[i] = { ...images[i], alt: e.target.value }; patchSelectedBlockData({ images }); }} /></label>
                    </div>
                  ))}
                </>
              )}
              {selectedBlock.type === "contact" && (
                <>
                  <label>Title <input value={(selectedBlock.data as ContactBlockData).title || ""} onChange={(e) => patchSelectedBlockData({ title: e.target.value })} /></label>
                  <label>Phone <input value={(selectedBlock.data as ContactBlockData).phone || ""} onChange={(e) => patchSelectedBlockData({ phone: e.target.value })} /></label>
                  <label>Email <input value={(selectedBlock.data as ContactBlockData).email || ""} onChange={(e) => patchSelectedBlockData({ email: e.target.value })} /></label>
                  <label>Address <input value={(selectedBlock.data as ContactBlockData).address || ""} onChange={(e) => patchSelectedBlockData({ address: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "testimonial" && (
                <>
                  <label>Quote <textarea rows={3} value={(selectedBlock.data as TestimonialBlockData).quote || ""} onChange={(e) => patchSelectedBlockData({ quote: e.target.value })} /></label>
                  <label>Author <input value={(selectedBlock.data as TestimonialBlockData).author || ""} onChange={(e) => patchSelectedBlockData({ author: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "map" && (
                <>
                  <label>Address <input value={(selectedBlock.data as MapBlockData).address || ""} onChange={(e) => patchSelectedBlockData({ address: e.target.value })} /></label>
                  <label>Embed URL <input value={(selectedBlock.data as MapBlockData).embedUrl || ""} onChange={(e) => patchSelectedBlockData({ embedUrl: e.target.value })} /></label>
                </>
              )}
              {selectedBlock.type === "marquee" && (
                <label>Marquee Text <input value={(selectedBlock.data as MarqueeBlockData).text || ""} onChange={(e) => patchSelectedBlockData({ text: e.target.value })} /></label>
              )}
              {selectedBlock.type === "spacer" && (
                <label>Spacer Height <input type="number" value={(selectedBlock.data as SpacerBlockData).height || 36} onChange={(e) => patchSelectedBlockData({ height: Number(e.target.value) })} /></label>
              )}
              {selectedBlock.type === "divider" && (
                <>
                  <label>Divider Style
                    <select value={(selectedBlock.data as DividerBlockData).style || "solid"} onChange={(e) => patchSelectedBlockData({ style: e.target.value as DividerStyle })}>
                      {DIVIDER_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>Thickness <input type="number" value={(selectedBlock.data as DividerBlockData).thickness || 2} onChange={(e) => patchSelectedBlockData({ thickness: Number(e.target.value) })} /></label>
                  <label>Color <input type="color" value={(selectedBlock.data as DividerBlockData).color || "#cccccc"} onChange={(e) => patchSelectedBlockData({ color: e.target.value })} /></label>
                  <label>Width % <input type="range" min={10} max={100} value={(selectedBlock.data as DividerBlockData).widthPercent || 100} onChange={(e) => patchSelectedBlockData({ widthPercent: Number(e.target.value) })} /></label>
                  <label>Alignment
                    <select value={(selectedBlock.data as DividerBlockData).alignment || "center"} onChange={(e) => patchSelectedBlockData({ alignment: e.target.value as "left" | "center" | "right" })}>
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                  <label>Margin Top <input type="number" value={(selectedBlock.data as DividerBlockData).marginTop || 16} onChange={(e) => patchSelectedBlockData({ marginTop: Number(e.target.value) })} /></label>
                  <label>Margin Bottom <input type="number" value={(selectedBlock.data as DividerBlockData).marginBottom || 16} onChange={(e) => patchSelectedBlockData({ marginBottom: Number(e.target.value) })} /></label>
                  <label>Label <input value={(selectedBlock.data as DividerBlockData).label || ""} onChange={(e) => patchSelectedBlockData({ label: e.target.value })} placeholder="Optional label text" /></label>
                  <label>Glow Intensity <input type="range" min={1} max={30} value={(selectedBlock.data as DividerBlockData).glowIntensity || 8} onChange={(e) => patchSelectedBlockData({ glowIntensity: Number(e.target.value) })} /></label>
                </>
              )}
              {selectedBlock.type === "html" && (
                <label>HTML <textarea rows={6} value={(selectedBlock.data as HtmlBlockData).html || ""} onChange={(e) => patchSelectedBlockData({ html: e.target.value })} /></label>
              )}

              <h3>Block Styles</h3>
              <label>Background <input type="color" value={selectedBlock.styles?.backgroundColor || "#ffffff"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundColor: e.target.value } }))} /></label>
              <label>Background Image URL
                <input value={selectedBlock.styles?.backgroundImage || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: e.target.value } }))} placeholder="/project/images/example.png" />
              </label>
              <label>Background Fit
                <select value={selectedBlock.styles?.backgroundSize || "cover"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundSize: e.target.value as "cover" | "contain" | "fill" } }))}>
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                  <option value="fill">fill</option>
                </select>
              </label>
              <label>Text Color <input type="color" value={selectedBlock.styles?.textColor || "#222222"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), textColor: e.target.value } }))} /></label>
              <label>Font Family
                <input value={selectedBlock.styles?.fontFamily || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontFamily: e.target.value } }))} placeholder="e.g. Poppins" />
              </label>
              <label>Font Size <input type="number" value={selectedBlock.styles?.fontSize || 18} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontSize: Number(e.target.value) } }))} /></label>
              <label>Font Weight <input type="number" value={selectedBlock.styles?.fontWeight || 500} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontWeight: Number(e.target.value) } }))} /></label>
              <label>Text Align
                <select value={selectedBlock.styles?.textAlign || "left"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), textAlign: e.target.value as "left" | "center" | "right" } }))}>
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </label>
              <label>Padding <input type="number" value={selectedBlock.styles?.padding || 16} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), padding: Number(e.target.value) } }))} /></label>
              <label>Margin <input type="number" value={selectedBlock.styles?.margin || 8} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), margin: Number(e.target.value) } }))} /></label>
              <label>Border Radius <input type="number" value={selectedBlock.styles?.borderRadius || 12} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), borderRadius: Number(e.target.value) } }))} /></label>
              <label>Shadow
                <input value={selectedBlock.styles?.shadow || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), shadow: e.target.value } }))} placeholder="0 4px 12px rgba(0,0,0,.15)" />
              </label>

              </>}

              <div ref={layoutSectionRef} tabIndex={-1} className={`layout-section ${layoutHighlight ? "layout-highlight" : ""}`}>
              <h3>Layout</h3>
              <p className="panel-status">Quick Resize</p>
              <div className="button-row compact">
                {QUICK_WIDTHS.map((mode) => <button key={mode} className={(selectedBlock.styles?.layout?.widthPercent || 100) === WIDTH_PRESETS[mode] ? "selected" : ""} onClick={() => applyQuickWidth(mode)}>{mode === "half" ? "Half" : mode === "third" ? "Third" : mode[0].toUpperCase() + mode.slice(1)}</button>)}
              </div>
              <div className="button-row compact">
                {QUICK_HEIGHTS.map((mode) => <button key={mode} className={(mode === "auto" && !selectedBlock.styles?.layout?.minHeightPx) || (mode === "short" && selectedBlock.styles?.layout?.minHeightPx === 140) || (mode === "medium" && selectedBlock.styles?.layout?.minHeightPx === 240) || (mode === "tall" && selectedBlock.styles?.layout?.minHeightPx === 380) ? "selected" : ""} onClick={() => applyQuickHeight(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}
              </div>
              <div className="button-row compact">
                {ASPECT_RATIOS.map((ratio) => <button key={ratio} className={(selectedBlock.styles?.layout?.aspectRatio || "free") === ratio ? "selected" : ""} onClick={() => applyQuickAspect(ratio)}>{ratio === "free" ? "Free" : ratio === "1:1" ? "Square" : ratio}</button>)}
              </div>
              <h4>Row</h4>
              <p className="panel-status">Current row: {selectedBlock.styles?.layout?.rowId ? shortRowId(selectedBlock.styles.layout.rowId) : "Single"}. Select a block, click Join next block, then set both to 50%.</p>
              <div className="button-row compact">
                <button onClick={() => placeWithPrevious()}>Join previous block</button>
                <button onClick={() => placeWithNext()}>Join next block</button>
                <button onClick={() => startNewRow()}>Start new row</button>
                <button onClick={() => removeFromRow()}>Leave row</button>
              </div>
              <label>Column Width
                <select value={selectedBlock.styles?.layout?.widthPercent || 100} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), widthMode: "custom", widthPercent: Number(e.target.value) } } }))}>
                  <option value={25}>25%</option>
                  <option value={33}>33%</option>
                  <option value={50}>50%</option>
                  <option value={66}>66%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </label>
              <label>Width Mode
                <select value={selectedBlock.styles?.layout?.widthMode || "full"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), widthMode: e.target.value as NonNullable<NonNullable<Block["styles"]>["layout"]>["widthMode"] } } }))}>
                  <option value="full">full</option>
                  <option value="wide">wide (75%)</option>
                  <option value="medium">half (50%)</option>
                  <option value="narrow">narrow (25%)</option>
                  <option value="custom">custom %</option>
                </select>
              </label>
              {selectedBlock.styles?.layout?.widthMode === "custom" && (
                <label>Width % <input type="range" min={10} max={100} value={selectedBlock.styles?.layout?.widthPercent || 100} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), widthPercent: Number(e.target.value) } } }))} /></label>
              )}
              <label>Max Width (px) <input type="number" value={selectedBlock.styles?.layout?.maxWidthPx || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), maxWidthPx: e.target.value ? Number(e.target.value) : undefined } } }))} placeholder="e.g. 800" /></label>
              <label>Min Height (px) <input type="number" value={selectedBlock.styles?.layout?.minHeightPx || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), minHeightPx: e.target.value ? Number(e.target.value) : undefined } } }))} placeholder="e.g. 200" /></label>
              <label>Height Mode
                <select value={selectedBlock.styles?.layout?.heightMode || "auto"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), heightMode: e.target.value as NonNullable<NonNullable<Block["styles"]>["layout"]>["heightMode"] } } }))}>
                  <option value="auto">auto</option>
                  <option value="fixed">fixed</option>
                  <option value="aspect">aspect ratio</option>
                </select>
              </label>
              {selectedBlock.styles?.layout?.heightMode === "fixed" && (
                <label>Height (px) <input type="number" value={selectedBlock.styles?.layout?.heightPx || ""} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), heightPx: e.target.value ? Number(e.target.value) : undefined } } }))} /></label>
              )}
              <label>Aspect Ratio
                <select value={selectedBlock.styles?.layout?.aspectRatio || "free"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), aspectRatio: e.target.value } } }))}>
                  {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>Align Self
                <select value={selectedBlock.styles?.layout?.alignSelf || "stretch"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), layout: { ...(b.styles?.layout || {}), alignSelf: e.target.value as NonNullable<NonNullable<Block["styles"]>["layout"]>["alignSelf"] } } }))}>
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                  <option value="stretch">stretch</option>
                </select>
              </label>
              {resizeStatus && <p className="panel-status">{resizeStatus}</p>}
              </div>

              <h4>Effects</h4>
              <div className="effect-list">
                {EFFECTS.map((effect) => {
                  const has = (selectedBlock.styles?.effects || []).includes(effect);
                  return (
                    <label key={effect}>
                      <input type="checkbox" checked={has} onChange={(e) => { const current = new Set(selectedBlock.styles?.effects || []); if (e.target.checked) current.add(effect); else current.delete(effect); patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), effects: [...current] } })); }} />
                      {effect}
                    </label>
                  );
                })}
              </div>
              </>
              )}
            </div>
          )}

          {rightTab === "style" && selectedBlock && (
            <div className="panel style-panel">
              <div className="style-selected-summary">
                <div className="style-selected-badge">
                  Editing: {friendlySelectedLabel()}
                </div>
                <div className="style-debug">
                  Block: {selectedBlock.type} · {selectedBlock.id} · Part: {String(selectedPart)}
                </div>
              </div>

              <div className="style-section">
                <h4>Edit Part</h4>
                <div className="button-row compact part-selector">
                  {(["container", "heading", "body", "button", "card", "cardHeading", "cardBody", "image"] as Array<keyof BlockPartStyles>).map((part) => (
                    <button
                      key={part}
                      className={selectedPart === part ? "selected" : ""}
                      onClick={() => setSelectedPart(part)}
                      title={partLabels[part]}
                    >
                      {partLabels[part]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-section">
                <h4>Visual Effects</h4>
                <div className="preset-row">
                  <span className="preset-label">Background style:</span>
                  {Object.entries(BACKGROUND_STYLE_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.backgroundStyle === key ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ backgroundStyle: key as any })}
                      title={`${preset.label}: ${preset.description}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.backgroundStyle ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ backgroundStyle: undefined })}
                  >None</button>
                </div>
                {(() => {
                  const selectedBg = selectedBlock.styles?.parts?.[selectedPart]?.backgroundStyle;
                  const preset = selectedBg ? BACKGROUND_STYLE_PRESETS[selectedBg] : null;
                  return preset ? <p className="preset-description"><strong>{preset.label}:</strong> {preset.description}</p> : null;
                })()}
                <p className="hint">Preset descriptions shown when selected.</p>
                <div className="preset-row">
                  <span className="preset-label">Border style:</span>
                  {Object.entries(BORDER_STYLE_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.borderStyle === key ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ borderStyle: key as any })}
                      title={preset.label}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.borderStyle ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ borderStyle: undefined })}
                  >Default</button>
                </div>
                <div className="preset-row">
                  <span className="preset-label">Shadow style:</span>
                  {Object.entries(SHADOW_STYLE_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.shadowStyle === key ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ shadowStyle: key as any })}
                      title={preset.label}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.shadowStyle ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ shadowStyle: undefined })}
                  >Default</button>
                </div>
                <div className="preset-row">
                  <span className="preset-label">Text effect:</span>
                  {Object.entries(TEXT_EFFECT_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.textEffect === key ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ textEffect: key as any })}
                      title={preset.label}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.textEffect ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ textEffect: undefined })}
                  >None</button>
                </div>
                {selectedPart === "button" && (
                  <div className="preset-row">
                    <span className="preset-label">Button style:</span>
                    {Object.entries(BUTTON_STYLE_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        className={selectedBlock.styles?.parts?.[selectedPart]?.buttonStyle === key ? "selected" : ""}
                        onClick={() => updateSelectedPartStyle({ buttonStyle: key as any })}
                        title={preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      className={!selectedBlock.styles?.parts?.[selectedPart]?.buttonStyle ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ buttonStyle: undefined })}
                    >Default</button>
                  </div>
                )}
              </div>


              <div className="style-section">
                <h4>Quick</h4>
                <div className="button-row compact">
                  <button onClick={() => updateSelectedPartStyle({ fontWeight: (selectedBlock.styles?.parts?.[selectedPart]?.fontWeight || 400) >= 700 ? 400 : 700 })}>
                    {(selectedBlock.styles?.parts?.[selectedPart]?.fontWeight || 400) >= 700 ? "Unbold" : "Bold"}
                  </button>
                  <button onClick={() => updateSelectedPartStyle({ textAlign: "left" })}>Left</button>
                  <button onClick={() => updateSelectedPartStyle({ textAlign: "center" })}>Center</button>
                  <button onClick={() => updateSelectedPartStyle({ textAlign: "right" })}>Right</button>
                  <button onClick={() => {
                    const current = selectedBlock.styles?.parts?.[selectedPart]?.fontSize || 18;
                    updateSelectedPartStyle({ fontSize: Math.max(10, current - 2) });
                  }}>Smaller</button>
                  <button onClick={() => {
                    const current = selectedBlock.styles?.parts?.[selectedPart]?.fontSize || 18;
                    updateSelectedPartStyle({ fontSize: current + 2 });
                  }}>Bigger</button>
                  <button onClick={() => resetSelectedPartToTheme()}>Reset part</button>
                </div>
              </div>

              <div className="style-section">
                <h4>Text</h4>
                <label>Font
                  <select
                    value={selectedBlock.styles?.parts?.[selectedPart]?.fontFamily || ""}
                    onChange={(e) => updateSelectedPartStyle({ fontFamily: e.target.value || undefined })}
                  >
                    <option value="">Use theme font</option>
                    {fonts.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
                  </select>
                </label>
                <div className="preset-row">
                  <span className="preset-label">Size:</span>
                  {Object.entries(SIZE_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.fontSize === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ fontSize: val })}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    className={selectedBlock.styles?.parts?.[selectedPart]?.fontSize !== undefined &&
                      !Object.values(SIZE_PRESETS).includes(selectedBlock.styles?.parts?.[selectedPart]?.fontSize || 0) ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ fontSize: 18 })}
                  >
                    Custom
                  </button>
                </div>
                <div className="preset-row">
                  <span className="preset-label">Weight:</span>
                  {Object.entries(WEIGHT_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.fontWeight === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ fontWeight: val })}
                      title={`${name} (${val})`}
                    >
                      {name} <small>({val})</small>
                    </button>
                  ))}
                </div>
                {selectedBlock.styles?.parts?.[selectedPart]?.fontWeight !== undefined && (
                  <p className="hint">Applied weight: {selectedBlock.styles.parts[selectedPart].fontWeight}. Not all fonts show every weight distinctly.</p>
                )}
                <div className="preset-row">
                  <span className="preset-label">Color:</span>
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.textColor ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ textColor: undefined })}
                    title="Use theme color"
                  >Theme</button>
                  <button
                    className={selectedBlock.styles?.parts?.[selectedPart]?.textColor === "transparent" ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ textColor: "transparent" })}
                    title="Transparent text"
                  >
                    <span className="checkerboard-swatch" />
                  </button>
                  {selectedBlock.styles?.parts?.[selectedPart]?.textColor === "transparent" && (
                    <span className="hint" style={{ color: "#c44" }}>Transparent text may disappear.</span>
                  )}
                  <input type="color" value={selectedBlock.styles?.parts?.[selectedPart]?.textColor || "#222222"} onChange={(e) => updateSelectedPartStyle({ textColor: e.target.value })} className="color-input-inline" />
                </div>
              </div>

              <div className="style-section">
                <h4>Background</h4>
                {(() => {
                  const part = selectedBlock.styles?.parts?.[selectedPart];
                  const bgValue = part?.backgroundColor;
                  const bgImage = part?.backgroundImage;
                  let bgMode: "theme" | "solid" | "gradient" | "image" | "transparent" = "theme";
                  if (bgImage) bgMode = "image";
                  else if (bgValue === "transparent") bgMode = "transparent";
                  else if (bgValue?.includes("gradient")) bgMode = "gradient";
                  else if (bgValue) bgMode = "solid";

                  return (
                    <>
                      <div className="preset-row">
                        <span className="preset-label">Type:</span>
                        <button
                          className={bgMode === "theme" ? "selected" : ""}
                          onClick={() => updateSelectedPartStyle({ backgroundColor: undefined, backgroundImage: undefined, gradientType: undefined, gradientColors: undefined, gradientDirection: undefined })}
                        >Theme</button>
                        <button
                          className={bgMode === "solid" ? "selected" : ""}
                          onClick={() => updateSelectedPartStyle({ backgroundColor: "#ffffff", backgroundImage: undefined, gradientType: undefined, gradientColors: undefined, gradientDirection: undefined })}
                        >Solid</button>
                        <button
                          className={bgMode === "gradient" ? "selected" : ""}
                          onClick={() => {
                            const preset = GRADIENT_PRESETS["Sunset"];
                            applyGradientToPart(preset.colors, preset.direction, preset.type);
                          }}
                        >Gradient</button>
                        <button
                          className={bgMode === "image" ? "selected" : ""}
                          onClick={() => openImageManager("part-bg")}
                        >Image</button>
                        <button
                          className={bgMode === "transparent" ? "selected" : ""}
                          onClick={() => updateSelectedPartStyle({ backgroundColor: "transparent", backgroundImage: undefined, gradientType: undefined, gradientColors: undefined, gradientDirection: undefined })}
                        >Transparent</button>
                      </div>

                      {bgMode === "solid" && (
                        <label>Custom Color
                          <input type="color" value={bgValue || "#ffffff"} onChange={(e) => updateSelectedPartStyle({ backgroundColor: e.target.value })} />
                        </label>
                      )}

                      {bgMode === "transparent" && (
                        <div className="preset-row" style={{ alignItems: "center", gap: 8 }}>
                          <span className="checkerboard-swatch" />
                          <span className="hint">Transparent — content behind this block shows through.</span>
                        </div>
                      )}

                      {bgMode === "gradient" && (() => {
                        const grad = readGradientFromPart(part);
                        const hasThird = grad.colors.length >= 3;
                        return (
                          <div className="gradient-builder">
                            <div className="preset-row">
                              <span className="preset-label">Preset:</span>
                              {Object.entries(GRADIENT_PRESETS).map(([name, preset]) => {
                                const match = grad.colors.length === preset.colors.length && grad.colors.every((c, i) => c.toLowerCase() === preset.colors[i].toLowerCase());
                                return (
                                  <button
                                    key={name}
                                    className={match ? "selected" : ""}
                                    onClick={() => applyGradientToPart(preset.colors, preset.direction, preset.type)}
                                  >
                                    {name}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="preset-row">
                              {grad.colors.map((c, i) => (
                                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span className="preset-label">Color {i + 1}:</span>
                                  <input
                                    type="color"
                                    value={c}
                                    onChange={(e) => {
                                      const next = [...grad.colors];
                                      next[i] = e.target.value;
                                      applyGradientToPart(next, grad.direction, grad.type);
                                    }}
                                    className="color-input-inline"
                                  />
                                </span>
                              ))}
                              {!hasThird && (
                                <button onClick={() => applyGradientToPart([...grad.colors, "#ffffff"], grad.direction, grad.type)}>+ Add 3rd</button>
                              )}
                              {hasThird && (
                                <button onClick={() => applyGradientToPart(grad.colors.slice(0, 2), grad.direction, grad.type)}>− 2 colors</button>
                              )}
                            </div>
                            <div className="preset-row">
                              <span className="preset-label">Direction:</span>
                              {Object.entries(GRADIENT_DIRECTIONS).map(([name, val]) => {
                                const isRadial = val.startsWith("circle");
                                const selected = grad.direction === val && (grad.type === "radial") === isRadial;
                                return (
                                  <button
                                    key={name}
                                    className={selected ? "selected" : ""}
                                    onClick={() => applyGradientToPart(grad.colors, val, isRadial ? "radial" : "linear")}
                                  >
                                    {name}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="gradient-preview" style={{ background: part?.backgroundColor || "", height: 40, borderRadius: 8, margin: "8px 0" }} />
                          </div>
                        );
                      })()}

                      {bgMode === "image" && (
                        <div>
                          <p className="hint">Image: {bgImage?.slice(0, 60)}...</p>
                          <div className="button-row compact">
                            <button onClick={() => updateSelectedPartStyle({ backgroundFit: "cover" })}>Cover</button>
                            <button onClick={() => updateSelectedPartStyle({ backgroundFit: "contain" })}>Contain</button>
                            <button onClick={() => updateSelectedPartStyle({ backgroundFit: "fill" })}>Stretch</button>
                            <button onClick={() => updateSelectedPartStyle({ backgroundFit: "repeat" })}>Tile</button>
                          </div>
                          <label>Overlay opacity
                            <input type="range" min={0} max={100} value={Math.round((part?.opacity || 1) * 100)} onChange={(e) => updateSelectedPartStyle({ opacity: Number(e.target.value) / 100 })} />
                          </label>
                          <button onClick={() => openImageManager("part-bg")}>Change image</button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="style-section">
                <h4>Box & Spacing</h4>
                <div className="preset-row">
                  <span className="preset-label">Padding:</span>
                  {Object.entries(PADDING_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.padding === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ padding: val })}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  <span className="preset-label">Margin:</span>
                  {Object.entries(MARGIN_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.margin === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ margin: val })}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  <span className="preset-label">Border:</span>
                  {Object.entries(BORDER_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.borderWidth === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ borderWidth: val })}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  <span className="preset-label">Radius:</span>
                  {Object.entries(RADIUS_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.borderRadius === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ borderRadius: val })}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  <span className="preset-label">Shadow:</span>
                  {Object.entries(SHADOW_PRESETS).map(([name, val]) => (
                    <button
                      key={name}
                      className={selectedBlock.styles?.parts?.[selectedPart]?.shadow === val ? "selected" : ""}
                      onClick={() => updateSelectedPartStyle({ shadow: val || undefined })}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <div className="preset-row">
                  <span className="preset-label">Border color:</span>
                  <button
                    className={!selectedBlock.styles?.parts?.[selectedPart]?.borderColor ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ borderColor: undefined })}
                    title="Use theme border"
                  >Theme</button>
                  <button
                    className={selectedBlock.styles?.parts?.[selectedPart]?.borderColor === "transparent" ? "selected" : ""}
                    onClick={() => updateSelectedPartStyle({ borderColor: "transparent" })}
                    title="Transparent border"
                  >
                    <span className="checkerboard-swatch" />
                  </button>
                  <input type="color" value={selectedBlock.styles?.parts?.[selectedPart]?.borderColor || "#d5cfbe"} onChange={(e) => updateSelectedPartStyle({ borderColor: e.target.value })} className="color-input-inline" />
                </div>
              </div>

              <div className="style-section">
                <button className="accordion-toggle" onClick={() => setAdvancedOpen((v) => !v)}>
                  Advanced {advancedOpen ? "▲" : "▼"}
                </button>
                {advancedOpen && (
                  <div className="advanced-fields">
                    <label>Background color <input type="color" value={(selectedBlock.styles?.parts?.[selectedPart]?.backgroundColor as string) || "#ffffff"} onChange={(e) => updateSelectedPartStyle({ backgroundColor: e.target.value })} /></label>
                    <label>Text color <input type="color" value={(selectedBlock.styles?.parts?.[selectedPart]?.textColor as string) || "#222222"} onChange={(e) => updateSelectedPartStyle({ textColor: e.target.value })} /></label>
                    <label>Font family <input value={selectedBlock.styles?.parts?.[selectedPart]?.fontFamily || ""} onChange={(e) => updateSelectedPartStyle({ fontFamily: e.target.value || undefined })} placeholder="Use theme font when empty" /></label>
                    <label>Font size <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.fontSize || ""} onChange={(e) => updateSelectedPartStyle({ fontSize: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Font weight <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.fontWeight || ""} onChange={(e) => updateSelectedPartStyle({ fontWeight: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Padding <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.padding ?? ""} onChange={(e) => updateSelectedPartStyle({ padding: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Margin <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.margin ?? ""} onChange={(e) => updateSelectedPartStyle({ margin: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Border color <input type="color" value={(selectedBlock.styles?.parts?.[selectedPart]?.borderColor as string) || "#d5cfbe"} onChange={(e) => updateSelectedPartStyle({ borderColor: e.target.value })} /></label>
                    <label>Border width <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.borderWidth ?? ""} onChange={(e) => updateSelectedPartStyle({ borderWidth: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Border radius <input type="number" value={selectedBlock.styles?.parts?.[selectedPart]?.borderRadius ?? ""} onChange={(e) => updateSelectedPartStyle({ borderRadius: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    <label>Shadow <input value={selectedBlock.styles?.parts?.[selectedPart]?.shadow || ""} onChange={(e) => updateSelectedPartStyle({ shadow: e.target.value || undefined })} placeholder="0 8px 24px rgba(0,0,0,.2)" /></label>
                    <label>Background image URL <input value={selectedBlock.styles?.parts?.[selectedPart]?.backgroundImage || ""} onChange={(e) => updateSelectedPartStyle({ backgroundImage: e.target.value || undefined })} placeholder="/project/images/example.png" /></label>
                    <label>Background fit
                      <select value={selectedBlock.styles?.parts?.[selectedPart]?.backgroundFit || "cover"} onChange={(e) => updateSelectedPartStyle({ backgroundFit: e.target.value as PartStyle["backgroundFit"] })}>
                        <option value="cover">cover</option>
                        <option value="contain">contain</option>
                        <option value="fill">fill</option>
                        <option value="repeat">repeat</option>
                      </select>
                    </label>
                    <label>Opacity <input type="number" min={0} max={1} step={0.1} value={selectedBlock.styles?.parts?.[selectedPart]?.opacity ?? 1} onChange={(e) => updateSelectedPartStyle({ opacity: Number(e.target.value) })} /></label>
                  </div>
                )}
              </div>

              <div className="style-section global-style-section">
                <h4>Global Site Style</h4>
                <label>Theme
                  <select value={selectedThemeName} onChange={(e) => {
                    const next = e.target.value;
                    setSelectedThemeName(next);
                    const idx = themePresets.findIndex((t) => t.name === next);
                    if (idx >= 0) applyTheme(idx);
                  }}>
                    {themePresets.map((theme) => <option key={theme.name} value={theme.name}>{theme.name}</option>)}
                  </select>
                </label>
                <div className="button-row compact">
                  <button onClick={() => {
                    if (window.confirm("Reset block colors/fonts to the selected theme? Custom block colors may be replaced.")) {
                      applyThemeToAllBlocks();
                    }
                  }}>Reset blocks to this theme</button>
                  <button onClick={() => resetBlockColorsToTheme()}>Reset selected block colors</button>
                </div>
                <label>Page Background <input type="color" value={project.globalStyles.colors.pageBackground || project.globalStyles.colors.bg} onChange={(e) => updateGlobalColor("pageBackground", e.target.value)} /></label>
                <label>Canvas Background <input type="color" value={project.globalStyles.colors.canvasBackground || project.globalStyles.colors.bg} onChange={(e) => updateGlobalColor("canvasBackground", e.target.value)} /></label>
                <label>Block Background <input type="color" value={project.globalStyles.colors.blockBackground || project.globalStyles.colors.surface} onChange={(e) => updateGlobalColor("blockBackground", e.target.value)} /></label>
                <label>Card Background <input type="color" value={project.globalStyles.colors.cardBackground || project.globalStyles.colors.surface} onChange={(e) => updateGlobalColor("cardBackground", e.target.value)} /></label>
                <label>Heading Color <input type="color" value={project.globalStyles.colors.headingColor || project.globalStyles.colors.text} onChange={(e) => updateGlobalColor("headingColor", e.target.value)} /></label>
                <label>Body Text Color <input type="color" value={project.globalStyles.colors.bodyTextColor || project.globalStyles.colors.text} onChange={(e) => updateGlobalColor("bodyTextColor", e.target.value)} /></label>
                <label>Accent Color <input type="color" value={project.globalStyles.colors.accentColor || project.globalStyles.colors.accent} onChange={(e) => updateGlobalColor("accentColor", e.target.value)} /></label>
                <label>Heading Font
                  <select value={project.globalStyles.headingFont} onChange={(e) => { setProject({ ...project, globalStyles: { ...project.globalStyles, headingFont: e.target.value } }); setDirty(true); }}>
                    {fonts.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
                  </select>
                </label>
                <label>Body Font
                  <select value={project.globalStyles.bodyFont} onChange={(e) => { setProject({ ...project, globalStyles: { ...project.globalStyles, bodyFont: e.target.value } }); setDirty(true); }}>
                    {fonts.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
                  </select>
                </label>
              </div>

              <div className="button-row compact">
                <button onClick={() => setCopiedBlockStyle(selectedBlock.styles || null)}>Copy style</button>
                <button onClick={() => { if (copiedBlockStyle) patchSelectedBlock((b) => ({ ...b, styles: { ...copiedBlockStyle } })); }}>Paste style</button>
              </div>
            </div>
          )}

          {rightTab === "images" && (
            <div className="panel image-manager-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Image Library</h3>
              <button onClick={() => setImageManagerOpen(false)} style={{ padding: "4px 8px" }}>✕</button>
            </div>
              <p className="panel-status" data-testid="image-library-intro">Image Library stores all uploaded and generated project assets. The Website Gallery controls which images are displayed inside gallery blocks on the website.</p>
              <div className="image-library-tabs" data-testid="image-library-tabs" style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                <button data-testid="image-library-tab-browse" className={imageLibraryTab === "browse" ? "selected" : ""} onClick={() => setImageLibraryTab("browse")}>Browse</button>
                <button data-testid="image-library-tab-upload" className={imageLibraryTab === "upload" ? "selected" : ""} onClick={() => setImageLibraryTab("upload")}>Upload</button>
                <button
                  data-testid="image-library-tab-settings"
                  className={imageLibraryTab === "settings" ? "selected" : ""}
                  onClick={() => { setImageLibraryTab("settings"); void refreshFolderList(); }}
                >Settings</button>
              </div>

              {imageLibraryTab === "upload" && (
                <div className="image-manager-upload" data-testid="image-library-upload-section">
                  <h4>Upload Images</h4>
                  <label>Upload image
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImages(e.target.files)} />
                  </label>
                  {uploadingImage && <span className="hint">Uploading...</span>}
                  {photoEditStatus && <p className="panel-status">{photoEditStatus}</p>}
                  <p className="hint">Tip: uploads are saved to the project image folder (see Settings tab). You can also upload generated images from the AI Image Generator tab.</p>
                </div>
              )}

              {imageLibraryTab === "settings" && (
                <div className="image-manager-folder" data-testid="image-library-settings-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0 }}>Project Photo Folder</h4>
                    <button
                      data-testid="image-library-folder-refresh"
                      onClick={() => void refreshFolderList()}
                      style={{ padding: "4px 8px" }}
                    >Refresh / Rescan</button>
                  </div>
                  <p className="hint" style={{ marginTop: 6 }}>
                    Manage your project image folders without terminal access. All operations stay inside <code>project/images</code>.
                  </p>

                  <div className="image-folder-current" data-testid="image-library-folder-current" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <strong>Active folder:</strong>
                    <code data-testid="image-library-folder-active">{photoFolder}</code>
                    <button onClick={() => void savePhotoFolder()} data-testid="image-library-folder-save-active">Save as active</button>
                    <button onClick={() => setPhotoFolder("project/images")} data-testid="image-library-folder-reset">Reset to project/images</button>
                  </div>

                  <details
                    className="image-folder-section"
                    data-testid="image-library-folder-list-details"
                    open
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>Folders</summary>
                    <div className="image-folder-list" data-testid="image-library-folder-list-section" style={{ marginBottom: 10 }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto", border: "1px solid var(--editor-border)", borderRadius: 6 }}>
                      {folderList.map((folder) => {
                        const isActive = folder === photoFolder;
                        const isRoot = folder === "project/images";
                        return (
                          <li
                            key={folder}
                            data-testid="image-library-folder-item"
                            data-folder={folder}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid var(--editor-border)", background: isActive ? "var(--editor-status-bg)" : "transparent" }}
                          >
                            <code style={{ flex: 1, fontSize: 12 }}>{folder}</code>
                            {!isActive && (
                              <button
                                data-testid="image-library-folder-switch"
                                onClick={() => setPhotoFolder(folder)}
                                style={{ fontSize: 11, padding: "2px 6px" }}
                              >Set active</button>
                            )}
                            {!isRoot && (
                              <button
                                data-testid="image-library-folder-delete"
                                onClick={() => void deleteImageFolder(folder)}
                                style={{ fontSize: 11, padding: "2px 6px" }}
                                title="Delete folder (must be empty)"
                              >Delete</button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    </div>
                  </details>

                  <details
                    className="image-folder-section"
                    data-testid="image-library-folder-create-details"
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>Create subfolder</summary>

                  <div className="image-folder-create" data-testid="image-library-folder-create-section" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Parent
                        <select data-testid="image-library-folder-create-parent" value={newFolderParent} onChange={(e) => setNewFolderParent(e.target.value)}>
                          {folderList.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </label>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Name
                        <input
                          data-testid="image-library-folder-create-name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="e.g. products"
                          style={{ minWidth: 120 }}
                        />
                      </label>
                      <button data-testid="image-library-folder-create" onClick={() => void createImageFolder()}>Create</button>
                    </div>
                  </div>
                  </details>

                  <details
                    className="image-folder-section"
                    data-testid="image-library-folder-rename-details"
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>Rename subfolder</summary>
                  <div className="image-folder-rename" data-testid="image-library-folder-rename-section" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Folder
                        <select data-testid="image-library-folder-rename-target" value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)}>
                          <option value="">— select —</option>
                          {folderList.filter((f) => f !== "project/images").map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </label>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        New name
                        <input
                          data-testid="image-library-folder-rename-name"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="e.g. hero-shots"
                          style={{ minWidth: 120 }}
                        />
                      </label>
                      <button data-testid="image-library-folder-rename" onClick={() => void renameImageFolder()}>Rename</button>
                    </div>
                  </div>
                  </details>

                  <details
                    className="image-folder-section"
                    data-testid="image-library-folder-move-details"
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>Move selected images</summary>
                  <div className="image-folder-move" data-testid="image-library-folder-move-section" style={{ marginBottom: 10 }}>
                    <p className="hint">Select images in the Browse tab, then pick a destination here.</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Move to
                        <select data-testid="image-library-move-target" value={moveTargetFolder} onChange={(e) => setMoveTargetFolder(e.target.value)}>
                          {folderList.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </label>
                      <button
                        data-testid="image-library-move-selected"
                        onClick={() => void moveSelectedImagesTo(moveTargetFolder)}
                        disabled={selectedImageUrls.size === 0}
                      >Move {selectedImageUrls.size || 0} selected</button>
                    </div>
                  </div>
                  </details>

                  {folderManagerStatus && (
                    <p
                      data-testid="image-library-folder-status"
                      className="panel-status"
                      style={{ color: folderManagerStatusOk ? "var(--editor-accent)" : "var(--editor-warning, #c0392b)" }}
                    >{folderManagerStatus}</p>
                  )}
                </div>
              )}

              {imageLibraryTab === "browse" && (
                <>
                  <div className="image-manager-gallery" data-testid="image-library-library-section">
                    <div className="image-library-header">
                      <h4>Project Images ({filteredUploadedImages.length}/{uploadedImages.length})</h4>
                      <div className="image-library-header-actions">
                        <button
                          data-testid="image-library-refresh"
                          onClick={() => void loadImages()}
                          title="Reload the image list from disk"
                        >Refresh</button>
                        <button
                          data-testid="image-library-open-folder"
                          onClick={() => {
                            const folder = photoFolder || "project/images";
                            setStatus(`Project image folder: ${folder} (browser-safe view). No native OS file picker is available in the embedded builder.`);
                            setImageLibraryTab("settings");
                            void refreshFolderList();
                          }}
                          title="Open the in-app folder manager (browser-safe; no native OS picker is launched)"
                        >Open folder</button>
                      </div>
                    </div>
                    <div className="image-library-controls">
                      <label>Filter
                        <select data-testid="image-library-filter" value={imageLibraryFilter} onChange={(e) => setImageLibraryFilter(e.target.value as ImageLibraryFilter)}>
                          <option value="all">Show all</option>
                          <option value="hide-blank">Hide likely blank/white</option>
                          <option value="hide-tall">Hide tall/screenshot-like</option>
                          <option value="generated">Generated only</option>
                          <option value="uploaded">Uploaded only</option>
                          <option value="used">Used on page only</option>
                        </select>
                      </label>
                      <label>Tile fit
                        <select value={imageTileFit} onChange={(e) => setImageTileFit(e.target.value as ImageTileFit)}>
                          <option value="cover">Cover</option>
                          <option value="contain">Contain</option>
                        </select>
                      </label>
                    </div>
                    <div className="image-library-bulk" data-testid="image-library-bulk-bar">
                      <div className="image-library-bulk-row" data-testid="image-library-bulk-row-top">
                        <span
                          className="image-library-selected-count"
                          data-testid="image-library-selected-count"
                          aria-live="polite"
                        >
                          {selectMode ? `Selected: ${selectedImageUrls.size}` : "Selection off"}
                        </span>
                        <button data-testid="image-library-select-all" onClick={() => selectAllFilteredImages()} disabled={!selectMode}>Select all visible</button>
                        <button data-testid="image-library-clear-selection" onClick={() => clearImageSelection()} disabled={!selectMode || selectedImageUrls.size === 0}>Clear selection</button>
                        <button
                          data-testid="image-library-select-mode-toggle"
                          className={selectMode ? "selected" : ""}
                          aria-pressed={selectMode}
                          onClick={() => {
                            setSelectMode((prev) => !prev);
                            if (selectMode) clearImageSelection();
                          }}
                          title={selectMode ? "Turn selection off" : "Turn selection on"}
                        >{selectMode ? "Selection: on" : "Selection: off"}</button>
                        <button
                          data-testid="image-library-delete-selected"
                          disabled={!selectMode || selectedImageUrls.size === 0 || bulkDeletePending}
                          onClick={() => {
                            if (selectedImageUrls.size === 0) return;
                            setBulkDeletePending(true);
                            setBulkDeleteMessage("");
                          }}
                          className="image-library-delete-button"
                        >
                          {bulkDeletePending ? "Confirm delete" : `Delete selected (${selectedImageUrls.size})`}
                        </button>
                      </div>
                    </div>
                    {bulkDeletePending && (
                      <div className="image-library-confirm" data-testid="image-library-delete-confirm" style={{ background: "var(--editor-panel-bg-2)", border: "1px solid var(--editor-warning, #c0392b)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                        {(() => {
                          const selectedMetas = uploadedImages.filter((img) => selectedImageUrls.has(img.url));
                          const inUse = selectedMetas.filter((m) => usedImageUrls.has(m.url));
                          const gitkeepSlipped = selectedMetas.some((m) => m.name === ".gitkeep" || m.name.startsWith("."));
                          return (
                            <>
                              <p style={{ marginTop: 0 }}><strong>Delete {selectedImageUrls.size} image{selectedImageUrls.size === 1 ? "" : "s"}?</strong> This cannot be undone.</p>
                              {inUse.length > 0 && (
                                <p
                                  className="image-library-confirm-warn"
                                  data-testid="image-library-delete-inuse-warning"
                                  style={{ color: "var(--editor-warning, #c0392b)", margin: "4px 0 8px 0" }}
                                >
                                  {inUse.length} of the selected image{inUse.length === 1 ? " is" : "s are"} currently used by the project (backgrounds, image blocks, gallery items, or card images). They will be blocked from deletion. If you must remove them, replace their usage in the page first.
                                </p>
                              )}
                              {gitkeepSlipped && (
                                <p style={{ color: "var(--editor-warning, #c0392b)", margin: "4px 0 8px 0" }}>
                                  Note: hidden / system files (.gitkeep) will be skipped automatically.
                                </p>
                              )}
                              <div className="button-row compact">
                                <button
                                  data-testid="image-library-delete-confirm-yes"
                                  onClick={async () => {
                                    const paths = Array.from(selectedImageUrls)
                                      .map((url) => url.replace(/^\/+/, ""))
                                      .filter((url) => {
                                        if (!url) return false;
                                        if (url.startsWith("project/images/")) return true;
                                        return false;
                                      });
                                    const result = await bulkDeleteImages(paths);
                                    const blocked = result.results.filter((r) => !r.deleted && r.skipped).length;
                                    const errCount = result.results.filter((r) => !r.deleted && r.error && !r.skipped).length;
                                    let msg = `Deleted ${result.deletedCount} image(s).`;
                                    if (blocked > 0) msg += ` ${blocked} blocked (in use).`;
                                    if (errCount > 0) msg += ` ${errCount} error(s).`;
                                    setBulkDeletePending(false);
                                    setBulkDeleteMessage(msg);
                                    clearImageSelection();
                                  }}
                                  style={{ background: "var(--editor-warning, #c0392b)", color: "#fff", borderColor: "var(--editor-warning, #c0392b)" }}
                                >Yes, delete</button>
                                <button onClick={() => { setBulkDeletePending(false); setBulkDeleteMessage(""); }}>Cancel</button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {bulkDeleteMessage && <p className="panel-status" data-testid="image-library-delete-message">{bulkDeleteMessage}</p>}
                    {filteredUploadedImages.length === 0 && <p className="hint">No images match this filter yet. Try Show all or upload/generate images.</p>}
                    <div className="image-grid" data-testid="image-library-grid" data-select-mode={selectMode ? "on" : "off"}>
                      {filteredUploadedImages.map((img) => {
                        const isSelected = selectedImageUrls.has(img.url);
                        const isPrimary = selectedUploadImage === img.url;
                        const diag = imageDiagnostics[img.url];
                        return (
                          <div
                            key={img.url}
                            className={`image-card ${isPrimary ? "selected" : ""} ${isSelected ? "multi-selected" : ""} ${selectMode ? "select-mode" : ""}`}
                            onClick={() => { if (!selectMode) setSelectedUploadImage(img.url); else toggleImageSelected(img.url); }}
                            onContextMenu={(e) => { e.preventDefault(); toggleImageSelected(img.url); }}
                            data-testid="image-library-card"
                            data-image-url={img.url}
                            data-selected={isSelected ? "true" : "false"}
                            role="button"
                            aria-pressed={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleImageSelected(img.url); } }}
                          >
                            <label
                              className={`image-card-checkbox ${selectMode ? "image-card-checkbox-prominent" : ""}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleImageSelected(img.url)}
                                aria-label={`Select ${img.name}`}
                                data-testid="image-library-card-checkbox"
                              />
                            </label>
                            <img
                              src={img.url}
                              alt={img.name}
                              loading="lazy"
                              style={{ objectFit: imageTileFit }}
                              onLoad={(e) => captureImageDiagnostics(img.url, img.name, e.currentTarget)}
                              onError={(e) => {
                                setBrokenImages((prev) => new Set(prev).add(img.url));
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                            {brokenImages.has(img.url) && (
                              <div className="image-fallback">
                                <div className="image-fallback-icon">🖼️</div>
                                <div className="image-fallback-name">{img.name}</div>
                              </div>
                            )}
                            <div className="image-meta">{img.name}{img.isEdited ? " (edited)" : ""}{diag?.likelyWhite ? " (blank)" : ""}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedUploadImage && (
                    <div className="image-library-selected-panel" data-testid="image-library-selected-panel" style={{ marginTop: 12 }}>
                      <div className="button-row compact">
                        <button onClick={() => openImageActionPanel()}>Open actions for selected image</button>
                        <span className="hint">Actions like Enhance, B&amp;W, and Set as Hero are in the action panel below.</span>
                      </div>
                    </div>
                  )}

                  {imageActionPanelOpen && selectedUploadImage && (
                    <div className="image-action-modal-backdrop" data-testid="image-action-modal" onClick={() => setImageActionPanelOpen(false)}>
                      <div className="image-action-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <h4 style={{ margin: 0 }}>Selected Image: {selectedUploadImage.split("/").pop()}</h4>
                          <button onClick={() => setImageActionPanelOpen(false)} style={{ padding: "2px 8px" }}>✕</button>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                          <button className={imageActionTab === "actions" ? "selected" : ""} onClick={() => setImageActionTab("actions")}>Actions</button>
                          <button className={imageActionTab === "details" ? "selected" : ""} onClick={() => setImageActionTab("details")}>Details</button>
                          <button className={imageActionTab === "history" ? "selected" : ""} onClick={() => setImageActionTab("history")}>History</button>
                        </div>
                        {imageActionTab === "actions" && (
                          <div className="image-action-modal-body">
                            {renderImageManagerActions(true)}
                          </div>
                        )}
                        {imageActionTab === "details" && (() => {
                          const meta = uploadedImages.find((m) => m.url === selectedUploadImage);
                          const diag = imageDiagnostics[selectedUploadImage];
                          return (
                            <div className="image-action-modal-body" data-testid="image-action-details">
                              <p><strong>Name:</strong> {meta?.name || selectedUploadImage.split("/").pop()}</p>
                              <p><strong>Folder:</strong> {meta?.folder || "—"}</p>
                              <p><strong>Size:</strong> {meta?.size ? `${Math.round(meta.size / 1024)} KB` : "—"}</p>
                              <p><strong>Modified:</strong> {meta?.modified || "—"}</p>
                              <p><strong>Edited:</strong> {meta?.isEdited ? "yes" : "no"}</p>
                              {diag && (
                                <>
                                  <p><strong>Width x Height:</strong> {diag.width} x {diag.height}</p>
                                  <p><strong>Likely blank/white:</strong> {diag.likelyWhite ? "yes" : "no"}</p>
                                  <p><strong>Likely tall capture:</strong> {diag.likelyTallCapture ? "yes" : "no"}</p>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {imageActionTab === "history" && (() => {
                          const meta = uploadedImages.find((m) => m.url === selectedUploadImage);
                          return (
                            <div className="image-action-modal-body" data-testid="image-action-history">
                              <p className="hint">Edit history for this image:</p>
                              <ul>
                                {meta?.isEdited && <li>Edited via photo tools</li>}
                                <li>Uploaded to project image folder</li>
                              </ul>
                              <p className="hint">For more, check git history of the project.</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {rightTab === "ai" && (
            <div className="panel mobile-ai-panel">
              <h3>AI Chat</h3>
              <p className="panel-status">
                <strong>AI panel:</strong> {(() => { const t = computeAiTarget(); if (t.kind === "site-header") return "site header"; if (t.kind === "block") return `block ${t.label}`; return "none"; })()}
              </p>
              {chatProviderStatus && <p className="panel-status"><strong>Chat status:</strong> {chatProviderStatus.message}</p>}
              <div className="quick-actions">
                <button onClick={() => void quickRewrite("rewrite")}>Rewrite</button>
                <button onClick={() => void quickRewrite("shorten")}>Shorten</button>
                <button onClick={() => void quickRewrite("lengthen")}>Lengthen</button>
                <button onClick={() => void quickRewrite("tone")}>Tone</button>
              </div>
              <div className="chat-log">
                {chatHistory.map((msg) => renderChatMessage(msg))}
              </div>
              <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} rows={4} placeholder="Ask AI to improve copy or layout" className="mobile-field-stack" />
              <div className="button-row mobile-button-row">
                <button onClick={() => void chat()}>Send</button>
              </div>

              <h3>Image Generator</h3>
              <label>
                Prompt
                <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} rows={3} placeholder="e.g. aerial view of a catfish farm at golden hour" />
              </label>
              <label>
                Optional Provider Size Override
                <select value={providerSizeOverride} onChange={(e) => setProviderSizeOverride(e.target.value)}>
                  <option value="">Auto (recommended)</option>
                  <option value="1024x1024">1024 x 1024</option>
                  <option value="1024x1536">1024 x 1536</option>
                  <option value="1536x1024">1536 x 1024</option>
                </select>
              </label>
              <div className="button-row mobile-button-row">
                <button onClick={() => void generateImage()}>Generate image for this block ({blockTypeForTarget(selectedBlock)})</button>
              </div>
              {imageStatus && <p><strong>Image status:</strong> {imageStatus}</p>}
              {imageSizeDecision && (
                <div className="image-debug">
                  <p><strong>Target block:</strong> {blockTypeForTarget(selectedBlock)}</p>
                  <p><strong>Provider size:</strong> {imageSizeDecision.providerSize}</p>
                  <p><strong>Final output:</strong> {imageSizeDecision.outputWidth} x {imageSizeDecision.outputHeight}</p>
                  <p><strong>Crop mode:</strong> {imageSizeDecision.cropMode}</p>
                  {imageSizeDecision.warnings.length > 0 && <p><strong>Warnings:</strong> {imageSizeDecision.warnings.join(" | ")}</p>}
                </div>
              )}
              {lastGeneratedImage && <img src={lastGeneratedImage} alt="Last generated" className="block-image" />}

              <h3>Edit Uploaded Photo</h3>
              <label>
                Upload source photo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImages(e.target.files)} />
              </label>
              <label>
                Source uploaded image
                <select value={selectedUploadImage} onChange={(e) => setSelectedUploadImage(e.target.value)}>
                  {uploadedImages.length === 0 ? <option value="">No uploaded images</option> : uploadedImages.map((img) => <option key={img.url} value={img.url}>{img.name}</option>)}
                </select>
              </label>
              <label>
                Edit type
                <select value={photoEditType} onChange={(e) => setPhotoEditType(e.target.value)}>
                  <option value="enhance">Enhance photo</option>
                  <option value="black-white">Black &amp; white</option>
                  <option value="color-pop">Color pop</option>
                  <option value="cleanup">Clean up</option>
                  <option value="crop-fit">Crop/fit to selected block</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                Instruction
                <textarea value={photoEditInstruction} onChange={(e) => setPhotoEditInstruction(e.target.value)} rows={3} placeholder="Optional instruction for edit." />
              </label>
              <div className="button-row mobile-button-row">
                <button onClick={() => void applyPhotoEdit()} disabled={uploadingImage}>{uploadingImage ? "Uploading..." : "Apply photo edit"}</button>
              </div>
              {photoEditStatus && <p><strong>Photo edit status:</strong> {photoEditStatus}</p>}
              {lastEditedImage && <img src={lastEditedImage} alt="Last edited" className="block-image" />}
            </div>
          )}

          {rightTab === "status" && (
            <div className="panel">
              <h3>Status</h3>
              <p className="panel-status">
                <strong>Status panel:</strong> save state {withSavedStatusText(status, dirty)}
              </p>
              <p><strong>API:</strong> {status}</p>
              <p><strong>Selected Block:</strong> {selectedBlock?.id || "none"}</p>
              <p><strong>Selected Type:</strong> {selectedBlock?.type || "none"}</p>
              <p><strong>Dirty:</strong> {dirty ? "yes" : "no"}</p>
              <p><strong>Project source:</strong> {loadedProjectSource}</p>
              {loadedProjectUpdatedAt && <p><strong>Loaded project mtime:</strong> {new Date(loadedProjectUpdatedAt).toLocaleString()}</p>}
              {lastLoadedAt && <p><strong>Last loaded:</strong> {new Date(lastLoadedAt).toLocaleString()}</p>}
              {lastSavedAt && <p><strong>Last saved:</strong> {new Date(lastSavedAt).toLocaleString()}</p>}
              {projectPath && <p><strong>Project path:</strong> {projectPath}</p>}
              <p><strong>Last action:</strong> {lastAction}</p>
              {drag && <p><strong>Drag:</strong> {drag.blockId.slice(0, 12)} {drag.startIndex}→{drag.currentIndex}</p>}
              {themeApplied && <p><strong>Theme:</strong> {themeApplied}</p>}
              <p><strong>Publish:</strong> dry-run (live disabled)</p>
              <p><strong>mobile-toolbar-gap-repair active</strong></p>
              <p><strong>action-controls-offset active</strong></p>
              <p><strong>version:</strong> {displayVersion}</p>
              <p><strong>toolbarHeight:</strong> {debugToolbarH || "n/a"}{debugToolbarH ? "px" : ""}</p>
              <p><strong>spacerHeight:</strong> {debugSpacerH || "n/a"}{debugSpacerH ? "px" : ""}</p>
              <p><strong>topbarBottom:</strong> {debugToolbarBottom || "n/a"}{debugToolbarBottom ? "px" : ""}</p>
              <p><strong>canvasControlsTop:</strong> {debugCanvasControlsTop || "n/a"}{debugCanvasControlsTop ? "px" : ""}</p>
              <p><strong>gapPx:</strong> {isMobileViewport ? `${debugGapPx}px` : "n/a"}</p>
              <p><strong>duplicateOffsetDetected:</strong> {isMobileViewport ? (debugDuplicateOffset ? "true" : "false") : "n/a"}</p>
              <p><strong>measurementMissing:</strong> {isMobileViewport ? (debugMeasurementMissing ? "true" : "false") : "n/a"}</p>
              <p><strong>topbarPaddingTop:</strong> {debugTopbarPaddingTop || "n/a"}{debugTopbarPaddingTop ? "px" : ""}</p>
              <p><strong>statusPillClientH:</strong> {debugStatusPillH || "n/a"}{debugStatusPillH ? "px" : ""}</p>
              <p><strong>statusTextOverflows:</strong> {isMobileViewport ? (debugStatusOverflow ? "true" : "false") : "n/a"}</p>

              <h4>Provider Status</h4>
              {providerStatus.length === 0 && <p>Loading providers...</p>}
              {providerStatus.map((p) => (
                <div key={p.name} className={`provider-card provider-${p.status}`}>
                  <strong>{p.name}</strong>
                  <span className="provider-badge">{p.status}</span>
                  <p>{p.message}</p>
                </div>
              ))}

              {userRole === "admin" && <>
                <h4>Image API Keys</h4>
                <p className="hint">Keys are stored locally, not in project.json.</p>
                <label>Image Generation API Key
                  <input type="password" value={secretInputs.imageGenApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageGenApiKey: e.target.value }))} placeholder="sk-..." />
                </label>
                <label>Image Analysis API Key
                  <input type="password" value={secretInputs.imageAnalyzeApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageAnalyzeApiKey: e.target.value }))} placeholder="sk-..." />
                </label>
                <label>OpenAI Chat API Key
                  <input type="password" value={secretInputs.openaiChatApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, openaiChatApiKey: e.target.value }))} placeholder={secretStatus.chatOpenAI.maskedKey || "sk-..."} />
                </label>
                <label>OpenRouter Chat API Key
                  <input type="password" value={secretInputs.openrouterChatApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, openrouterChatApiKey: e.target.value }))} placeholder={secretStatus.chatOpenRouter.maskedKey || "sk-or-..."} />
                </label>
                <div className="button-row">
                  <button onClick={() => void saveSecrets()}>Save Keys Locally</button>
                  <button onClick={() => void testProvider("image-gen")}>Test Image Gen</button>
                  <button onClick={() => void testProvider("opencode")}>Test OpenCode</button>
                </div>
                <p className="panel-status">OpenAI chat source: {secretStatus.chatOpenAI.source} · {secretStatus.chatOpenAI.statusText} · Key: {secretStatus.chatOpenAI.maskedKey || "not saved"}</p>
                <p className="panel-status">OpenRouter chat source: {secretStatus.chatOpenRouter.source} · {secretStatus.chatOpenRouter.statusText} · Key: {secretStatus.chatOpenRouter.maskedKey || "not saved"}</p>
                <p className="panel-status">Image gen source: {secretStatus.imageGen.source} · {secretStatus.imageGen.statusText} · Key: {secretStatus.imageGen.maskedKey || "not saved"}</p>
                <p className="panel-status">Image analyze source: {secretStatus.imageAnalyze.source} · {secretStatus.imageAnalyze.statusText} · Key: {secretStatus.imageAnalyze.maskedKey || "not saved"}</p>
                {secretStatusMsg && <p className="panel-status">{secretStatusMsg}</p>}
              </>}

              <h4>Navigation Editor</h4>
              {project.site.nav.map((item, i) => (
                <div key={item.id} className="nav-edit-row">
                  <input value={item.label} onChange={(e) => updateNav(i, { label: e.target.value })} />
                  <input value={item.href} onChange={(e) => updateNav(i, { href: e.target.value })} />
                  <button onClick={() => moveNav(i, "up")}>↑</button>
                  <button onClick={() => moveNav(i, "down")}>↓</button>
                  <button onClick={() => removeNav(i)}>X</button>
                </div>
              ))}
              <button onClick={addNav}>Add Nav Item</button>

              <h4>Deploy Settings</h4>
              <label>Method
                <select value={project.deploy.method} onChange={(e) => { setProject({ ...project, deploy: { ...project.deploy, method: e.target.value as SBuildProject["deploy"]["method"] } }); setDirty(true); }}>
                  <option value="dry-run">dry-run</option>
                  <option value="local-web-root">local-web-root</option>
                  <option value="git">git</option>
                </select>
              </label>
              <label>Web Root
                <input value={project.deploy.webRoot} onChange={(e) => { setProject({ ...project, deploy: { ...project.deploy, webRoot: e.target.value } }); setDirty(true); }} />
              </label>
              <label>GitHub Repo URL
                <input value={project.deploy.githubRepo || ""} onChange={(e) => { setProject({ ...project, deploy: { ...project.deploy, githubRepo: e.target.value } }); setDirty(true); }} placeholder="https://github.com/org/repo" />
              </label>
              <label>Token Placeholder <input value="" placeholder="not stored in prototype" readOnly /></label>
              <div className="button-row">
                <button onClick={async () => setStatus(JSON.stringify(await fetchJson("/api/backup", { method: "POST", body: "{}" })))}>Backup</button>
                <button onClick={async () => setStatus("Use /api/restore with backup path")}>Restore</button>
              </div>
            </div>
          )}
    </>;
  }

  if (!project || !selectedPage) {
    return <div className="loading">Loading sBuild...</div>;
  }

  return (
    <>
    {imageEditModalOpen && imageEditSnapshot && (
      <div
        className="image-edit-modal-backdrop"
        data-testid="image-edit-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeImageEditModal();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit image"
      >
        <div className="image-edit-modal">
          <div className="image-edit-modal-header" data-testid="image-edit-modal-header">
            <h3>Editing: {imageEditSnapshot.label}</h3>
            <p className="hint">Source image is locked — selecting a different block will not change the source mid-edit.</p>
            <button
              className="image-edit-modal-close"
              data-testid="image-edit-modal-close"
              onClick={() => closeImageEditModal()}
              aria-label="Close edit modal"
            >✕</button>
          </div>
          <div className="image-edit-modal-tabs" data-testid="image-edit-modal-tabs">
            <button
              className={imageEditModalTab === "options" ? "selected" : ""}
              onClick={() => setImageEditModalTab("options")}
              data-testid="image-edit-modal-tab-options"
            >Options</button>
            <button
              className={imageEditModalTab === "preview" ? "selected" : ""}
              onClick={() => setImageEditModalTab("preview")}
              data-testid="image-edit-modal-tab-preview"
              disabled={!aiEnhanceResult}
            >Preview</button>
            <button
              className={imageEditModalTab === "history" ? "selected" : ""}
              onClick={() => setImageEditModalTab("history")}
              data-testid="image-edit-modal-tab-history"
            >History</button>
          </div>

          <div className="image-edit-modal-source" data-testid="image-edit-modal-source">
            <strong>Source preview</strong>
            <div className="image-edit-modal-source-row">
              <img
                src={imageEditSnapshot.src}
                alt={`Source: ${imageEditSnapshot.label}`}
                className="image-edit-modal-source-thumb"
                data-testid="image-edit-modal-source-thumb"
              />
              <div className="image-edit-modal-source-meta">
                <p><strong>Name:</strong> {imageEditSnapshot.label}</p>
                <p><strong>Locked at:</strong> {new Date(imageEditSnapshot.openedAt).toLocaleString()}</p>
                {aiEnhanceResult && (
                  <p data-testid="image-edit-modal-locked-to-enhanced">
                    <strong>Now editing:</strong> edited version
                  </p>
                )}
              </div>
            </div>
            {aiEnhanceResult && aiEnhanceResult !== imageEditSnapshot.src && (
              <p className="hint" style={{ marginTop: 6 }}>
                Next edit will operate on the edited preview, not the original. Original source is preserved.
              </p>
            )}
          </div>

          {imageEditModalTab === "options" && (
            <div className="image-edit-modal-body" data-testid="image-edit-modal-options">
              <div className="image-edit-modal-edit-type">
                <label><strong>Edit type</strong>
                  <select
                    data-testid="image-edit-modal-type-select"
                    value={aiEnhanceType}
                    onChange={(e) => setAiEnhanceType(e.target.value)}
                  >
                    <option value="enhance">Enhance (auto)</option>
                    <option value="brighten">Brighten (+25% brightness)</option>
                    <option value="darken">Darken (–22% brightness)</option>
                    <option value="sharpen">Sharpen</option>
                    <option value="color-pop">Color Pop</option>
                    <option value="black-white">Black &amp; White</option>
                    <option value="soften-bg">Soften Background</option>
                    <option value="crop-fit">Crop/Fit to selected block</option>
                    <option value="square-crop">Square Crop</option>
                    <option value="wide-hero-crop">Wide / Hero Crop</option>
                  </select>
                </label>
              </div>
              <div className="image-edit-modal-instruction">
                <label><strong>Custom instruction (optional)</strong>
                  <textarea
                    data-testid="image-edit-modal-instruction"
                    value={aiEnhancePrompt}
                    onChange={(e) => {
                      setAiEnhancePrompt(e.target.value);
                      setImageEditCustomInstruction(e.target.value);
                    }}
                    rows={3}
                    placeholder="Describe what to enhance or change. Leave blank for default behavior of the selected edit type."
                  />
                </label>
              </div>
              <div className="image-edit-modal-actions-row">
                <button
                  className="image-edit-modal-primary"
                  data-testid="image-edit-modal-run"
                  onClick={() => void aiEnhanceImage()}
                  disabled={!aiEnhanceSourceOverride}
                >
                  {aiEnhanceStatus && aiEnhanceStatus.startsWith("Processing") ? "Processing..." : "Run edit"}
                </button>
                <button
                  onClick={() => {
                    setAiEnhancePrompt("");
                    setImageEditCustomInstruction("");
                    setAiEnhanceType("enhance");
                  }}
                >Reset options</button>
              </div>
              {aiEnhanceStatus && (
                <div className="image-edit-modal-status" data-testid="image-edit-modal-status">
                  <p>{aiEnhanceStatus}</p>
                </div>
              )}
            </div>
          )}

          {imageEditModalTab === "preview" && (
            <div className="image-edit-modal-body" data-testid="image-edit-modal-preview">
              {!aiEnhanceResult && (
                <p className="hint">No edited preview yet. Run an edit from the Options tab to see a preview here.</p>
              )}
              {aiEnhanceResult && (
                <>
                  <p><strong>Edited preview</strong></p>
                  <img
                    src={aiEnhanceResult}
                    alt="Edited preview"
                    className="image-edit-modal-preview-image"
                    data-testid="image-edit-modal-preview-image"
                  />
                  <p className="hint" data-testid="image-edit-modal-preview-hint">
                    The preview is generated from the locked source above. The website is NOT updated until you choose one of the actions below.
                  </p>
                  <div className="image-edit-modal-apply-actions">
                    <button
                      data-testid="image-edit-modal-save-to-library"
                      onClick={() => {
                        setImageEditApplied(true);
                        setAiEnhanceStatus("Edited preview is already in the Image Library (the edit handler saves to the library). Use Apply to push it to the selected block.");
                        void loadImages();
                      }}
                    >Save to Image Library</button>
                    <button
                      data-testid="image-edit-modal-apply-to-block"
                      onClick={() => {
                        applyImageToSelectedBlock(aiEnhanceResult, `AI enhanced (${aiEnhanceType})`);
                        setImageEditApplied(true);
                        setAiEnhanceStatus("Applied preview to selected block. Save project to persist.");
                      }}
                      disabled={!selectedBlock}
                    >Apply to Selected Block</button>
                    <button
                      data-testid="image-edit-modal-save-and-apply"
                      onClick={() => {
                        applyImageToSelectedBlock(aiEnhanceResult, `AI enhanced (${aiEnhanceType})`);
                        setImageEditApplied(true);
                        setAiEnhanceStatus("Saved to Image Library AND applied to selected block. Save project to persist.");
                        void loadImages();
                      }}
                      disabled={!selectedBlock}
                    >Save and Apply</button>
                    {selectedBlock?.type === "gallery" && (
                      <button
                        data-testid="image-edit-modal-add-to-gallery"
                        onClick={() => {
                          if (!aiEnhanceResult) return;
                          addGalleryImage(aiEnhanceResult);
                          setAiEnhanceStatus("Added to selected gallery block.");
                          setImageEditApplied(true);
                        }}
                      >Add to Website Gallery</button>
                    )}
                    <button
                      data-testid="image-edit-modal-cancel"
                      onClick={() => cancelImageEditModal()}
                    >Cancel</button>
                  </div>
                  {imageEditApplied && (
                    <p className="image-edit-modal-applied" data-testid="image-edit-modal-applied">
                      Action taken. Save the project to persist any block changes.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {imageEditModalTab === "history" && (
            <div className="image-edit-modal-body" data-testid="image-edit-modal-history">
              <p className="hint">This edit session started at {new Date(imageEditSnapshot.openedAt).toLocaleString()}.</p>
              <ul>
                <li>Source locked: {imageEditSnapshot.label}</li>
                {aiEnhanceResult && <li>Latest edit: {aiEnhanceType} → preview ready</li>}
                {imageEditApplied && <li>Applied to selected block or library</li>}
                {!aiEnhanceResult && !imageEditApplied && <li>No edits yet</li>}
              </ul>
              <p className="hint">Closing this modal does not delete the source image. Cancel discards any preview before applying.</p>
            </div>
          )}
        </div>
      </div>
    )}
    <div className={`app sbuild-editor-shell ${previewMode ? "preview" : "edit"} ${editorTheme === "Dark" ? "theme-dark" : ""} ${isMobileViewport ? "mobile-shell" : ""} ${isMobileViewport && !leftCollapsed ? "mobile-left-open" : ""} ${isMobileViewport && rightDrawerMobileOpen ? "mobile-right-open" : ""} ${paintMode && !previewMode ? "paint-active" : ""}`}>
      <header ref={topbarRef} className="topbar">
        <div className="topbar-mobile-row topbar-mobile-row-main">
          <button onClick={() => { setLeftCollapsed((prev) => { const next = !prev; setStatus(next ? "Left panel collapsed" : "Left panel opened"); return next; }); }}>☰</button>
          <div className="logo" title={`sBuild ${displayVersion} - base ${SBUILD_VERSION}, commit count ${buildInfo?.commitCount ?? "?"}, server commit ${buildIdentity.serverCommit}, browser commit ${buildIdentity.browserCommit}`}>{SBUILD_APP_NAME} {displayVersion.toUpperCase()}</div>
          <button onClick={() => setPreviewMode((v) => !v)}>{previewMode ? "Edit" : "Preview"}</button>
          <button onClick={() => { if (paintMode) { discardPaintAndExit(); } else { setPaintMode(true); setPaintActivePoints([]); setPaintRedoStrokes([]); setStatus("Markup mode on"); setAiTopMenuOpen(false); } }} className={paintMode ? "active" : ""}>Markup</button>
        </div>
        <div className="topbar-mobile-row topbar-mobile-row-actions">
          <button onClick={() => { setImageManagerOpen(true); setImageManagerTarget("block-bg"); setStatus("Image Library opened"); }}>Images</button>
          <button onClick={() => toggleAiTopMenu()} className={aiTopMenuOpen ? "active" : ""} title="AI Top Menu">AI</button>
          <button onClick={() => setHelpOpen(true)} title="Help / User Guide">?</button>
          <button onClick={() => {
            setSettingsOpen(true);
            setSettingsTab("general");
            setStatus("Settings opened");
            setAcctMsg("");
            setAcctMsgOk(false);
            setCreateMsg("");
            setCreateMsgOk(false);
            setResetPwMsg("");
            setResetPwMsgOk(false);
            void fetchUserInfo();
          }}>Settings</button>
          <button onClick={() => void saveProject()}>Save</button>
          <button onClick={() => void revertProject()} disabled={!dirty}>Revert</button>
          <button onClick={() => void runBuild()}>Build</button>
          <button onClick={() => void runPublish()}>Publish</button>
        </div>
        <div className="topbar-mobile-row topbar-mobile-row-status">
          <div ref={statusPillRef} className="topbar-status" data-status-row="topbar-status-pill">
            <span className="status-pill-text">Status: {withSavedStatusText(status, dirty)} &middot; {status}</span>
          </div>
        </div>
      </header>
      <div ref={spacerRef} className="topbar-mobile-spacer" />
      {showVersionIdentityBanner && (
        <VersionIdentityBanner
          buildIdentity={buildIdentity}
          buildInfoError={buildInfoError}
          onDismiss={() => setVersionBannerDismissed(true)}
        />
      )}
      {paintMode && !previewMode && (
        <MarkupWorkspace
          pageTitle={selectedPage?.title || "No page selected"}
          blockLabel={selectedBlock ? (blockTypeLabels[selectedBlock.type] || selectedBlock.type) : "No block selected"}
          blockId={selectedBlock?.id || ""}
          deviceMode={deviceMode}
          annotations={currentPageMarkupAnnotations}
          saveStatusText={withSavedStatusText(status, dirty)}
          draftStrokeCount={paintDraftStrokes.length}
          appliedStrokeCount={paintAppliedStrokes.length}
          redoStrokeCount={paintRedoStrokes.length}
          activePointCount={paintActivePoints.length}
          paintTool={paintTool}
          paintDrawMode={paintDrawMode}
          paintColor={paintColor}
          paintSize={paintSize}
          onClose={discardPaintAndExit}
          onSelectTool={setPaintTool}
          onSelectDrawMode={setPaintDrawMode}
          onColorChange={setPaintColor}
          onSizeChange={setPaintSize}
          onClearDraft={clearPaintDraft}
          onClearFreeDraw={clearAppliedFreeDraw}
          onUndoDraft={undoPaintDraft}
          onRedoDraft={redoPaintDraft}
          onKeepMarkup={applyPaintOverlay}
          onSaveProject={saveProject}
          onCreateNote={createMarkupNote}
          onUpdateNoteText={updateMarkupNoteText}
          onMoveNote={moveMarkupNote}
          onDeleteNote={deleteMarkupNote}
          paintCaptureActive={paintExclusiveMode}
          controlsCollapsed={markupControlsCollapsed}
          onToggleControls={() => setMarkupControlsCollapsed((v) => !v)}
          stageRightInsetPx={markupStageRightInset}
          freehandLayer={
            <svg
              className={`paint-overlay ${paintExclusiveMode ? "capture-active" : ""}`}
              onPointerDown={paintExclusiveMode ? beginPaint : undefined}
              onPointerMove={paintExclusiveMode ? movePaint : undefined}
              onPointerUp={paintExclusiveMode ? endPaint : undefined}
            >
              {paintAppliedStrokes.map((stroke) => (
                renderMarkupStroke(stroke.id, stroke.points, stroke.color, stroke.size, stroke.opacity, MARKUP_APPLIED_STROKE_OPACITY)
              ))}
              {paintDraftStrokes.map((stroke) => (
                renderMarkupStroke(stroke.id, stroke.points, stroke.color, stroke.size, stroke.opacity, MARKUP_DRAFT_STROKE_OPACITY)
              ))}
              {paintMode && paintActivePoints.length > 1 && (
                renderMarkupStroke("active-stroke", paintActivePoints, paintColor, paintSize, MARKUP_DRAFT_STROKE_OPACITY, MARKUP_DRAFT_STROKE_OPACITY)
              )}
            </svg>
          }
        />
      )}

      {aiTopMenuOpen && (
        <div className="ai-panel-backdrop" onClick={() => setAiTopMenuOpen(false)} />
      )}
      {aiTopMenuOpen && (
        <div
          ref={aiPanelRef}
          className={`ai-panel ${!isMobileViewport ? "ai-panel-desktop" : ""}`}
          role="dialog"
          aria-label="AI panel"
          onClick={(e) => e.stopPropagation()}
          style={!isMobileViewport ? {
            left: aiPanelRect.x,
            top: aiPanelRect.y,
            width: aiPanelRect.width,
            height: aiPanelRect.height,
            right: "auto",
            bottom: "auto",
            transform: "none"
          } : undefined}
        >
          <div className="ai-panel-header" onPointerDown={handleAiPanelDragStart}>
            <span className="ai-panel-title">sBuild AI</span>
            {!isMobileViewport && <span className="ai-panel-drag-handle" title="Drag panel">Drag panel</span>}
            <div className="ai-panel-tabs">
              <button onClick={() => setAiTopMenuTab("chat")} className={aiTopMenuTab === "chat" ? "selected" : ""}>AI Chat</button>
              <button onClick={() => setAiTopMenuTab("image-gen")} className={aiTopMenuTab === "image-gen" ? "selected" : ""}>AI Image Gen</button>
              <button onClick={() => setAiTopMenuTab("image-enhance")} className={aiTopMenuTab === "image-enhance" ? "selected" : ""}>AI Image Enhance</button>
            </div>
            {!isMobileViewport && <button className="ai-panel-reset" onClick={resetAiPanelPosition} title="Reset panel position and size">Reset panel</button>}
            <button className="ai-panel-close" onClick={() => setAiTopMenuOpen(false)} aria-label="Close AI panel">✕</button>
          </div>
          <div className="ai-panel-body">
            {aiTopMenuTab === "chat" && (
              <div className="ai-panel-tab-content ai-chat-layout">
                {chatProviderStatus && <div className="ai-chat-provider-status">{chatProviderStatus.message}</div>}
                {(previewMode || paintMode) && (
                  <div className="ai-chat-mode-notice">
                    {previewMode && "Planning only — preview mode will not edit the page."}
                    {paintMode && "Planning only — markup can be referenced, but changes are not applied here."}
                  </div>
                )}
                {!previewMode && !paintMode && (
                  <div className="ai-chat-toolbar">
                    <div className="ai-chat-target-buttons">
                      <button onClick={() => setAiChatTarget("block")} className={aiChatTarget === "block" ? "selected" : ""} title="Prefer the selected block when the user asks about it">Focus: Selected Block</button>
                      <button onClick={() => setAiChatTarget("page")} className={aiChatTarget === "page" ? "selected" : ""} title="Prefer the current page">Focus: Page</button>
                      <button onClick={() => setAiChatTarget("site")} className={aiChatTarget === "site" ? "selected" : ""} title="Whole site context">Focus: Site</button>
                    </div>
                    <div className="ai-chat-scope-status" data-testid="ai-chat-engine-status">
                      {lastEngine
                        ? formatChatEngineStatus({
                            engine: lastEngine,
                            mode: lastEngineMode,
                            provider: lastEngineProvider,
                            model: lastEngineModel,
                            latencyMs: lastEngineLatencyMs,
                            timeoutMs: lastEngineTimeoutMs,
                            reason: lastEngineReason,
                            fallbackUsed: lastFallbackUsed,
                            fallbackFrom: lastFallbackFrom,
                            fallbackReason: lastFallbackReason
                          })
                        : aiChatTarget === "block"
                          ? "Default: focus on selected block, full site context in LLM prompt"
                          : aiChatTarget === "page"
                            ? "Default: focus on current page, full site context in LLM prompt"
                            : "Default: whole-site context in LLM prompt"}
                    </div>
                    {paintAppliedStrokes.length > 0 && (
                      <button className="ai-markup-attach-btn" title="Attach markup notes to AI request">Attach Markup ({paintAppliedStrokes.length})</button>
                    )}
                  </div>
                )}
                <div className="ai-chat-messages" ref={chatMessagesRef}>
                  {chatHistory.length === 0 && (
                    <div className="ai-chat-greeting">
                      <div className="ai-chat-msg-text">Tell me what you want to change. I can help with copy, layout, images, or planning.</div>
                    </div>
                  )}
                  {chatHistory.map((msg) => renderChatMessage(msg))}
                  {aiProposalPending && <div className="ai-chat-msg ai-chat-msg-assistant"><div className="ai-chat-msg-role">AI</div><div className="ai-chat-msg-text ai-chat-typing">Thinking...</div><div className="ai-chat-msg-footer">Waiting for response...</div></div>}
                </div>
                {!previewMode && !paintMode && (
                  <div className="ai-chat-action-bar">
                    {aiUndoSnapshot && <button onClick={undoAiChange} className="ai-undo-btn">Undo AI Change</button>}
                    <button onClick={applyAiProposal} disabled={!aiHasProposal} className="ai-apply-btn">Apply Suggestion</button>
                    {!aiHasProposal && chatHistory.length > 0 && aiProposalPending === false && (
                      <span className="ai-apply-reason">No structured proposal to apply</span>
                    )}
                  </div>
                )}
                {(previewMode || paintMode) && aiHasProposal && (
                  <div className="ai-chat-action-bar">
                    <button disabled className="ai-apply-btn">Apply Suggestion</button>
                    <span className="ai-apply-reason">{previewMode ? "Preview mode — switch to Edit to apply" : "Markup mode — switch to Edit to apply"}</span>
                  </div>
                )}
                <div className="ai-chat-input-area">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) { e.preventDefault(); void aiAskSuggest(); } }}
                    placeholder="Type a message..."
                    className="ai-chat-input"
                    rows={1}
                  />
                  <button onClick={() => void aiAskSuggest()} disabled={aiProposalPending || !chatInput.trim()} className="ai-chat-send">Send</button>
                </div>
                <div className="ai-chat-controls-bar">
                  <button onClick={clearAiChat} className="ai-chat-clear" title="Clear current conversation">Clear Chat</button>
                  {chatHistory.length > 0 && <button onClick={saveChat} className="ai-chat-save" title="Save chat to server">Save Chat</button>}
                  <button onClick={restoreChat} className="ai-chat-restore" title="Restore saved chat history">Restore Chat</button>
                  <button onClick={viewHistory} className="ai-chat-view-history" title="View saved chat history">View History</button>
                  {chatSaveStatus && <span className="ai-chat-save-status">{chatSaveStatus}</span>}
                  {chatHistory.length > 0 && <button onClick={() => void deleteChatHistory()} className="ai-chat-delete-history" title="Delete saved chat history">Delete History</button>}
                </div>
                {aiHistoryView && (
                  <div className="ai-history-modal-overlay" onClick={() => setAiHistoryView(false)}>
                    <div className="ai-history-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="ai-history-modal-header">
                        <span>Chat History</span>
                        <button onClick={() => setAiHistoryView(false)} className="ai-history-close">&times;</button>
                      </div>
                      <div className="ai-history-modal-body">
                        {aiHistoryMessages.map((msg) => (
                          <div key={msg.id} className={`ai-chat-msg ai-chat-msg-${msg.role}`}>
                            <div className="ai-chat-msg-role">{msg.role === "user" ? "You" : "AI"}</div>
                            <div className="ai-chat-msg-text">{msg.role === "assistant" ? stripRawProposalJson(msg.text) : msg.text}</div>
                            <div className="ai-chat-msg-footer">{chatFooterText(msg)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {aiTopMenuTab === "image-gen" && (
              <div className="ai-panel-tab-content">
                <div className="ai-image-gen-topbar" data-testid="ai-img-gen-topbar">
                  <button
                    className="ai-action-primary"
                    onClick={() => void aiGenerateImage()}
                    disabled={!aiImgGenPrompt.trim()}
                    data-testid="ai-img-gen-generate"
                  >Generate Image</button>
                  <button
                    onClick={() => void aiGenerateImage()}
                    disabled={!aiImgGenPrompt.trim() || !aiImgGenResult}
                    title="Generate a fresh image with the same prompt"
                    data-testid="ai-img-gen-regenerate"
                  >Regenerate</button>
                  <button
                    onClick={() => { setImageManagerTarget("block-bg"); setImageManagerOpen(true); }}
                    title="Open the shared project image library"
                    data-testid="ai-img-gen-open-library"
                  >Open Image Library</button>
                </div>
                <details className="ai-card ai-card-advanced" data-testid="ai-img-gen-advanced-section" style={{ margin: "0 8px" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 12, padding: "4px 0", color: "var(--editor-text)" }}>Target &amp; Presets</summary>
                  <div className="ai-card-body" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12 }}>{hasSelectedImageTarget() ? `${blockTypeLabels[selectedBlock!.type] || selectedBlock!.type} block` : "project image library"}</span>
                      <div className="ai-chat-target-buttons">
                        <button onClick={() => setAiImgGenTarget("block")} className={aiImgGenTarget === "block" ? "selected" : ""} disabled={!hasSelectedImageTarget()}>Selected Block</button>
                        <button onClick={() => setAiImgGenTarget("library")} className={aiImgGenTarget === "library" ? "selected" : ""}>Image Library</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div className="ai-preset-group">
                        <label>Style</label>
                        <select value={imageGenStyle} onChange={(e) => setImageGenStyle(e.target.value)}>
                          {IMAGE_GEN_STYLE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="ai-preset-group">
                        <label>Size</label>
                        <select value={imageGenSize} onChange={(e) => setImageGenSize(e.target.value)}>
                          {IMAGE_GEN_SIZE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="ai-preset-group">
                        <label>Placement</label>
                        <select value={imageGenPlacement} onChange={(e) => setImageGenPlacement(e.target.value)} data-testid="ai-img-gen-placement-select">
                          <option value="preview-only">Preview only (recommended)</option>
                          <option value="block-background">Block background (cover)</option>
                          <option value="selected-image">Selected image</option>
                          <option value="fit-block">Fit to block (contain)</option>
                          <option value="fill-block">Fill block (stretch)</option>
                          <option value="add-to-gallery">Add to gallery</option>
                          <option value="save-library">Save to library only</option>
                          <option value="center-focal">Center focal point</option>
                          <option value="top-center">Top center crop</option>
                          <option value="bottom-center">Bottom center crop</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </details>
                <div className="ai-card ai-card-prompt">
                  <div className="ai-card-label">Image Prompt</div>
                  <div className="ai-card-body">
                    <textarea value={aiImgGenPrompt} onChange={(e) => setAiImgGenPrompt(e.target.value)} rows={3} placeholder="Describe the image to generate..." />
                    <button
                      className="ai-action-primary"
                      onClick={() => void aiGenerateImage()}
                      disabled={!aiImgGenPrompt.trim()}
                      data-testid="ai-img-gen-generate-near-prompt"
                      style={{ marginTop: 8, width: "100%", padding: "8px 12px", fontSize: "13px" }}
                    >Generate Image</button>
                  </div>
                </div>
                {aiImgGenStatus && <div className="ai-card ai-card-status"><p>{aiImgGenStatus}</p></div>}
                {aiImgGenResult && (
                  <div className="ai-card ai-card-preview" data-testid="ai-img-gen-preview">
                    <div className="ai-card-label">
                      Preview {aiImgGenIsPreview ? <span className="ai-preview-badge" data-testid="ai-img-gen-preview-badge">Preview only</span> : <span className="ai-preview-badge ai-preview-badge-saved" data-testid="ai-img-gen-preview-badge-saved">Saved to Library</span>}
                    </div>
                    <div className="ai-card-body ai-card-preview-body">
                      <div className="ai-card-preview-image-wrap" data-testid="ai-img-gen-preview-image-wrap">
                        <img src={aiImgGenResult} alt="Generated preview" className="ai-result-image" data-testid="ai-img-gen-preview-image" />
                      </div>
                      <p className="ai-hint" data-testid="ai-img-gen-preview-hint">
                        {aiImgGenIsPreview
                          ? "This preview is stored in a temp cache (gitignored) until you choose to save it. It is NOT in the Image Library and NOT applied to any block."
                          : "This image is now in the Image Library. Use Apply to Selected Block to push it to the page."}
                      </p>
                    </div>
                  </div>
                )}
                {aiImgGenResult && (
                  <div className="ai-image-gen-footer" data-testid="ai-img-gen-footer">
                    <div className="ai-preview-actions" data-testid="ai-img-gen-apply-actions">
                      <button
                        data-testid="ai-img-gen-save-to-library"
                        onClick={() => void aiSavePreviewToLibrary()}
                        disabled={!aiImgGenIsPreview}
                        title="Save this preview into the Image Library (does not apply to any block)"
                      >Save to Library</button>
                      <button
                        data-testid="ai-img-gen-apply-to-block"
                        onClick={() => void aiApplyPreviewToBlock()}
                        disabled={!selectedBlock}
                        title="Apply this image to the selected block"
                      >Apply to Selected Block</button>
                      <button
                        data-testid="ai-img-gen-save-and-apply"
                        onClick={() => void aiSaveAndApplyPreview()}
                        disabled={!selectedBlock || !aiImgGenIsPreview}
                        title="Save to Library AND apply to selected block"
                      >Save and Apply</button>
                      <button
                        data-testid="ai-img-gen-add-to-gallery"
                        onClick={() => { void aiAddImageToGallery(); }}
                        disabled={!hasSelectedImageTarget() || (selectedBlock?.type !== "gallery")}
                        title="Add to selected gallery block"
                      >Add to Website Gallery</button>
                      <button
                        data-testid="ai-img-gen-cancel"
                        onClick={() => void aiDiscardPreview()}
                      >Cancel</button>
                      <button
                        data-testid="ai-img-gen-edit-image"
                        onClick={() => { openImageEditModal(aiImgGenResult, "Generated image"); }}
                        title="Open dedicated image edit modal with full options"
                      >Edit image</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {aiTopMenuTab === "image-enhance" && (
              <div className="ai-panel-tab-content">
                <div className="ai-card ai-card-source" data-testid="ai-image-enhance-source-card">
                  <div className="ai-card-label">Source</div>
                  <div className="ai-card-body">
                    {(() => {
                      const es = aiEnhanceSourceOverride
                        ? { kind: "override" as const, src: aiEnhanceSourceOverride, label: aiEnhanceSourceLabel || "Generated image", reason: undefined }
                        : getSelectedEnhanceSource();
                      if (es.kind === "none" || !es.src) {
                        return <p className="ai-status-msg ai-no-target">{es.reason || "Select an image block, gallery image, or background first."}</p>;
                      }
                      const sourceLabel = es.kind === "override"
                        ? `Source: ${es.label} (locked)`
                        : es.kind === "background"
                          ? "Source: Selected block background"
                          : (es.kind === "gallery-image" || es.kind === "image-block")
                            ? "Source: Image Library"
                            : `Source: ${es.label}`;
                      return (
                        <div className="ai-source-detail">
                          <span className="ai-source-name" data-testid="ai-image-enhance-source-label">{sourceLabel}{es.src ? ` — ${es.src.split("/").pop()}` : ""}</span>
                          {es.src && <img src={es.src} alt="Source" className="ai-source-thumb" data-testid="ai-image-enhance-source-thumb" />}
                          {aiEnhanceSourceOverride && (
                            <button
                              data-testid="ai-image-enhance-unlock-source"
                              onClick={() => { setAiEnhanceSourceOverride(null); setAiEnhanceSourceLabel(""); }}
                              style={{ fontSize: "11px", padding: "2px 8px", marginTop: 4 }}
                            >Unlock source (use selected block)</button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="ai-card ai-card-actions" data-testid="ai-image-enhance-actions">
                  <button
                    className="ai-action-primary"
                    data-testid="ai-image-enhance-open-modal"
                    disabled={!(aiEnhanceSourceOverride || getSelectedEnhanceSource().src)}
                    onClick={() => {
                      const es = aiEnhanceSourceOverride
                        ? { src: aiEnhanceSourceOverride, label: aiEnhanceSourceLabel || "Generated image" }
                        : (() => {
                            const sel = getSelectedEnhanceSource();
                            return { src: sel.src || "", label: sel.label || "Image Library" };
                          })();
                      if (!es.src) {
                        setAiEnhanceStatus("Select an image block, gallery image, or background first.");
                        return;
                      }
                      openImageEditModal(es.src, es.label);
                    }}
                    title="Open the unified image edit modal with the same flow as Image Library Edit image"
                  >Open Edit Modal</button>
                  <button onClick={() => { setImageManagerTarget("block-bg"); setImageManagerOpen(true); }}>Open Image Library</button>
                  <button onClick={clearAiEnhance}>Clear</button>
                </div>
                <p className="ai-hint" data-testid="ai-image-enhance-flow-hint" style={{ fontSize: "11px", color: "var(--editor-muted)", margin: "4px 0 0" }}>
                  The edit modal is the same one used by Image Library &rarr; Edit image. It supports source lock, all 10 edit types, preview before apply, and separate Save / Apply / Add to Gallery actions.
                </p>
                {aiEnhanceStatus && <div className="ai-card ai-card-status"><p>{aiEnhanceStatus}</p></div>}
              </div>
            )}
          </div>
          {!isMobileViewport && (
            <button className="ai-panel-resize-handle ai-panel-resize-corner" onPointerDown={(e) => handleAiPanelResizeStart(e, "corner")} aria-label="Resize AI panel" title="Resize AI panel" />
          )}
        </div>
      )}

        <div className={`workspace ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""} ${previewMode ? "preview-mode" : ""}`}>
        <aside className={`left-drawer ${leftCollapsed ? "collapsed" : ""} ${previewMode ? "preview-hidden" : ""}`}>
          {isMobileViewport && !leftCollapsed && (
            <div className="mobile-drawer-toolbar">
              <strong>Left panel</strong>
              <button className="drawer-close-btn" onClick={() => setLeftCollapsed(true)} aria-label="Close left panel">Close</button>
            </div>
          )}
          <p className="panel-status">
            <strong>Left panel:</strong> page {selectedPage.title} · blocks {selectedPage.blocks.length}
            {drag && ` · dragging ${drag.blockId.slice(0, 12)}`}
          </p>
          <section>
            <h3>Pages</h3>
            {project.pages.map((page) => (
              <button key={page.id} className={`page-list-item ${page.id === selectedPage.id ? "selected" : ""}`} onClick={() => setSelectedPageId(page.id)}>
                <span>{page.title}</span>
                <span className="page-slug-hint">{page.slug}</span>
              </button>
            ))}
            <div className="button-row compact">
              <button className="btn-new-page" onClick={() => { resetNewPageFlow(); setNewPageFlowOpen(true); }}>+ New Page</button>
              <button className="btn-website-manager" onClick={() => { setWebsiteManagerError(""); setWebsiteManagerOpen(true); }}>Website Manager</button>
            </div>
          </section>
          <section>
            <h3>Add Block</h3>
            <div className="palette-grid">
              {BLOCK_TYPES.map((type) => (
                <button key={type} onClick={() => addBlock(type)}>{type}</button>
              ))}
            </div>
          </section>
          <section>
            <h3>Theme</h3>
            <p className="hint">Website theme: affects the preview/site only (your header, nav, and content blocks). Custom block edits stay preserved.</p>
            <p className="hint">Builder UI Theme (in Settings → General) controls editor chrome only — topbar, panels, buttons.</p>
            <label>
              Theme
              <select value={selectedThemeName} onChange={(e) => {
                const next = e.target.value;
                setSelectedThemeName(next);
                const idx = themePresets.findIndex((t) => t.name === next);
                if (idx >= 0) applyTheme(idx);
              }}>
                {themePresets.map((theme) => <option key={theme.name} value={theme.name}>{theme.name}</option>)}
              </select>
            </label>
            <div className="theme-preview-strip">
              {(() => {
                const t = themePresets.find((theme) => theme.name === selectedThemeName) || themePresets[0];
                return (
                  <>
                    <span title="background" className="swatch-color" style={{ background: t.colors.bg }} />
                    <span title="surface" className="swatch-color" style={{ background: t.colors.surface }} />
                    <span title="accent" className="swatch-color" style={{ background: t.colors.accent }} />
                    <span title="text" className="swatch-color" style={{ background: t.colors.text }} />
                  </>
                );
              })()}
            </div>
            <div className="button-row compact">
              <button onClick={() => {
                if (window.confirm("Reset block colors/fonts to the selected theme? Custom block colors may be replaced.")) {
                  applyThemeToAllBlocks();
                }
              }}>Reset blocks to this theme</button>
              <button onClick={() => resetBlockColorsToTheme()}>Reset selected block colors</button>
            </div>
            {themeApplied && <p className="panel-status">Theme: {themeApplied} · dark={themePresets.find((t) => t.name === themeApplied)?.isDark ? "true" : "false"}</p>}
          </section>
          <section>
            <h3>Fonts</h3>
            <input value={fontSearch} onChange={(e) => setFontSearch(e.target.value)} placeholder="Search fonts" />
            <div className="font-list">
              {filteredFonts.map((f) => (
                <button key={f.family} onClick={() => { addRecentFont(f.family); setProject({ ...project, globalStyles: { ...project.globalStyles, headingFont: f.family } }); setDirty(true); }}>{f.family}</button>
              ))}
            </div>
          </section>
          <section>
            <button onClick={() => setShowWizard(true)}>Website Wizard</button>
          </section>
        </aside>

        <main className="canvas-area">
          <div ref={canvasControlsRef} className="canvas-controls" data-testid="canvas-controls">
            <div className="canvas-controls-group">
              <span className="canvas-controls-label">View</span>
              <button onClick={() => setDeviceMode("desktop")} className={deviceMode === "desktop" ? "selected" : ""}>Desktop</button>
              <button onClick={() => setDeviceMode("tablet")} className={deviceMode === "tablet" ? "selected" : ""}>Tablet</button>
              <button onClick={() => setDeviceMode("phone")} className={deviceMode === "phone" ? "selected" : ""}>Phone</button>
            </div>
            {!previewMode && (
              <div className="canvas-controls-group">
                <span className="canvas-controls-label">Selected</span>
                <button onClick={() => duplicateBlock()}>Duplicate</button>
                <button onClick={() => deleteBlock()}>Delete</button>
                <button onClick={() => moveBlock("up")}>Up</button>
                <button onClick={() => moveBlock("down")}>Down</button>
              </div>
            )}
          </div>
          {!previewMode && (
            <p className="panel-status">
              <strong>Canvas debug:</strong> selected {selectedBlock?.type || "none"} · {selectedBlock?.id || "none"} · mode {previewMode ? "preview" : "edit"}
              {drag && ` · dragging ${drag.blockId.slice(0, 12)} ${drag.startIndex}→${drag.currentIndex}`}
              {resizeStatus && ` · ${resizeStatus}`}
              {themeApplied && ` · theme: ${themeApplied}`}
              {!leftCollapsed ? " · left panel open" : " · left panel collapsed"}
            </p>
          )}
          {isMobileViewport && !previewMode && (
            <p className="panel-status mobile-edit-hint">
              <strong>Tip:</strong> Tap text to edit directly · Long-press or tap ⋯ for styles
            </p>
          )}

          <div
            ref={canvasRef}
            className={`canvas-frame sbuild-site-preview sbuild-rendered-page ${deviceMode} ${isMobileViewport ? "mobile-viewport" : ""} ${paintExclusiveMode ? "paint-exclusive" : ""}`}
            style={{ background: project.globalStyles.colors.bg, color: project.globalStyles.colors.text }}
            onClick={() => { if (canEditBlocks) { setSelectedSitePart(null); setSelectedNavIndex(null); } }}
          >
            <nav
              className={`canvas-nav ${!previewMode && selectedSitePart === "site-header" ? "selected-site-part" : ""}`}
              onClick={(e) => {
                if (previewMode) return;
                if (e.target === e.currentTarget) {
                  e.stopPropagation();
                  selectSiteHeaderContainer();
                }
              }}
              onPointerDown={(e) => {
                if (previewMode || !isMobileViewport) return;
                if (e.target === e.currentTarget) {
                  startSiteHeaderLongPress("site-header", e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (previewMode || !isMobileViewport) return;
                if (e.target === e.currentTarget) {
                  cancelSiteHeaderLongPress();
                  if (siteHeaderLongPressRef.current.fired) {
                    siteHeaderLongPressRef.current.fired = false;
                    return;
                  }
                }
              }}
              onPointerMove={(e) => {
                if (!siteHeaderLongPressRef.current.timer) return;
                const dx = Math.abs(e.clientX - siteHeaderLongPressRef.current.startX);
                const dy = Math.abs(e.clientY - siteHeaderLongPressRef.current.startY);
                if (dx > 12 || dy > 12) cancelSiteHeaderLongPress();
              }}
              onContextMenu={(e) => openSiteHeaderContextMenu(e)}
            >
              <div className="site-header-left">
                <EditableText
                  tag="strong"
                  className={!previewMode && selectedSitePart === "site-title" && selectedNavIndex === null ? "selected-site-part" : ""}
                  editable={canEditBlocks}
                  value={project.site.siteName}
                  onText={(value) => { setProject({ ...project, site: { ...project.site, siteName: value } }); setDirty(true); }}
                  onClick={(e) => {
                    if (!canEditBlocks) return;
                    e.stopPropagation();
                    if (!isMobileViewport) {
                      setSelectedSitePart("site-title");
                      setSelectedNavIndex(null);
                      setRightTab("properties");
                      setStatus("Editing site title");
                    }
                  }}
                  onPointerDown={(e) => {
                    if (!canEditBlocks || !isMobileViewport) return;
                    startSiteHeaderLongPress("site-title", e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    if (!canEditBlocks || !isMobileViewport) return;
                    cancelSiteHeaderLongPress();
                    if (siteHeaderLongPressRef.current.fired) {
                      siteHeaderLongPressRef.current.fired = false;
                      return;
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!siteHeaderLongPressRef.current.timer) return;
                    const dx = Math.abs(e.clientX - siteHeaderLongPressRef.current.startX);
                    const dy = Math.abs(e.clientY - siteHeaderLongPressRef.current.startY);
                    if (dx > 12 || dy > 12) cancelSiteHeaderLongPress();
                  }}
                />
                {isMobileViewport && canEditBlocks && (
                  <button
                    className="site-header-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSiteHeaderContextMenu(e);
                    }}
                    title="Edit site header"
                  >⋯</button>
                )}
              </div>
              <div className="nav-items">
                {project.site.nav.map((item, ni) => (
                  <EditableText
                    key={item.id}
                    tag="span"
                    className={!previewMode && selectedSitePart === "nav" && selectedNavIndex === ni ? "selected-site-part" : ""}
                    editable={canEditBlocks}
                    value={item.label}
                    onText={(value) => { const nav = [...project.site.nav]; nav[ni] = { ...nav[ni], label: value }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); }}
                    onClick={(e) => {
                      if (previewMode) {
                        e.stopPropagation();
                        const href = item.href || "";
                        if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
                          window.open(href, "_blank", "noopener");
                        } else if (href.startsWith("#")) {
                          const el = href.length > 1 ? document.getElementById(href.slice(1)) : null;
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        } else {
                          const targetSlug = href.startsWith("/") ? href : "/" + href;
                          const targetPage = project.pages.find((p) => p.slug === targetSlug);
                          if (targetPage) {
                            setSelectedPageId(targetPage.id);
                          }
                        }
                        return;
                      }
                      e.stopPropagation();
                      if (!isMobileViewport) {
                        setSelectedSitePart("nav");
                        setSelectedNavIndex(ni);
                        setRightTab("properties");
                        setStatus(`Editing nav link ${ni + 1}`);
                      }
                    }}
                    onPointerDown={(e) => {
                      if (!canEditBlocks || !isMobileViewport) return;
                      startSiteHeaderLongPress("nav", e.clientX, e.clientY, ni);
                    }}
                    onPointerUp={(e) => {
                      if (!canEditBlocks || !isMobileViewport) return;
                      cancelSiteHeaderLongPress();
                      if (siteHeaderLongPressRef.current.fired) {
                        siteHeaderLongPressRef.current.fired = false;
                        return;
                      }
                    }}
                    onPointerMove={(e) => {
                      if (!siteHeaderLongPressRef.current.timer) return;
                      const dx = Math.abs(e.clientX - siteHeaderLongPressRef.current.startX);
                      const dy = Math.abs(e.clientY - siteHeaderLongPressRef.current.startY);
                      if (dx > 12 || dy > 12) cancelSiteHeaderLongPress();
                    }}
                  />
                ))}
              </div>
            </nav>

            {rowRenderItems.map((item, rowItemIndex) => {
              const row = item.kind === "row" ? item : { rowId: `single:${item.block.id}`, blocks: [item.block] };
              const rowTemplate = shouldStackRows
                ? "minmax(0, 1fr)"
                : row.blocks.map(() => "minmax(0, 1fr)").join(" ");
              return (
              <div
                key={`${row.rowId}-${rowItemIndex}`}
                className={`row-shell ${row.blocks.length > 1 ? "multi" : "single"} ${shouldStackRows ? "stack" : ""}`}
                data-row-id={row.rowId}
                data-device-mode={deviceMode}
                data-stack-rows={shouldStackRows ? "true" : "false"}
                data-row-columns={row.blocks.length}
              >
                <div className="row-label">{shortRowId(row.rowId.startsWith("single:") ? undefined : row.rowId)} · {row.blocks.length} columns</div>
                {canEditBlocks && row.blocks.length > 1 && (
                  <div className="row-debug" aria-label="Row debug status">
                    Row debug: mode={deviceMode} stack={shouldStackRows ? "true" : "false"} cols={row.blocks.length} template={rowTemplate}
                  </div>
                )}
                <div className="row-grid" style={{ gridTemplateColumns: rowTemplate }}>
                  {row.blocks.map((block) => {
                    const index = selectedPage.blocks.findIndex((b) => b.id === block.id);
                    const width = block.styles?.layout?.widthPercent || 100;
                    const minH = block.styles?.layout?.minHeightPx || 120;
                    return (
                      <div
                        key={block.id}
                        className={`block-shell ${block.id === selectedBlock?.id ? "selected-block" : ""} ${drag?.blockId === block.id ? "dragging" : ""} ${shouldStackRows ? "mobile-row-block" : ""}`}
                        data-background-style={block.styles?.parts?.container?.backgroundStyle || block.styles?.backgroundStyle || ""}
                        style={blockStyleToCss(block)}
                        onClick={() => { if (!isMobileViewport && canEditBlocks) selectBlock(block.id); }}
                        onContextMenu={(e) => { if (canEditBlocks) openContextMenu(e, block.id); }}
                        onPointerDown={(e) => handleBlockPointerDown(e, block.id, index)}
                        onPointerUp={(e) => handleBlockPointerUp(e, block.id, index)}
                        onPointerMove={(e) => handleBlockPointerMove(e, block.id, index)}
                        draggable={canEditBlocks}
                        onDragStart={() => { if (canEditBlocks) handleDragStart(block.id, index); }}
                        onDragEnter={() => { if (canEditBlocks) handleDragEnter(index); }}
                        onDragEnd={() => { if (canEditBlocks) handleDragEnd(); }}
                      >
                        {canEditBlocks && (
                          <div className="block-meta">
                            <div className="block-meta-main">
                              <span className="grab-handle" title="Drag to reorder">⋮⋮</span>
                              <span className="block-friendly-label">{blockTypeLabels[block.type] || block.type}</span>
                              <span className="block-id-debug">{block.id.slice(0, 12)}</span>
                            </div>
                            <div className="block-meta-badges">
                              <span className="resize-badge">{row.rowId.startsWith("single:") ? "Single" : `${shortRowId(row.rowId)} · ${width}%`} · {minH}px</span>
                            </div>
                            <button className="context-btn" onClick={(e) => { e.stopPropagation(); openContextMenu(e, block.id); }} title="Menu">⋯</button>
                          </div>
                        )}
                        {renderTypedBlock(block, (field, value) => {
                          patchBlock(block.id, (current) => ({ ...current, data: { ...(current.data as Record<string, unknown>), [field]: value } }));
                        }, canEditBlocks ? (index) => selectGallerySlot(block.id, index) : undefined, selectedBlock?.id === block.id ? selectedGalleryIndex : null, isMobileViewport, canEditBlocks ? (index) => openGallerySlotDrawer(block.id, index) : undefined, !canEditBlocks, (cardIndex, field, value) => {
                          patchBlock(block.id, (current) => {
                            const data = current.data as CardsBlockData;
                            const cards = [...data.cards];
                            cards[cardIndex] = { ...cards[cardIndex], [field]: value };
                            return { ...current, data: { ...data, cards } };
                          });
                        }, (part) => activateBlockTextTarget(block.id, part))}
                        {selectedBlock?.id === block.id && canEditBlocks && (
                          <>
                            <button className="resize-handle right" onPointerDown={(e) => { e.stopPropagation(); setResizeDrag({ handle: "right", blockId: block.id, startX: e.clientX, startY: e.clientY, startWidth: block.styles?.layout?.widthPercent || 100, startMinHeight: block.styles?.layout?.minHeightPx || 120 }); }} />
                            <button className="resize-handle bottom" onPointerDown={(e) => { e.stopPropagation(); setResizeDrag({ handle: "bottom", blockId: block.id, startX: e.clientX, startY: e.clientY, startWidth: block.styles?.layout?.widthPercent || 100, startMinHeight: block.styles?.layout?.minHeightPx || 120 }); }} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )})}

          </div>
        </main>

        {!isMobileViewport && !previewMode && (
        <aside className={`right-drawer ${rightCollapsed ? "collapsed" : ""}`}>
          {!rightCollapsed && (
            <>
              <div className="right-drawer-header">
                <div className="right-drawer-header-bar">
                  <div className="mobile-drawer-tab-row">
                    <div className="tabs compact-tabs">
                      <button onClick={() => setRightTab("properties")} className={rightTab === "properties" ? "selected" : ""} title="Properties">Props</button>
                      <button onClick={() => setRightTab("style")} className={rightTab === "style" ? "selected" : ""} title="Style">Style</button>
                      <button onClick={() => { setRightTab("properties"); setPropertiesTab("resize"); }} className={rightTab === "properties" && propertiesTab === "resize" ? "selected" : ""} title="Resize">Resize</button>
                      <button onClick={() => setRightTab("images")} className={rightTab === "images" ? "selected" : ""} title="Images">Images</button>
                      <button onClick={() => setRightTab("ai")} className={rightTab === "ai" ? "selected" : ""} title="AI Chat">AI</button>
                      <button onClick={() => setRightTab("status")} className={rightTab === "status" ? "selected" : ""} title="Debug">Debug</button>
                    </div>
                  </div>
                  <button className="right-drawer-collapse-btn" onClick={() => setRightCollapsed(true)} aria-label="Collapse right panel" title="Collapse right panel">≫</button>
                </div>
                <p className="panel-status right-target-summary">{targetSummary()}</p>
              </div>
              <div className="right-drawer-content">
                {renderRightDrawerBody()}
              </div>
            </>
          )}
        </aside>
        )}
        {!isMobileViewport && !previewMode && rightCollapsed && (
          <button className="right-drawer-restore-btn" onClick={() => setRightCollapsed(false)} aria-label="Open right panel" title="Open right panel">≪</button>
        )}
      </div>

      {isMobileViewport && (
        <div className={`mobile-editor-overlay ${rightDrawerMobileOpen ? "open" : ""}`}>
          <section className="mobile-editor-sheet" role="dialog" aria-label="Edit block">
            <div className="mobile-editor-sheet-header">
              <div className="mobile-editor-header-left">
                <h2>{mobileDrawerHeading()}</h2>
                <p className="mobile-editor-target-inline">{targetSummary()}</p>
              </div>
              <button className="mobile-editor-x-close" onClick={() => setRightDrawerMobileOpen(false)} aria-label="Close editor drawer">✕</button>
            </div>
            <div className="mobile-editor-sheet-tabs">
              <div className="tabs compact-tabs">
                <button onClick={() => setRightTab("properties")} className={rightTab === "properties" ? "selected" : ""} title="Properties">Props</button>
                <button onClick={() => setRightTab("style")} className={rightTab === "style" ? "selected" : ""} title="Style">Style</button>
                <button onClick={() => { setRightTab("properties"); setPropertiesTab("resize"); }} className={rightTab === "properties" && propertiesTab === "resize" ? "selected" : ""} title="Resize">Resize</button>
                {showImagesAction() && (
                  <button onClick={() => setRightTab("images")} className={rightTab === "images" ? "selected" : ""} title="Images">Images</button>
                )}
                <button onClick={() => openAiDrawer()} className={rightTab === "ai" ? "selected" : ""} title="AI Chat">AI</button>
                <button onClick={() => setRightTab("status")} className={rightTab === "status" ? "selected" : ""} title="Debug">Debug</button>
              </div>
            </div>
            <div className="mobile-editor-sheet-body">
              {renderRightDrawerBody()}
            </div>
          </section>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu?.visible && (
        <>
        <div className="context-menu-backdrop" onClick={() => setContextMenu(null)} />
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.isSiteHeader ? (
            <>
              <button onClick={() => { openSiteHeaderDrawer("site-header"); setContextMenu(null); }}>Edit Properties</button>
              <button onClick={() => { openAiDrawer(); setContextMenu(null); setAiTopMenuOpen(true); setAiTopMenuTab("chat"); }}>AI Assistant</button>
              <button onClick={() => { resetBlockColorsToTheme(); setContextMenu(null); }}>Reset site header colors to theme</button>
              <button onClick={() => { if (window.confirm("Reset all blocks to current theme?")) applyThemeToAllBlocks(); setContextMenu(null); }}>Reset all blocks to theme</button>
              <button onClick={() => setContextMenu(null)}>Close</button>
            </>
          ) : (
            <>
              <button onClick={() => { openBlockDrawer(contextMenu.blockId); setContextMenu(null); }}>Edit Properties</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); setAiTopMenuOpen(true); setAiTopMenuTab("chat"); }}>AI Assistant</button>
              <button onClick={() => { openResizeLayoutForBlock(contextMenu.blockId); setContextMenu(null); }}>Resize/Layout</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); setRightTab("images"); setRightDrawerMobileOpen(true); setRightCollapsed(false); setImageManagerOpen(true); setImageManagerTarget("block-bg"); setContextMenu(null); setStatus("Image Library opened for block"); }}>Image Library</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); startNewRow(contextMenu.blockId); closeTransientOverlays(); }}>Start new row</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); placeWithPrevious(contextMenu.blockId); closeTransientOverlays(); }}>Place with block above</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); placeWithNext(contextMenu.blockId); closeTransientOverlays(); }}>Place with block below</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); removeFromRow(contextMenu.blockId); closeTransientOverlays(); }}>Remove from row / Leave row</button>
              <button onClick={() => { resetBlockColorsToTheme(contextMenu.blockId); setContextMenu(null); }}>Reset block colors to theme</button>
              <button onClick={() => { if (window.confirm("Reset all blocks to current theme?")) applyThemeToAllBlocks(); setContextMenu(null); }}>Reset all blocks to theme</button>
              <button onClick={() => { duplicateBlock(contextMenu.blockId); setContextMenu(null); }}>Duplicate</button>
              <button onClick={() => { deleteBlock(contextMenu.blockId); setContextMenu(null); }}>Delete</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); moveBlock("up", contextMenu.blockId); closeTransientOverlays(); }}>Move Up</button>
              <button onClick={() => { selectBlockQuiet(contextMenu.blockId); moveBlock("down", contextMenu.blockId); closeTransientOverlays(); }}>Move Down</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); setAiTopMenuOpen(true); setAiTopMenuTab("chat"); }}>AI Edit</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); setAiTopMenuOpen(true); setAiTopMenuTab("image-gen"); }}>Generate Image</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); setAiTopMenuOpen(true); setAiTopMenuTab("image-enhance"); }}>Edit Photo</button>
              <button onClick={() => {
                const block = selectedPage.blocks.find((b) => b.id === contextMenu.blockId);
                if (block) navigator.clipboard?.writeText(JSON.stringify(block, null, 2));
                setContextMenu(null);
              }}>Copy Block JSON</button>
              <button onClick={() => setContextMenu(null)}>Close</button>
            </>
          )}
        </div>
        </>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
              <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close Settings">✕</button>
            </div>
            <div className="tabs">
              <button className={settingsTab === "general" ? "selected" : ""} onClick={() => setSettingsTab("general")}>General</button>
              <button className={settingsTab === "providers" ? "selected" : ""} onClick={() => setSettingsTab("providers")}>AI Providers</button>
              {userRole === "admin" && (
                <button className={settingsTab === "keys" ? "selected" : ""} onClick={() => setSettingsTab("keys")}>Image/API Keys</button>
              )}
              <button className={settingsTab === "deploy" ? "selected" : ""} onClick={() => setSettingsTab("deploy")}>Deploy Safety</button>
              <button className={settingsTab === "account" ? "selected" : ""} onClick={() => { setSettingsTab("account"); setAcctMsg(""); setAcctMsgOk(false); }}>Account Management</button>
              {userRole === "admin" && (
                <button className={settingsTab === "users" ? "selected" : ""} onClick={() => { setSettingsTab("users"); setCreateMsg(""); setCreateMsgOk(false); setResetPwMsg(""); setResetPwMsgOk(false); void fetchUsers(); }}>User Management</button>
              )}
              <button className={settingsTab === "debug" ? "selected" : ""} onClick={() => setSettingsTab("debug")}>Debug</button>
              <button className={settingsTab === "about" ? "selected" : ""} onClick={() => setSettingsTab("about")}>About</button>
            </div>
            {settingsTab === "general" && (
              <div className="panel-status">
                <p>Use tabs to configure providers, keys, and deploy safety.</p>
                <p><strong>Builder UI Theme</strong> changes only the editor toolbar, panels, buttons, and modals.</p>
                <p><strong>Website Theme</strong> changes only the page preview, including your site header/nav and content blocks.</p>
                <p className="hint">The SBUILD topbar, left/right panels, and all editor buttons always use Builder UI Theme colors — Website Theme never affects them.</p>
                <div className="builder-theme-row" data-testid="builder-theme-row" style={{ marginTop: 12 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>Editor Theme
                    <select data-testid="builder-theme-select" value={editorTheme} onChange={(e) => setEditorTheme(e.target.value)} style={{ marginLeft: 8 }}>
                      <option value="Light">Light</option>
                      <option value="Dark">Dark</option>
                    </select>
                  </label>
                  <div className="button-row compact" style={{ marginTop: 4 }}>
                    <button data-testid="save-builder-theme" onClick={() => void saveBuilderTheme()}>{builderThemeSaveStatus === "saving" ? "Saving..." : "Save Theme"}</button>
                    {builderThemeSaveStatus === "saved" && <span className="panel-status" data-testid="builder-theme-save-status">Saved (Builder UI Theme will persist across refresh and service restart).</span>}
                    {builderThemeSaveStatus === "error" && <span className="panel-status" style={{ color: "#c0392b" }}>Save failed. Check that you are signed in.</span>}
                    {builderThemeSavedAt && builderThemeSaveStatus === "saved" && <span className="hint" style={{ marginLeft: 8 }}>updatedAt: {builderThemeSavedAt}</span>}
                  </div>
                </div>
                <hr style={{ margin: "16px 0" }} />
                <button className="logout-btn" onClick={() => { void (async () => { try { await fetch("/logout", { method: "POST" }); } catch { /* */ } window.location.href = "/login"; })(); }}>Logout</button>
              </div>
            )}
            {settingsTab === "providers" && <div>
              <p className="hint"><strong>A) Subscription providers through OpenCode</strong></p>
              <p className="hint">These providers are authenticated through OpenCode on this NUC. sBuild does not store your subscription login.</p>
              {providerStatus.map((p) => <div key={`settings-${p.name}`} className={`provider-card provider-${p.status}`}><strong>{p.name}</strong><span className="provider-badge">{p.status}</span><p>{p.message}</p></div>)}
              <div className="button-row">
                <button onClick={() => { void loadProviders(); setStatus("Provider status checked"); setProviderCheckMessage("Provider status checked via /api/ai/providers/status"); }}>Check Provider Status</button>
                <button onClick={() => void checkOpenCodeAuth()}>Check OpenCode auth</button>
              </div>
              {opencodeAuth && (
                <div className="panel-status">
                  OpenCode auth: {opencodeAuth.status} · {opencodeAuth.message}
                  {opencodeAuth.commands.length > 0 && <div>Commands: {opencodeAuth.commands.join(" | ")}</div>}
                </div>
              )}
              <hr style={{ margin: "16px 0" }} />
              <p className="hint"><strong>B) AI Chat Provider Configuration</strong></p>
              <p className="hint">Configure how AI Chat connects. Settings are saved locally and never stored in project.json.</p>
              <p className="hint">Model benchmarking and replacing the local tiny model are later tasks. This screen is for honest routing and fallback only.</p>
              <label style={{ display: "block", marginBottom: 8 }}>
                Chat provider mode
                <select value={chatProviderMode} onChange={(e) => setChatProviderMode(e.target.value)} style={{ marginLeft: 8 }}>
                  <option value="auto">Auto</option>
                  <option value="local">Local Ollama</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Local model
                <select value={chatLocalModel} onChange={(e) => setChatLocalModel(e.target.value)} style={{ marginLeft: 8 }}>
                  <option value="">Auto (prefer qwen2.5:1.5b)</option>
                  {localModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </label>
              {localModels.length === 0 && (
                <p className="hint" style={{ color: "#c0392b" }}>No Ollama models detected. Local mode is available only if Ollama is reachable and a model is installed.</p>
              )}
              <label style={{ display: "block", marginBottom: 8 }}>
                OpenAI model
                <input type="text" value={chatOpenAIModel} onChange={(e) => setChatOpenAIModel(e.target.value)} placeholder="gpt-4o-mini" style={{ marginLeft: 8, flex: 1 }} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                OpenRouter model
                <input type="text" value={chatOpenRouterModel} onChange={(e) => setChatOpenRouterModel(e.target.value)} placeholder="openai/gpt-4o-mini" style={{ marginLeft: 8, flex: 1 }} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                <input type="checkbox" checked={chatFallbackEnabled} onChange={(e) => setChatFallbackEnabled(e.target.checked)} style={{ marginRight: 8 }} />
                Local-to-API fallback enabled
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Fallback timeout (seconds)
                <input type="number" min={3} max={60} value={chatFallbackTimeoutSec} onChange={(e) => setChatFallbackTimeoutSec(Number(e.target.value || 12))} style={{ marginLeft: 8, width: 96 }} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                OpenAI key {chatOpenAIKeyInput ? "(entered)" : "(leave blank to keep saved)"}
                <input type="password" value={chatOpenAIKeyInput} onChange={(e) => setChatOpenAIKeyInput(e.target.value)} placeholder={chatOpenAIKeyInput ? "••••••••" : "sk-..."} style={{ marginLeft: 8, flex: 1 }} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                OpenRouter key {chatOpenRouterKeyInput ? "(entered)" : "(leave blank to keep saved)"}
                <input type="password" value={chatOpenRouterKeyInput} onChange={(e) => setChatOpenRouterKeyInput(e.target.value)} placeholder={chatOpenRouterKeyInput ? "••••••••" : "sk-or-..."} style={{ marginLeft: 8, flex: 1 }} />
              </label>
              <div className="button-row">
                <button onClick={() => void saveProviderConfig()}>{providerConfigSaved ? "Saved!" : "Save Chat Provider Settings"}</button>
                <button onClick={() => {
                  setChatProviderMode("auto");
                  setChatLocalModel("qwen2.5:1.5b");
                  setChatOpenAIModel("gpt-4o-mini");
                  setChatOpenRouterModel("openai/gpt-4o-mini");
                  setChatFallbackEnabled(true);
                  setChatFallbackTimeoutSec(12);
                  setChatOpenAIKeyInput("");
                  setChatOpenRouterKeyInput("");
                  setProviderCheckMessage("Chat provider settings reset locally. Click Save Chat Provider Settings to persist.");
                }}>Clear/Reset Chat Provider Settings</button>
                <button onClick={() => void discoverLocalModels()}>Refresh Local Models</button>
              </div>
              <div className="button-row">
                <button onClick={() => void testProvider("local")}>Test Local Chat</button>
                <button onClick={() => void testProvider("openai")}>Test OpenAI Chat</button>
                <button onClick={() => void testProvider("openrouter")}>Test OpenRouter Chat</button>
              </div>
              {providerStatus.filter((p) => p.name === "Local Ollama" || p.name === "OpenAI" || p.name === "OpenRouter").map((p) => (
                <div key={`chat-${p.name}`} className={`provider-card provider-${p.status}`}>
                  <strong>{p.name}</strong>
                  <span className="provider-badge">{p.status}</span>
                  <p>{p.message}</p>
                </div>
              ))}
              {chatProviderStatus && <p className="panel-status">{chatProviderStatus.message}</p>}
              <hr style={{ margin: "16px 0" }} />
              <p className="hint"><strong>C) API-key providers</strong> use local secret fields in Image/API Keys.</p>
              <p className="hint"><strong>D) Image/API keys</strong> are masked and never stored in project.json.</p>
              {providerCheckMessage && <p className="panel-status">{providerCheckMessage}</p>}
            </div>}
            {settingsTab === "keys" && userRole === "admin" && <div>
              <p className="hint">Keys are saved in local ignored secret config, never project.json. They persist across hard refresh and service restarts.</p>
              <label>Image Generation API Key<input type="password" value={secretInputs.imageGenApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageGenApiKey: e.target.value }))} placeholder={secretStatus.imageGen.maskedKey || "sk-..."} /></label>
              <label>Image Analyze API Key<input type="password" value={secretInputs.imageAnalyzeApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageAnalyzeApiKey: e.target.value }))} placeholder={secretStatus.imageAnalyze.maskedKey || "sk-..."} /></label>
              <label>OpenAI Chat API Key<input type="password" value={secretInputs.openaiChatApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, openaiChatApiKey: e.target.value }))} placeholder={secretStatus.chatOpenAI.maskedKey || "sk-..."} /></label>
              <label>OpenRouter Chat API Key<input type="password" value={secretInputs.openrouterChatApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, openrouterChatApiKey: e.target.value }))} placeholder={secretStatus.chatOpenRouter.maskedKey || "sk-or-..."} /></label>
              <div className="button-row"><button onClick={() => void saveSecrets()}>Save Keys</button><button onClick={() => void testProvider("image-gen")}>Test Keys</button></div>
              <p className="panel-status">OpenAI chat source: {secretStatus.chatOpenAI.source} · {secretStatus.chatOpenAI.statusText} · Key: {secretStatus.chatOpenAI.maskedKey || "not saved"}</p>
              <p className="panel-status">OpenRouter chat source: {secretStatus.chatOpenRouter.source} · {secretStatus.chatOpenRouter.statusText} · Key: {secretStatus.chatOpenRouter.maskedKey || "not saved"}</p>
              <p className="panel-status">Image gen source: {secretStatus.imageGen.source} · {secretStatus.imageGen.statusText} · Key: {secretStatus.imageGen.maskedKey || "not saved"}</p>
              <p className="panel-status">Image analyze source: {secretStatus.imageAnalyze.source} · {secretStatus.imageAnalyze.statusText} · Key: {secretStatus.imageAnalyze.maskedKey || "not saved"}</p>
              {secretStatusMsg && <p className="panel-status">{secretStatusMsg}</p>}
            </div>}
            {settingsTab === "deploy" && <div>
              <p className="panel-status"><strong>Live publish disabled</strong></p>
              <p>SBUILD_ALLOW_PUBLISH: {"false"}</p>
              <p>Publish target: dry-run preview</p>
            </div>}
            {settingsTab === "account" && <div>
              <p><strong>Account Management</strong></p>
              {userName && <p>Logged in as: <strong>{userName}</strong> ({userRole})</p>}
              <hr />
              <p><strong>Change Password</strong></p>
              <label>Current Password
                <input type="password" value={acctCurrentPw} onChange={(e) => setAcctCurrentPw(e.target.value)} autoComplete="current-password" />
              </label>
              <label>New Password
                <input type="password" value={acctNewPw} onChange={(e) => setAcctNewPw(e.target.value)} autoComplete="new-password" />
              </label>
              <label>Confirm New Password
                <input type="password" value={acctConfirmPw} onChange={(e) => setAcctConfirmPw(e.target.value)} autoComplete="new-password" />
              </label>
              <div className="button-row">
                <button onClick={async () => {
                  setAcctMsg(""); setAcctMsgOk(false);
                  if (!acctCurrentPw || !acctNewPw || !acctConfirmPw) { setAcctMsg("All fields are required"); return; }
                  if (acctNewPw !== acctConfirmPw) { setAcctMsg("New password and confirmation do not match"); return; }
                  try {
                    const data = await fetchJson<{ ok: boolean; message?: string; error?: string }>("/api/account/change-password", {
                      method: "POST", body: JSON.stringify({ currentPassword: acctCurrentPw, newPassword: acctNewPw, confirmPassword: acctConfirmPw })
                    });
                    if (data.ok) {
                      setAcctMsg(data.message || "Password changed");
                      setAcctMsgOk(true);
                      setAcctCurrentPw(""); setAcctNewPw(""); setAcctConfirmPw("");
                    } else {
                      setAcctMsg(data.error || "Failed to change password");
                    }
                  } catch (err) {
                    setAcctMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}>Change Password</button>
              </div>
              {acctMsg && <p className={acctMsgOk ? "panel-status" : "error-text"}>{acctMsg}</p>}
            </div>}
            {settingsTab === "users" && userRole === "admin" && <div>
              <p><strong>User Management</strong></p>
              <hr />
              <p><strong>Create User</strong></p>
              <label>Username
                <input type="text" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} autoComplete="off" />
              </label>
              <label>Password
                <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} autoComplete="new-password" />
              </label>
              <div className="button-row">
                <button onClick={async () => {
                  setCreateMsg(""); setCreateMsgOk(false);
                  if (!createUsername || !createPassword) { setCreateMsg("Username and password are required"); return; }
                  if (createPassword.length < 4) { setCreateMsg("Password must be at least 4 characters"); return; }
                  try {
                    const data = await fetchJson<{ ok: boolean; user?: { username: string; role: string }; error?: string }>("/api/admin/users", {
                      method: "POST", body: JSON.stringify({ username: createUsername, password: createPassword })
                    });
                    if (data.ok) {
                      setCreateMsg(`User "${data.user?.username}" created`);
                      setCreateMsgOk(true);
                      setCreateUsername(""); setCreatePassword("");
                      void fetchUsers();
                    } else {
                      setCreateMsg(data.error || "Failed to create user");
                    }
                  } catch (err) {
                    setCreateMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}>Create User</button>
              </div>
              {createMsg && <p className={createMsgOk ? "panel-status" : "error-text"}>{createMsg}</p>}
              <hr />
              <p><strong>Users</strong></p>
              {userList.length === 0 && <p>No users found.</p>}
              {userList.map((u) => (
                <div key={u.id} className="provider-card" style={{ marginBottom: 8 }}>
                  <div><strong>{u.username}</strong> ({u.role}) {u.disabled ? <span className="error-text">Disabled</span> : ""}</div>
                  <div className="button-row compact" style={{ marginTop: 4 }}>
                    <button onClick={async () => {
                      const pw = window.prompt("New password for " + u.username + ":");
                      if (!pw) return;
                      try {
                        const data = await fetchJson<{ ok: boolean; message?: string; error?: string }>(`/api/admin/users/${u.id}/reset-password`, {
                          method: "POST", body: JSON.stringify({ newPassword: pw })
                        });
                        setResetPwMsg(data.ok ? (data.message || "Password reset") : (data.error || "Failed"));
                        setResetPwMsgOk(data.ok);
                      } catch (err) {
                        setResetPwMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
                        setResetPwMsgOk(false);
                      }
                    }}>Reset Password</button>
                    {u.role !== "admin" && !u.disabled && (
                      <button onClick={async () => {
                        if (!window.confirm(`Disable user "${u.username}"?`)) return;
                        try {
                          const data = await fetchJson<{ ok: boolean; message?: string; error?: string }>(`/api/admin/users/${u.id}`, {
                            method: "DELETE"
                          });
                          if (data.ok) void fetchUsers();
                          else setCreateMsg(data.error || "Failed to disable user");
                        } catch (err) {
                          setCreateMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }}>Disable</button>
                    )}
                  </div>
                </div>
              ))}
              {resetPwMsg && <p className={resetPwMsgOk ? "panel-status" : "error-text"}>{resetPwMsg}</p>}
            </div>}
            {settingsTab === "debug" && <div>
              <p><strong>Version:</strong> {SBUILD_APP_NAME} {displayVersion}</p>
              <p><strong>Served build commit:</strong> {buildIdentity.serverCommit}</p>
              <p><strong>Repo HEAD:</strong> {buildInfo?.repoHeadCommit || "unknown"}</p>
              <p><strong>Health:</strong> {buildInfoStatus === "ok" ? "OK" : buildInfoStatus === "unavailable" ? "health unavailable - version unverified" : "checking"}</p>
              <p><strong>Selected block:</strong> {selectedBlock?.id || "none"} ({selectedBlock?.type || "none"})</p>
              <p><strong>Theme:</strong> {themeApplied || "custom"}</p>
              <p><strong>Last API status:</strong> {status}</p>
            </div>}
            {settingsTab === "about" && <div>
              <h4 style={{ marginBottom: 8 }}>Build Status</h4>
              <p><strong>{SBUILD_APP_NAME}</strong> <span style={{ opacity: 0.7 }}>{displayVersion}</span></p>
              <table className="about-table"><tbody>
                <tr><td>Base version</td><td>{SBUILD_VERSION}</td></tr>
                <tr><td>Display version</td><td>{displayVersion}</td></tr>
                <tr><td>Service health</td><td>{buildInfoStatus === "ok" ? "OK" : buildInfoStatus === "unavailable" ? "Health unavailable - version unverified" : "Checking"}</td></tr>
                <tr><td>Served build commit</td><td>{buildIdentity.serverCommit}</td></tr>
                <tr><td>Commit count</td><td>{buildInfo?.commitCount ?? "unknown"}</td></tr>
                <tr><td>Build branch</td><td>{buildInfo?.branch || "unknown"}</td></tr>
                <tr><td>Build date/time</td><td>{buildInfo?.buildDate ? new Date(buildInfo.buildDate).toLocaleString() : "unknown"}</td></tr>
                <tr><td>Repo HEAD diagnostic</td><td>{buildInfo?.repoHeadCommit || "unknown"}</td></tr>
                <tr><td>Repo branch diagnostic</td><td>{buildInfo?.repoBranch || "unknown"}</td></tr>
                <tr><td>Publish allowed</td><td>{buildInfoStatus === "ok" ? (buildInfo?.publishAllowed ? "Yes" : "No (dry-run)") : "unknown (health unavailable)"}</td></tr>
                <tr><td>Loaded project source</td><td>{loadedProjectSource}</td></tr>
                {projectPath && <tr><td>Project path</td><td>{projectPath}</td></tr>}
                <tr><td>App dirty (unsaved edits)</td><td>{dirty ? "Yes — has unsaved changes" : "No — all saved"}</td></tr>
                <tr><td>Build artifact dirty</td><td>{buildInfoStatus === "ok" ? (buildInfo?.dirty ? "Yes (build included local source changes)" : "No") : "unknown (health unavailable)"}</td></tr>
                <tr><td>Repo working tree diagnostic</td><td>{buildInfoStatus === "ok" ? (buildInfo?.repoDirty ? "Modified (has local changes)" : "Clean (matches last commit)") : "unknown (health unavailable)"}</td></tr>
                {buildInfo?.repoDirtySummary && (
                  <tr><td>Repo dirty summary</td><td>{buildInfo.repoDirtySummary.modifiedTracked} tracked modified, {buildInfo.repoDirtySummary.untracked} untracked</td></tr>
                )}
              </tbody></table>
              <div style={{ marginTop: 10, marginBottom: 10 }}>
                <p className={`hint build-identity-status build-identity-${buildIdentity.status}`}>
                  {buildIdentity.message}
                </p>
                {buildIdentity.detail && <p className="hint">{buildIdentity.detail}</p>}
                {buildInfoError && <p className="hint">Health error: {buildInfoError}</p>}
              </div>
              <hr />
              <h4 style={{ marginBottom: 8 }}>Diagnostics</h4>
              <div className="button-row compact">
                <button onClick={() => {
                  const diag = {
                    app: SBUILD_APP_NAME,
                    displayVersion,
                    baseVersion: SBUILD_VERSION,
                    servedBuildCommit: buildIdentity.serverCommit,
                    browserBuildCommit: buildIdentity.browserCommit,
                    buildBranch: buildInfo?.branch || "unknown",
                    commitCount: buildInfo?.commitCount ?? "unknown",
                    buildDate: buildInfo?.buildDate || "unknown",
                    repoHeadCommit: buildInfo?.repoHeadCommit || "unknown",
                    repoBranch: buildInfo?.repoBranch || "unknown",
                    publishAllowed: buildInfo?.publishAllowed ?? false,
                    serviceHealth: buildInfoStatus === "ok" ? "ok" : buildInfoStatus === "unavailable" ? "health unavailable" : "checking",
                    healthError: buildInfoError || null,
                    browserServerMatch: buildIdentity.status === "match",
                    browserServerMatchStatus: buildIdentity.status,
                    browserServerMatchNote: buildIdentity.detail || buildIdentity.message,
                    dirty: dirty ? "App has unsaved project edits" : "All app edits saved",
                    buildArtifactDirty: buildInfo?.dirty ? "Build included local source changes" : "Build artifact was clean",
                    repoDirty: buildInfo?.repoDirty ? "Source files differ from last commit" : "Clean working tree",
                    repoDirtySummary: buildInfo?.repoDirtySummary || null,
                    blocks: project?.pages.reduce((sum, p) => sum + p.blocks.length, 0) || 0,
                    pages: project?.pages.length || 0,
                    theme: themeApplied || "custom",
                  };
                  navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).then(() => setStatus("Diagnostics copied to clipboard")).catch(() => setStatus("Copy failed"));
                }}>Copy diagnostics</button>
              </div>
              <hr />
              <p><strong>Changelog</strong></p>
              <p>Latest: {SBUILD_VERSION}</p>
              <p style={{ fontSize: 12, opacity: 0.7 }}>See CHANGELOG.md in project root for full history.</p>
              <p className="hint" style={{ marginTop: 8 }}>Build identity updates automatically on every build/prebuild. Base version bumps: <code>bash scripts/version-sbuild.sh bump [patch|minor|major]</code></p>
            </div>}
            <div className="button-row"><button onClick={() => setSettingsOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {websiteManagerOpen && (
        <div className="modal-backdrop" onClick={() => setWebsiteManagerOpen(false)}>
          <div className="modal website-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Website Manager</h3>
              <button className="modal-close" onClick={() => setWebsiteManagerOpen(false)} aria-label="Close Website Manager">✕</button>
            </div>
            {websiteManagerError && <p className="hint error-text">{websiteManagerError}</p>}
            <div className="website-manager-pages">
              {project.pages.map((page) => (
                <div key={page.id} className={`wm-page-row ${page.id === selectedPage.id ? "selected" : ""}`}>
                  <div className="wm-page-info">
                    <strong>{page.title}</strong>
                    <span className="page-slug-hint">{page.slug}</span>
                    {page.parentId && <span className="page-parent-hint">Parent: {project.pages.find((p) => p.id === page.parentId)?.title || "unknown"}</span>}
                    <span className="page-nav-hint">{page.showInNav !== false ? "In nav" : "Hidden from nav"}</span>
                  </div>
                  <div className="wm-page-actions">
                    <button onClick={() => { setSelectedPageId(page.id); setWebsiteManagerOpen(false); }}>Open</button>
                    <button onClick={() => { const n = window.prompt("New page name:", page.title); if (n) handleRenamePage(page.id, n); }}>Rename</button>
                    <button onClick={() => { const s = window.prompt("New slug:", page.slug); if (s) handleUpdatePageSlug(page.id, s); }}>Slug</button>
                    <button onClick={() => handleToggleShowInNav(page.id)}>{page.showInNav !== false ? "Hide from nav" : "Show in nav"}</button>
                    <button onClick={() => { const pid = window.prompt("Parent page ID (leave empty for none):", page.parentId || ""); handleSetParentPage(page.id, pid || ""); }}>Parent</button>
                    <button onClick={() => handleDuplicatePage(page.id)}>Duplicate</button>
                    <button onClick={() => handleDeletePage(page.id)} disabled={project.pages.length <= 1}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="button-row">
              <button onClick={() => { resetNewPageFlow(); setNewPageFlowOpen(true); }}>+ New Page</button>
              <button onClick={() => setWebsiteManagerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {newPageFlowOpen && (
        <div className="modal-backdrop" onClick={() => setNewPageFlowOpen(false)}>
          <div className="modal new-page-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Page</h3>
              <button className="modal-close" onClick={() => setNewPageFlowOpen(false)} aria-label="Close">✕</button>
            </div>
            {websiteManagerError && <p className="hint error-text">{websiteManagerError}</p>}
            {newPageStep === 0 && (
              <div className="new-page-step">
                <h4>Step 1: Page Name</h4>
                <label>Page title
                  <input value={newPageName} onChange={(e) => { setNewPageName(e.target.value); setNewPageSlug(generateSlug(e.target.value)); }} placeholder="My New Page" />
                </label>
                <div className="button-row">
                  <button onClick={() => { if (!newPageName.trim()) { setWebsiteManagerError("Page name is required."); return; } setWebsiteManagerError(""); setNewPageStep(1); }}>Next</button>
                  <button onClick={() => setNewPageFlowOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
            {newPageStep === 1 && (
              <div className="new-page-step">
                <h4>Step 2: URL Slug</h4>
                <p className="hint">Auto-generated from title. Edit if needed. Must be unique. Starts with /.</p>
                <label>Slug
                  <input value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} placeholder="/my-new-page" />
                </label>
                <div className="button-row">
                  <button onClick={() => setNewPageStep(0)}>Back</button>
                  <button onClick={() => setNewPageStep(2)}>Next</button>
                </div>
              </div>
            )}
            {newPageStep === 2 && (
              <div className="new-page-step">
                <h4>Step 3: Parent / Location</h4>
                <p className="hint">Choose a parent page for organization. Stored as metadata; flat nav for now.</p>
                <label>Parent page
                  <select value={newPageParentId} onChange={(e) => setNewPageParentId(e.target.value)}>
                    <option value="">None (top level)</option>
                    {project.pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </label>
                <div className="button-row">
                  <button onClick={() => setNewPageStep(1)}>Back</button>
                  <button onClick={() => setNewPageStep(3)}>Next</button>
                </div>
              </div>
            )}
            {newPageStep === 3 && (
              <div className="new-page-step">
                <h4>Step 4: Navigation</h4>
                <label>
                  <input type="checkbox" checked={newPageShowInNav} onChange={(e) => setNewPageShowInNav(e.target.checked)} />
                  Show in site navigation
                </label>
                <p className="hint">{newPageShowInNav ? "This page will appear in your site's navigation bar." : "This page will be hidden from the navigation bar."}</p>
                <div className="button-row">
                  <button onClick={() => setNewPageStep(2)}>Back</button>
                  <button onClick={() => setNewPageStep(4)}>Next</button>
                </div>
              </div>
            )}
            {newPageStep === 4 && (
              <div className="new-page-step">
                <h4>Step 5: Starter Layout</h4>
                <div className="template-grid">
                  {STARTER_TEMPLATES.map((t) => (
                    <button key={t.id} className={`template-option ${newPageTemplate === t.id ? "selected" : ""}`} onClick={() => setNewPageTemplate(t.id)} disabled={t.id === "copy" && !selectedPage}>
                      <strong>{t.label}</strong>
                      <span className="hint">{t.description}</span>
                    </button>
                  ))}
                </div>
                <div className="button-row">
                  <button onClick={() => setNewPageStep(3)}>Back</button>
                  <button onClick={handleCreatePage}>Create Page</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {helpOpen && (
        <HelpGuide onClose={() => setHelpOpen(false)} />
      )}

      {showWizard && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Website Wizard</h3>
            <label>Name <input value={wizardForm.name} onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })} /></label>
            <label>Business Type <input value={wizardForm.businessType} onChange={(e) => setWizardForm({ ...wizardForm, businessType: e.target.value })} /></label>
            <label>Description <textarea value={wizardForm.description} onChange={(e) => setWizardForm({ ...wizardForm, description: e.target.value })} /></label>
            <label>Theme <input value={wizardForm.theme} onChange={(e) => setWizardForm({ ...wizardForm, theme: e.target.value })} /></label>
            <div className="button-row">
              <button onClick={() => void runWizard()}>Apply</button>
              <button onClick={() => setShowWizard(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Library Modal */}
      {imageManagerOpen && (
        <div className="modal-backdrop" onClick={() => setImageManagerOpen(false)}>
          <div className="modal image-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Image Library</h3>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#888" }}>Image Library stores uploaded and generated project assets. Website Gallery controls images displayed inside gallery blocks on the website.</p>
              <button className="modal-close" onClick={() => setImageManagerOpen(false)} aria-label="Close Image Library">✕</button>
            </div>
            <div className="image-library-tabs" data-testid="modal-image-library-tabs" style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              <button data-testid="modal-image-library-tab-browse" className={imageLibraryTab === "browse" ? "selected" : ""} onClick={() => setImageLibraryTab("browse")}>Browse</button>
              <button data-testid="modal-image-library-tab-upload" className={imageLibraryTab === "upload" ? "selected" : ""} onClick={() => setImageLibraryTab("upload")}>Upload</button>
              <button
                data-testid="modal-image-library-tab-settings"
                className={imageLibraryTab === "settings" ? "selected" : ""}
                onClick={() => { setImageLibraryTab("settings"); void refreshFolderList(); }}
              >Settings</button>
            </div>

            {imageLibraryTab === "upload" && (
              <div className="image-manager-upload" data-testid="modal-image-library-upload-section">
                <h4>Upload Images</h4>
                <label>Upload image
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImages(e.target.files)} />
                </label>
                {uploadingImage && <span className="hint">Uploading...</span>}
                {photoEditStatus && <p className="panel-status">{photoEditStatus}</p>}
                <p className="hint">Tip: uploads are saved to the project image folder (see Settings tab). You can also upload generated images from the AI Image Generator tab.</p>
              </div>
            )}

            {imageLibraryTab === "settings" && (
              <div className="image-manager-folder" data-testid="modal-image-library-settings-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0 }}>Project Photo Folder</h4>
                  <button
                    data-testid="modal-image-library-folder-refresh"
                    onClick={() => void refreshFolderList()}
                    style={{ padding: "4px 8px" }}
                  >Refresh / Rescan</button>
                </div>
                <p className="hint" style={{ marginTop: 6 }}>
                  Manage your project image folders without terminal access. All operations stay inside <code>project/images</code>.
                </p>
                <div className="image-folder-current" data-testid="modal-image-library-folder-current" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <strong>Active folder:</strong>
                  <code data-testid="modal-image-library-folder-active">{photoFolder}</code>
                  <button onClick={() => void savePhotoFolder()} data-testid="modal-image-library-folder-save-active">Save as active</button>
                  <button onClick={() => setPhotoFolder("project/images")} data-testid="modal-image-library-folder-reset">Reset to project/images</button>
                </div>
                <p className="hint" style={{ color: "var(--editor-text-muted)", fontSize: "11px" }}>
                  Open folder is unavailable in this browser build. Use folder path + Refresh.
                </p>
                <details className="image-folder-section" data-testid="modal-image-library-folder-list-details" open>
                  <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>Folders</summary>
                  <div className="image-folder-list" data-testid="modal-image-library-folder-list-section" style={{ marginBottom: 10 }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto", border: "1px solid var(--editor-border)", borderRadius: 6 }}>
                      {folderList.map((folder) => {
                        const isActive = folder === photoFolder;
                        const isRoot = folder === "project/images";
                        return (
                          <li key={folder} data-testid="modal-image-library-folder-item" data-folder={folder} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid var(--editor-border)", background: isActive ? "var(--editor-status-bg)" : "transparent" }}>
                            <code style={{ flex: 1, fontSize: 12 }}>{folder}</code>
                            {!isActive && (<button data-testid="modal-image-library-folder-switch" onClick={() => setPhotoFolder(folder)} style={{ fontSize: 11, padding: "2px 6px" }}>Set active</button>)}
                            {!isRoot && (<button data-testid="modal-image-library-folder-delete" onClick={() => void deleteImageFolder(folder)} style={{ fontSize: 11, padding: "2px 6px" }} title="Delete folder (must be empty)">Delete</button>)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </details>
                {folderManagerStatus && (
                  <p data-testid="modal-image-library-folder-status" className="panel-status" style={{ color: folderManagerStatusOk ? "var(--editor-accent)" : "var(--editor-warning, #c0392b)" }}>{folderManagerStatus}</p>
                )}
              </div>
            )}

            {imageLibraryTab === "browse" && (
              <>
                <div className="image-manager-gallery" data-testid="modal-image-library-library-section">
                  <div className="image-library-header">
                    <h4>Project Images ({filteredUploadedImages.length}/{uploadedImages.length})</h4>
                    <div className="image-library-header-actions">
                      <button data-testid="modal-image-library-refresh" onClick={() => void loadImages()} title="Reload the image list from disk">Refresh</button>
                      <button
                        data-testid="modal-image-library-open-folder"
                        onClick={() => {
                          setImageLibraryTab("settings");
                          void refreshFolderList();
                        }}
                        title="Open the in-app folder manager (browser-safe; no native OS picker is launched)"
                      >Open folder</button>
                    </div>
                  </div>
                  <div className="image-library-controls">
                    <label>Filter
                      <select data-testid="modal-image-library-filter" value={imageLibraryFilter} onChange={(e) => setImageLibraryFilter(e.target.value as ImageLibraryFilter)}>
                        <option value="all">Show all</option>
                        <option value="hide-blank">Hide likely blank/white</option>
                        <option value="hide-tall">Hide tall/screenshot-like</option>
                        <option value="generated">Generated only</option>
                        <option value="uploaded">Uploaded only</option>
                        <option value="used">Used on page only</option>
                      </select>
                    </label>
                    <label>Tile fit
                      <select value={imageTileFit} onChange={(e) => setImageTileFit(e.target.value as ImageTileFit)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                      </select>
                    </label>
                  </div>
                  <div className="image-library-bulk" data-testid="modal-image-library-bulk-bar">
                    <div className="image-library-bulk-row" data-testid="modal-image-library-bulk-row-top">
                      <span className="image-library-selected-count" data-testid="modal-image-library-selected-count" aria-live="polite">
                        {selectMode ? `Selected: ${selectedImageUrls.size}` : "Selection off"}
                      </span>
                      <button data-testid="modal-image-library-select-all" onClick={() => selectAllFilteredImages()} disabled={!selectMode}>Select all visible</button>
                      <button data-testid="modal-image-library-clear-selection" onClick={() => clearImageSelection()} disabled={!selectMode || selectedImageUrls.size === 0}>Clear selection</button>
                      <button
                        data-testid="modal-image-library-select-mode-toggle"
                        className={selectMode ? "selected" : ""}
                        aria-pressed={selectMode}
                        onClick={() => {
                          setSelectMode((prev) => !prev);
                          if (selectMode) clearImageSelection();
                        }}
                        title={selectMode ? "Turn selection off" : "Turn selection on"}
                      >{selectMode ? "Selection: on" : "Selection: off"}</button>
                      <button
                        data-testid="modal-image-library-delete-selected"
                        disabled={!selectMode || selectedImageUrls.size === 0 || bulkDeletePending}
                        onClick={() => {
                          if (selectedImageUrls.size === 0) return;
                          setBulkDeletePending(true);
                          setBulkDeleteMessage("");
                        }}
                        className="image-library-delete-button"
                      >
                        {bulkDeletePending ? "Confirm delete" : `Delete selected (${selectedImageUrls.size})`}
                      </button>
                    </div>
                  </div>
                  {bulkDeletePending && (
                    <div className="image-library-confirm" data-testid="modal-image-library-delete-confirm" style={{ background: "var(--editor-panel-bg-2)", border: "1px solid var(--editor-warning, #c0392b)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      {(() => {
                        const selectedMetas = uploadedImages.filter((img) => selectedImageUrls.has(img.url));
                        const inUse = selectedMetas.filter((m) => usedImageUrls.has(m.url));
                        const gitkeepSlipped = selectedMetas.some((m) => m.name === ".gitkeep" || m.name.startsWith("."));
                        return (
                          <>
                            <p style={{ marginTop: 0 }}><strong>Delete {selectedImageUrls.size} image{selectedImageUrls.size === 1 ? "" : "s"}?</strong> This cannot be undone.</p>
                            {inUse.length > 0 && (
                              <p className="image-library-confirm-warn" data-testid="modal-image-library-delete-inuse-warning" style={{ color: "var(--editor-warning, #c0392b)", margin: "4px 0 8px 0" }}>
                                {inUse.length} of the selected image{inUse.length === 1 ? " is" : "s are"} currently used by the project. They will be blocked from deletion. Replace their usage first.
                              </p>
                            )}
                            {gitkeepSlipped && (
                              <p style={{ color: "var(--editor-warning, #c0392b)", margin: "4px 0 8px 0" }}>
                                Note: hidden / system files (.gitkeep) will be skipped automatically.
                              </p>
                            )}
                            <div className="button-row compact">
                              <button
                                data-testid="modal-image-library-delete-confirm-yes"
                                onClick={async () => {
                                  const paths = Array.from(selectedImageUrls)
                                    .map((url) => url.replace(/^\/+/, ""))
                                    .filter((url) => {
                                      if (!url) return false;
                                      if (url.startsWith("project/images/")) return true;
                                      return false;
                                    });
                                  const result = await bulkDeleteImages(paths);
                                  const blocked = result.results.filter((r) => !r.deleted && r.skipped).length;
                                  const errCount = result.results.filter((r) => !r.deleted && r.error && !r.skipped).length;
                                  let msg = `Deleted ${result.deletedCount} image(s).`;
                                  if (blocked > 0) msg += ` ${blocked} blocked (in use).`;
                                  if (errCount > 0) msg += ` ${errCount} error(s).`;
                                  setBulkDeletePending(false);
                                  setBulkDeleteMessage(msg);
                                  clearImageSelection();
                                  await loadImages();
                                }}
                                style={{ background: "var(--editor-warning, #c0392b)", color: "#fff", borderColor: "var(--editor-warning, #c0392b)" }}
                              >Yes, delete</button>
                              <button onClick={() => { setBulkDeletePending(false); setBulkDeleteMessage(""); }}>Cancel</button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {bulkDeleteMessage && <p className="panel-status" data-testid="modal-image-library-delete-message">{bulkDeleteMessage}</p>}
                  {filteredUploadedImages.length === 0 && <p className="hint">No images match this filter yet. Try Show all or upload/generate images.</p>}
                  <div className="image-grid" data-testid="modal-image-library-grid" data-select-mode={selectMode ? "on" : "off"}>
                    {filteredUploadedImages.map((img) => {
                      const isSelected = selectedImageUrls.has(img.url);
                      const isPrimary = selectedUploadImage === img.url;
                      const diag = imageDiagnostics[img.url];
                      return (
                        <div
                          key={img.url}
                          className={`image-card ${isPrimary ? "selected" : ""} ${isSelected ? "multi-selected" : ""} ${selectMode ? "select-mode" : ""}`}
                          onClick={() => { if (!selectMode) setSelectedUploadImage(img.url); else toggleImageSelected(img.url); }}
                          onContextMenu={(e) => { e.preventDefault(); toggleImageSelected(img.url); }}
                          data-testid="modal-image-library-card"
                          data-image-url={img.url}
                          data-selected={isSelected ? "true" : "false"}
                          role="button"
                          aria-pressed={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleImageSelected(img.url); } }}
                        >
                          <label
                            className={`image-card-checkbox ${selectMode ? "image-card-checkbox-prominent" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleImageSelected(img.url)}
                              aria-label={`Select ${img.name}`}
                              data-testid="modal-image-library-card-checkbox"
                            />
                          </label>
                          <img
                            src={img.url}
                            alt={img.name}
                            loading="lazy"
                            style={{ objectFit: imageTileFit }}
                            onLoad={(e) => captureImageDiagnostics(img.url, img.name, e.currentTarget)}
                            onError={(e) => {
                              setBrokenImages((prev) => new Set(prev).add(img.url));
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          {brokenImages.has(img.url) && (
                            <div className="image-fallback">
                              <div className="image-fallback-icon">🖼️</div>
                              <div className="image-fallback-name">{img.name}</div>
                            </div>
                          )}
                          <div className="image-meta">{img.name}{img.isEdited ? " (edited)" : ""}{diag?.likelyWhite ? " (blank)" : ""}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedUploadImage && !selectMode && (
                  <div className="image-library-selected-panel" data-testid="modal-image-library-selected-panel" style={{ marginTop: 12 }}>
                    {renderImageManagerActions(true)}
                  </div>
                )}
                {selectedUploadImage && !selectMode && (
                  <div style={{ marginTop: 8 }}>
                    <div className="button-row compact">
                      <button onClick={() => openImageActionPanel()}>Open actions for selected image</button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="image-manager-footer" style={{ marginTop: 12 }}>
              <button onClick={() => setImageManagerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
