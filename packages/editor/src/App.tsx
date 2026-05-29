import { useEffect, useMemo, useRef, useState } from "react";
import {
  Block,
  BlockType,
  DividerBlockData,
  DividerStyle,
  ImageSizeDecision,
  ImageTargetContext,
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
  SBuildSecretConfig,
  SBuildBuildInfo,
  SBUILD_VERSION,
  SBUILD_APP_NAME,
  clampMinHeight,
  clampWidthPercent,
  groupBlocksIntoRows,
  joinAdjacentBlocks,
  leaveRowForBlock,
  snapMinHeight,
  snapWidthPercent
} from "@sbuild/shared";

type DeviceMode = "desktop" | "tablet" | "phone";
type RightTab = "properties" | "style" | "images" | "ai" | "status";
type PropertiesTab = "fields" | "resize";
type SettingsTab = "general" | "providers" | "keys" | "deploy" | "debug" | "about";
type ChatItem = { role: "user" | "assistant"; text: string };
type PaintPoint = { x: number; y: number };
type PaintTool = "brush" | "eraser";
type PaintDrawMode = "free" | "line";
type PaintStroke = { id: string; tool: Exclude<PaintTool, "eraser">; mode: PaintDrawMode; color: string; size: number; points: PaintPoint[] };
type DragState = { blockId: string; startIndex: number; currentIndex: number } | null;
type ContextMenuState = { visible: boolean; x: number; y: number; blockId: string; isSiteHeader?: boolean } | null;
type ResizeDragState = { handle: "right" | "bottom"; blockId: string; startX: number; startY: number; startWidth: number; startMinHeight: number } | null;
type ImageMeta = { name: string; url: string; folder: string; size: number; modified: string; isEdited: boolean };
type RowRenderItem = { kind: "single"; block: Block } | { kind: "row"; rowId: string; blocks: Block[] };

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${url}`, { headers: { "Content-Type": "application/json" }, ...init });
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
    backgroundPosition: s.backgroundPosition || "center",
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

const HeroBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as HeroBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <h1 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("heading", e.currentTarget.textContent || "")} onBlur={(e) => onText("heading", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.heading}</h1>
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("subheading", e.currentTarget.textContent || "")} onBlur={(e) => onText("subheading", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.subheading}</p>
      <button className="cta-btn" style={partStyleToCss(parts?.button, "body")}>{data.ctaLabel || "Call to Action"}</button>
    </section>
  );
};

const TextBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as TextBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("title", e.currentTarget.textContent || "")} onBlur={(e) => onText("title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.title}</h2>
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("body", e.currentTarget.textContent || "")} onBlur={(e) => onText("body", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.body}</p>
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
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("caption", e.currentTarget.textContent || "")} onBlur={(e) => onText("caption", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.caption}</p>
    </section>
  );
};

const CardsBlock = ({ block, onText, onCardText, isPreview, onActivateTarget }: { block: Block; onText?: (field: string, value: string) => void; onCardText?: (cardIndex: number, field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as CardsBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText?.("title", e.currentTarget.textContent || "")} onBlur={(e) => onText?.("title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.title}</h2>
      <div className="cards-grid">
        {data.cards.map((card, i) => (
          <article key={card.id} style={partStyleToCss(parts?.card, "body")}>
            <h3 style={partStyleToCss(parts?.cardHeading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onCardText?.(i, "title", e.currentTarget.textContent || "")} onBlur={(e) => onCardText?.(i, "title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("cardHeading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{card.title}</h3>
            <p style={partStyleToCss(parts?.cardBody, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onCardText?.(i, "body", e.currentTarget.textContent || "")} onBlur={(e) => onCardText?.(i, "body", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("cardBody"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{card.body}</p>
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
      <h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("title", e.currentTarget.textContent || "")} onBlur={(e) => onText("title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.title}</h2>
      <ul>
        {data.rows.map((row, i) => (
          <li key={`${row.day}-${i}`} style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText(`rows.${i}.day`, e.currentTarget.textContent?.split(":")[0]?.trim() || "")} onBlur={(e) => onText(`rows.${i}.day`, e.currentTarget.textContent?.split(":")[0]?.trim() || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{row.day}: {row.open} - {row.close}</li>
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
      <h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText?.("title", e.currentTarget.textContent || "")} onBlur={(e) => onText?.("title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.title}</h2>
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
      <h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("title", e.currentTarget.textContent || "")} onBlur={(e) => onText("title", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.title}</h2>
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("phone", e.currentTarget.textContent || "")} onBlur={(e) => onText("phone", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.phone}</p>
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("email", e.currentTarget.textContent || "")} onBlur={(e) => onText("email", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.email}</p>
      <p style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("address", e.currentTarget.textContent || "")} onBlur={(e) => onText("address", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.address}</p>
    </section>
  );
};

const TestimonialBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as TestimonialBlockData;
  const parts = block.styles?.parts;
  return (
    <section>
      <blockquote style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("quote", e.currentTarget.textContent || "")} onBlur={(e) => onText("quote", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>"{data.quote}"</blockquote>
      <cite style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("author", e.currentTarget.textContent || "")} onBlur={(e) => onText("author", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.author}</cite>
    </section>
  );
};

const MapBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as MapBlockData;
  const parts = block.styles?.parts;
  return <section><h2 style={partStyleToCss(parts?.heading, "heading")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("address", e.currentTarget.textContent || "")} onBlur={(e) => onText("address", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("heading"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.address || "Map placeholder"}</h2></section>;
};

const MarqueeBlock = ({ block, onText, isPreview, onActivateTarget }: { block: Block; onText: (field: string, value: string) => void; isPreview?: boolean; onActivateTarget?: (part?: string) => void }) => {
  const data = block.data as MarqueeBlockData;
  const parts = block.styles?.parts;
  return <section className="marquee" style={partStyleToCss(parts?.container)}><div style={partStyleToCss(parts?.body, "body")} contentEditable={!isPreview} suppressContentEditableWarning onInput={(e) => onText("text", e.currentTarget.textContent || "")} onBlur={(e) => onText("text", e.currentTarget.textContent || "")} onPointerDown={(e) => { onActivateTarget?.("body"); e.stopPropagation(); }} onPointerUp={(e) => e.stopPropagation()}>{data.text}</div></section>;
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
  const [secretInputs, setSecretInputs] = useState({ imageGenApiKey: "", imageAnalyzeApiKey: "" });
  const [secretStatusMsg, setSecretStatusMsg] = useState("");
  const [resizeStatus, setResizeStatus] = useState("");
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>("fields");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem("sbuild_left_collapsed") === "1");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [prePreviewLeftCollapsed, setPrePreviewLeftCollapsed] = useState(false);
  const [prePreviewRightCollapsed, setPrePreviewRightCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [rightDrawerMobileOpen, setRightDrawerMobileOpen] = useState(false);
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem("sbuild_editor_theme") || "Light");

  useEffect(() => {
    localStorage.setItem("sbuild_editor_theme", editorTheme);
  }, [editorTheme]);

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
      lastFocusedTextBlockId.current = "";
    } else {
      setLeftCollapsed(prePreviewLeftCollapsed);
      setRightCollapsed(prePreviewRightCollapsed);
    }
  }, [previewMode]);

  const isPreview = previewMode;

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const [selectedSitePart, setSelectedSitePart] = useState<string | null>(null);
  const [selectedNavIndex, setSelectedNavIndex] = useState<number | null>(null);
  const [layoutHighlight, setLayoutHighlight] = useState(false);
  const [secretStatus, setSecretStatus] = useState<SBuildSecretConfig | null>(null);
  const [providerCheckMessage, setProviderCheckMessage] = useState("");
  const [opencodeAuth, setOpencodeAuth] = useState<{ status: string; message: string; commands: string[]; output?: string } | null>(null);
  const [buildInfo, setBuildInfo] = useState<SBuildBuildInfo | null>(null);
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
  const [loadedProjectSource, setLoadedProjectSource] = useState("unknown");
  const [loadedProjectUpdatedAt, setLoadedProjectUpdatedAt] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutSectionRef = useRef<HTMLDivElement>(null);

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
  const rowRenderItems = useMemo(() => toRowRenderItems(selectedPage?.blocks || []), [selectedPage?.blocks]);
  const shouldStackRows = deviceMode === "phone";

  function closeTransientOverlays() {
    setContextMenu(null);
    setRightDrawerMobileOpen(false);
  }

  useEffect(() => {
    if (selectedBlock?.type !== "gallery" && selectedGalleryIndex !== null) setSelectedGalleryIndex(null);
  }, [selectedBlock?.id, selectedBlock?.type, selectedGalleryIndex]);

  async function loadBuildInfo() {
    try {
      const data = await fetchJson<SBuildBuildInfo>("/health");
      setBuildInfo(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadProject();
    void loadFonts();
    void loadImages();
    void loadProviders();
    void loadSecretsStatus();
    void loadBuildInfo();
    void loadPhotoFolder();
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
    const timer = window.setTimeout(update, 120);
    const el = topbarRef.current;
    if (!el) {
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(timer);
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
      clearTimeout(timer);
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
  }, [imageManagerOpen]);

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
    const frames = document.querySelectorAll(".canvas-frame, .sbuild-site-preview, .sbuild-rendered-page");
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
      setProject(data.project);
      setPaintMode(false);
      setPaintDraftStrokes([]);
      setPaintAppliedStrokes([]);
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
      const next = data.images || [];
      setUploadedImages(next);
      if (data.folder) setPhotoFolder(data.folder);
      if (!selectedUploadImage && next.length > 0) setSelectedUploadImage(next[0].url);
    } catch { setUploadedImages([]); }
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

  async function loadProviders() {
    try {
      const data = await fetchJson<{ ok: boolean; providers: SBuildProviderStatus[] }>("/api/ai/providers/status");
      setProviderStatus(data.providers || []);
    } catch { setProviderStatus([]); }
  }

  async function loadSecretsStatus() {
    try {
      const data = await fetchJson<{ ok: boolean; imageGen: { source: "env" | "local" | "missing" }; imageAnalyze: { source: "env" | "local" | "missing" } }>("/api/secrets/status");
      setSecretStatus({ imageGenKeySource: data.imageGen.source, imageAnalyzeKeySource: data.imageAnalyze.source });
    } catch {
      setSecretStatus(null);
    }
  }

  function patchCurrentPage(nextPage: SBuildPage) {
    if (!project || !selectedPage) return;
    const pages = project.pages.map((p) => (p.id === selectedPage.id ? nextPage : p));
    setProject({ ...project, pages, updatedAt: new Date().toISOString() });
    setDirty(true);
  }

  function patchSelectedBlock(mutator: (block: Block) => Block) {
    if (!selectedPage || !selectedBlock) return;
    patchCurrentPage({ ...selectedPage, blocks: updateBlock(selectedPage.blocks, selectedBlock.id, mutator) });
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
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    lastFocusedTextBlockId.current = blockId;
  }

  function selectSiteHeaderContainer() {
    setSelectedSitePart("site-header");
    setSelectedNavIndex(null);
    setSelectedBlockId("");
    setSelectedGalleryIndex(null);
    setStatus("Site header container selected");
  }

  function activateBlockTextTarget(blockId: string, part?: string) {
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    if (part) setSelectedPart(part as keyof BlockPartStyles);
    lastFocusedTextBlockId.current = blockId;
  }

  function openBlockDrawer(blockId: string) {
    setSelectedBlockId(blockId);
    setSelectedGalleryIndex(null);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightDrawerMobileOpen(true);
    if (isMobileViewport) setRightCollapsed(false);
    setRightTab("properties");
    setStatus("Edit drawer opened");
  }

  function selectGallerySlot(blockId: string, index: number) {
    setSelectedBlockId(blockId);
    setSelectedPart("image");
    setSelectedGalleryIndex(index);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightTab("images");
    setStatus(`Selected Gallery image ${index + 1}`);
  }

  function openGallerySlotDrawer(blockId: string, index: number) {
    setSelectedBlockId(blockId);
    setSelectedPart("image");
    setSelectedGalleryIndex(index);
    setSelectedSitePart(null);
    setSelectedNavIndex(null);
    setRightTab("images");
    setRightDrawerMobileOpen(true);
    if (isMobileViewport) setRightCollapsed(false);
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
    if (previewMode) {
      setStatus("AI is not available in Preview mode");
      return;
    }

    setRightTab("ai");
    setRightDrawerMobileOpen(true);

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
    patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: url, backgroundSize: "cover", backgroundPosition: "center" } }));
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
          backgroundPosition: "center"
        }
      }));
    } else if (imageManagerTarget === "hero") {
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundImage: url,
          backgroundSize: "cover",
          backgroundPosition: "center"
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
      patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: nextImage, backgroundSize: "cover", backgroundPosition: "center" } }));
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
      patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundImage: nextImage, backgroundSize: "cover", backgroundPosition: "center" } }));
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
    const data = await fetchJson<{ ok: boolean; lastSavedAt?: string; projectPath?: string }>("/api/project", { method: "PUT", body: JSON.stringify({ project: latestProject }) });
    if (data.ok) {
      setLastSavedAt(data.lastSavedAt || new Date().toISOString());
      setProjectPath(data.projectPath || projectPath);
      setDirty(false);
      setStatus("Saved");
      setLastAction("save");
    }
  }

  async function revertProject() {
    setStatus("Reverting to last save...");
    try {
      const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/project");
      if (data.ok && data.project) {
        setProject(data.project);
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
    setChatHistory((h) => [...h, { role: "user", text: prompt }]);
    setChatInput("");
    const data = await fetchJson<{ response: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ prompt }) });
    setChatHistory((h) => [...h, { role: "assistant", text: data.response }]);
  }

  async function quickRewrite(mode: "rewrite" | "shorten" | "lengthen" | "tone") {
    if (!selectedBlock) return;
    const prompt = `${mode.toUpperCase()} this content: ${JSON.stringify(selectedBlock.data)}`;
    setChatInput(prompt);
    await chat();
  }

  async function runWizard() {
    const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/ai/wizard", { method: "POST", body: JSON.stringify(wizardForm) });
    if (data.ok) { setProject(data.project); setDirty(true); setShowWizard(false); setStatus("Wizard applied"); setLastAction("wizard"); }
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
          <button disabled={!hasImage} onClick={() => { setPhotoEditType("enhance"); setPhotoEditInstruction("Enhance"); void applyPhotoEdit({ editType: "enhance", instruction: "Enhance" }); }}>Enhance</button>
          <button disabled={!hasImage} onClick={() => { setPhotoEditType("black-white"); setPhotoEditInstruction("Black and white"); void applyPhotoEdit({ editType: "black-white", instruction: "Black and white" }); }}>Black &amp; white</button>
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

  function pointerPoint(e: React.PointerEvent<HTMLDivElement>): PaintPoint {
    const rect = (e.target as HTMLElement).closest(".canvas-frame")!.getBoundingClientRect();
    return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
  }

  function beginPaint(e: React.PointerEvent<HTMLDivElement>) {
    if (!paintMode || previewMode) return;
    const point = pointerPoint(e);
    if (paintTool === "eraser") {
      e.preventDefault();
      e.stopPropagation();
      setPaintDraftStrokes((strokes) => strokes.slice(0, -1));
      setStatus("Removed last pending stroke");
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

  function movePaint(e: React.PointerEvent<HTMLDivElement>) {
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

  function endPaint() {
    if (!paintMode || previewMode || paintTool === "eraser") return;
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
      points: paintActivePoints
    };
    setPaintDraftStrokes((strokes) => [...strokes, stroke]);
    setPaintActivePoints([]);
    setStatus("Pending paint stroke added");
  }

  function clearPaintDraft() {
    setPaintDraftStrokes([]);
    setPaintActivePoints([]);
    setStatus("Pending paint cleared");
  }

  function applyPaintOverlay() {
    if (paintDraftStrokes.length === 0) {
      setStatus("No pending paint to apply");
      return;
    }
    setPaintAppliedStrokes((strokes) => [...strokes, ...paintDraftStrokes]);
    setPaintDraftStrokes([]);
    setPaintActivePoints([]);
    setDirty(true);
    setLastAction("paint-apply-overlay");
    setStatus("Paint overlay applied to this editor session");
  }

  function discardPaintAndExit() {
    setPaintDraftStrokes([]);
    setPaintActivePoints([]);
    setPaintMode(false);
    setStatus("Discarded pending paint");
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
    if (previewMode) return;
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
    if (isMobileViewport) setRightCollapsed(false);
    setRightTab("properties");
    if (sitePart === "site-header") setStatus("Editing site header container");
    else if (sitePart === "site-title") setStatus("Editing site title");
    else setStatus(`Editing nav link ${(navIndex ?? 0) + 1}`);
  }

  function openSiteHeaderContextMenu(e: React.MouseEvent | React.TouchEvent) {
    if (previewMode) return;
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
    if (previewMode) return;
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
    if (previewMode) return;
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
    if (previewMode) return;
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
        body: JSON.stringify({ imageGenApiKey: secretInputs.imageGenApiKey, imageAnalyzeApiKey: secretInputs.imageAnalyzeApiKey })
      });
      setSecretStatusMsg("Keys saved locally.");
      setStatus("Secret key saved");
      setSecretInputs({ imageGenApiKey: "", imageAnalyzeApiKey: "" });
      await loadProviders();
      await loadSecretsStatus();
    } catch (error) {
      setSecretStatusMsg(`Failed: ${String(error)}`);
    }
  }

  async function testProvider(provider: string) {
    setSecretStatusMsg(`Testing ${provider}...`);
    try {
      const data = await fetchJson<{ ok: boolean; status: string; message: string }>("/api/ai/providers/test", { method: "POST", body: JSON.stringify({ provider }) });
      setSecretStatusMsg(`${provider}: ${data.status} — ${data.message}`);
      setProviderCheckMessage(`Provider status checked: ${provider} (${data.status})`);
      setStatus(`Provider status checked: ${provider} (${data.status})`);
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
              <h3 style={{ margin: 0 }}>Image Manager</h3>
              <button onClick={() => setImageManagerOpen(false)} style={{ padding: "4px 8px" }}>✕</button>
            </div>
              <p className="panel-status">Upload, manage, and apply images</p>

              <div className="image-manager-upload">
                <label>Upload image
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImages(e.target.files)} />
                </label>
                {uploadingImage && <span className="hint">Uploading...</span>}
                {photoEditStatus && <p className="panel-status">{photoEditStatus}</p>}
              </div>

              <div className="image-manager-folder">
                <h4>Project Photo Folder</h4>
                <label>Folder path
                  <input value={photoFolder} onChange={(e) => setPhotoFolder(e.target.value)} placeholder="project/images" />
                </label>
                <p className="hint">Photos uploaded here. Default: project/images</p>
                <div className="button-row compact">
                  <button onClick={() => void savePhotoFolder()}>Save folder</button>
                  <button onClick={() => setPhotoFolder("project/images")}>Reset to project/images</button>
                </div>
              </div>

              <div className="image-manager-gallery">
                <h4>Project Images ({uploadedImages.length})</h4>
                {uploadedImages.length === 0 && <p className="hint">No images uploaded yet. Upload an image above.</p>}
                <div className="image-grid">
                  {uploadedImages.map((img) => (
                    <div key={img.url} className={`image-card ${selectedUploadImage === img.url ? "selected" : ""}`} onClick={() => setSelectedUploadImage(img.url)}>
                      <img
                        src={img.url}
                        alt={img.name}
                        loading="lazy"
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
                      <div className="image-meta">{img.name}{img.isEdited ? " (edited)" : ""}</div>
                    </div>
                  ))}
                </div>
              </div>

              {renderImageManagerActions(false)}
            </div>
          )}

          {rightTab === "ai" && (
            <div className="panel mobile-ai-panel">
              <h3>AI Chat</h3>
              <p className="panel-status">
                <strong>AI panel:</strong> {(() => { const t = computeAiTarget(); if (t.kind === "site-header") return "site header"; if (t.kind === "block") return `block ${t.label}`; return "none"; })()}
              </p>
              <div className="quick-actions">
                <button onClick={() => void quickRewrite("rewrite")}>Rewrite</button>
                <button onClick={() => void quickRewrite("shorten")}>Shorten</button>
                <button onClick={() => void quickRewrite("lengthen")}>Lengthen</button>
                <button onClick={() => void quickRewrite("tone")}>Tone</button>
              </div>
              <div className="chat-log">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`msg ${msg.role}`}>{msg.text}</div>
                ))}
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
              <p><strong>commit:</strong> {SBUILD_VERSION}</p>
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

              <h4>Image API Keys</h4>
              <p className="hint">Keys are stored locally, not in project.json.</p>
              <label>Image Generation API Key
                <input type="password" value={secretInputs.imageGenApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageGenApiKey: e.target.value }))} placeholder="sk-..." />
              </label>
              <label>Image Analysis API Key
                <input type="password" value={secretInputs.imageAnalyzeApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageAnalyzeApiKey: e.target.value }))} placeholder="sk-..." />
              </label>
              <div className="button-row">
                <button onClick={() => void saveSecrets()}>Save Keys Locally</button>
                <button onClick={() => void testProvider("image-gen")}>Test Image Gen</button>
                <button onClick={() => void testProvider("opencode")}>Test OpenCode</button>
              </div>
              {secretStatusMsg && <p className="panel-status">{secretStatusMsg}</p>}

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
    <div className={`app sbuild-editor-shell ${previewMode ? "preview" : "edit"} ${editorTheme === "Dark" ? "theme-dark" : ""} ${isMobileViewport ? "mobile-shell" : ""} ${isMobileViewport && !leftCollapsed ? "mobile-left-open" : ""} ${isMobileViewport && rightDrawerMobileOpen ? "mobile-right-open" : ""}`}>
      <header ref={topbarRef} className="topbar">
        <div className="topbar-mobile-row topbar-mobile-row-main">
          <button onClick={() => { setLeftCollapsed((prev) => { const next = !prev; setStatus(next ? "Left panel collapsed" : "Left panel opened"); return next; }); }}>☰</button>
          <div className="logo" title="Topbar uses Builder UI Theme. Website Theme changes the page preview only.">{SBUILD_APP_NAME} {SBUILD_VERSION}</div>
          <button onClick={() => setPreviewMode((v) => !v)}>{previewMode ? "Edit" : "Preview"}</button>
          <button onClick={() => { setPaintMode((p) => !p); setPaintActivePoints([]); setStatus(paintMode ? "Paint mode off" : "Paint mode on"); }} className={paintMode ? "active" : ""}>Paint</button>
        </div>
        <div className="topbar-mobile-row topbar-mobile-row-actions">
          <button onClick={() => { setImageManagerOpen(true); setImageManagerTarget("block-bg"); setStatus("Image Manager opened"); }}>Images</button>
          <button onClick={() => openAiDrawer()}>AI</button>
          <button onClick={() => { setSettingsOpen(true); setSettingsTab("general"); setStatus("Settings opened"); }}>Settings</button>
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
              <button key={page.id} className={page.id === selectedPage.id ? "selected" : ""} onClick={() => setSelectedPageId(page.id)}>{page.title}</button>
            ))}
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
          <div ref={canvasControlsRef} className="canvas-controls">
            <button onClick={() => setDeviceMode("desktop")} className={deviceMode === "desktop" ? "selected" : ""}>Desktop</button>
            <button onClick={() => setDeviceMode("tablet")} className={deviceMode === "tablet" ? "selected" : ""}>Tablet</button>
            <button onClick={() => setDeviceMode("phone")} className={deviceMode === "phone" ? "selected" : ""}>Phone</button>
            {!previewMode && (
              <>
                <button onClick={() => duplicateBlock()}>Duplicate</button>
                <button onClick={() => deleteBlock()}>Delete</button>
                <button onClick={() => moveBlock("up")}>Up</button>
                <button onClick={() => moveBlock("down")}>Down</button>
              </>
            )}
          </div>
          {paintMode && !previewMode && (
            <div className="paint-toolbar" role="toolbar" aria-label="Paint tools">
              <button onClick={() => setPaintTool("brush")} className={paintTool === "brush" ? "active" : ""}>Brush</button>
              <button onClick={() => setPaintTool("eraser")} className={paintTool === "eraser" ? "active" : ""}>Eraser</button>
              <button onClick={() => setPaintDrawMode("free")} className={paintDrawMode === "free" ? "active" : ""}>Free Draw</button>
              <button onClick={() => setPaintDrawMode("line")} className={paintDrawMode === "line" ? "active" : ""}>Line</button>
              <input aria-label="Paint color" type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} />
              <label className="paint-size-control">
                Size
                <input aria-label="Brush size" type="range" min={1} max={24} value={paintSize} onChange={(e) => setPaintSize(Number(e.target.value))} />
                <span>{paintSize}px</span>
              </label>
              <button onClick={clearPaintDraft} disabled={paintDraftStrokes.length === 0 && paintActivePoints.length === 0}>Clear</button>
              <button onClick={applyPaintOverlay} disabled={paintDraftStrokes.length === 0}>Apply</button>
              <button onClick={discardPaintAndExit}>Discard</button>
            </div>
          )}
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
              <strong>mobile-toolbar-gap-repair</strong> <strong>action-controls-offset</strong> toolbarH={debugToolbarH} spacerH={debugSpacerH} topbarBottom={debugToolbarBottom} ccTop={debugCanvasControlsTop} gapPx={debugGapPx} dup={debugDuplicateOffset ? "true" : "false"} topPad={debugTopbarPaddingTop} missing={debugMeasurementMissing ? "true" : "false"} · <strong>Tip:</strong> Tap text to edit directly · Long-press or tap ⋯ for styles
            </p>
          )}

          <div
            ref={canvasRef}
            className={`canvas-frame sbuild-site-preview sbuild-rendered-page ${deviceMode} ${isMobileViewport ? "mobile-viewport" : ""}`}
            style={{ background: project.globalStyles.colors.bg, color: project.globalStyles.colors.text }}
            onPointerDown={beginPaint}
            onPointerMove={movePaint}
            onPointerUp={endPaint}
            onClick={() => { if (!previewMode) { setSelectedSitePart(null); setSelectedNavIndex(null); } }}
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
                <strong
                  className={!previewMode && selectedSitePart === "site-title" && selectedNavIndex === null ? "selected-site-part" : ""}
                  contentEditable={!previewMode}
                  suppressContentEditableWarning
                  onInput={(e) => { setProject({ ...project, site: { ...project.site, siteName: e.currentTarget.textContent || "" } }); setDirty(true); }}
                  onBlur={(e) => { setProject({ ...project, site: { ...project.site, siteName: e.currentTarget.textContent || "" } }); setDirty(true); }}
                  onClick={(e) => {
                    if (previewMode) return;
                    e.stopPropagation();
                    if (!isMobileViewport) {
                      setSelectedSitePart("site-title");
                      setSelectedNavIndex(null);
                      setRightTab("properties");
                      setStatus("Editing site title");
                    }
                  }}
                  onPointerDown={(e) => {
                    if (previewMode || !isMobileViewport) return;
                    startSiteHeaderLongPress("site-title", e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    if (previewMode || !isMobileViewport) return;
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
                >{project.site.siteName}</strong>
                {isMobileViewport && !previewMode && (
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
                  <span
                    key={item.id}
                    className={!previewMode && selectedSitePart === "nav" && selectedNavIndex === ni ? "selected-site-part" : ""}
                    contentEditable={!previewMode}
                    suppressContentEditableWarning
                    onInput={(e) => { const nav = [...project.site.nav]; nav[ni] = { ...nav[ni], label: e.currentTarget.textContent || "" }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); }}
                    onBlur={(e) => { const nav = [...project.site.nav]; nav[ni] = { ...nav[ni], label: e.currentTarget.textContent || "" }; setProject({ ...project, site: { ...project.site, nav } }); setDirty(true); }}
                    onClick={(e) => {
                      if (previewMode) return;
                      e.stopPropagation();
                      if (!isMobileViewport) {
                        setSelectedSitePart("nav");
                        setSelectedNavIndex(ni);
                        setRightTab("properties");
                        setStatus(`Editing nav link ${ni + 1}`);
                      }
                    }}
                    onPointerDown={(e) => {
                      if (previewMode || !isMobileViewport) return;
                      startSiteHeaderLongPress("nav", e.clientX, e.clientY, ni);
                    }}
                    onPointerUp={(e) => {
                      if (previewMode || !isMobileViewport) return;
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
                  >{item.label}</span>
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
                {!previewMode && row.blocks.length > 1 && (
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
                        onClick={() => { if (!isMobileViewport) selectBlock(block.id); }}
                        onContextMenu={(e) => openContextMenu(e, block.id)}
                        onPointerDown={(e) => handleBlockPointerDown(e, block.id, index)}
                        onPointerUp={(e) => handleBlockPointerUp(e, block.id, index)}
                        onPointerMove={(e) => handleBlockPointerMove(e, block.id, index)}
                        draggable
                        onDragStart={() => handleDragStart(block.id, index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                      >
                        {!previewMode && (
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
                          patchSelectedBlock((current) => ({ ...current, data: { ...(current.data as Record<string, unknown>), [field]: value } }));
                        }, previewMode ? undefined : (index) => selectGallerySlot(block.id, index), selectedBlock?.id === block.id ? selectedGalleryIndex : null, isMobileViewport, previewMode ? undefined : (index) => openGallerySlotDrawer(block.id, index), previewMode, (cardIndex, field, value) => {
                          patchSelectedBlock((current) => {
                            const data = current.data as CardsBlockData;
                            const cards = [...data.cards];
                            cards[cardIndex] = { ...cards[cardIndex], [field]: value };
                            return { ...current, data: { ...data, cards } };
                          });
                        }, (part) => activateBlockTextTarget(block.id, part))}
                        {selectedBlock?.id === block.id && !previewMode && (
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

            {(paintMode || paintAppliedStrokes.length > 0) && (
              <svg className="paint-overlay" viewBox="0 0 1200 1200" preserveAspectRatio="none">
                {paintAppliedStrokes.map((stroke) => (
                  <polyline key={stroke.id} points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.size} strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {paintDraftStrokes.map((stroke) => (
                  <polyline key={stroke.id} points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.size} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />
                ))}
                {paintMode && paintActivePoints.length > 1 && (
                  <polyline points={paintActivePoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={paintColor} strokeWidth={paintSize} strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            )}
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
              <button onClick={() => { openAiDrawer(); setContextMenu(null); }}>AI Assistant</button>
              <button onClick={() => { resetBlockColorsToTheme(); setContextMenu(null); }}>Reset site header colors to theme</button>
              <button onClick={() => { if (window.confirm("Reset all blocks to current theme?")) applyThemeToAllBlocks(); setContextMenu(null); }}>Reset all blocks to theme</button>
              <button onClick={() => setContextMenu(null)}>Close</button>
            </>
          ) : (
            <>
              <button onClick={() => { openBlockDrawer(contextMenu.blockId); setContextMenu(null); }}>Edit Properties</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); }}>AI Assistant</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); openResizeLayoutForBlock(contextMenu.blockId); setContextMenu(null); }}>Resize/Layout</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); setImageManagerOpen(true); setImageManagerTarget("block-bg"); setContextMenu(null); setStatus("Image Manager opened for block"); }}>Image Manager</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); startNewRow(contextMenu.blockId); closeTransientOverlays(); }}>Start new row</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); placeWithPrevious(contextMenu.blockId); closeTransientOverlays(); }}>Place with block above</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); placeWithNext(contextMenu.blockId); closeTransientOverlays(); }}>Place with block below</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); removeFromRow(contextMenu.blockId); closeTransientOverlays(); }}>Remove from row / Leave row</button>
              <button onClick={() => { resetBlockColorsToTheme(contextMenu.blockId); setContextMenu(null); }}>Reset block colors to theme</button>
              <button onClick={() => { if (window.confirm("Reset all blocks to current theme?")) applyThemeToAllBlocks(); setContextMenu(null); }}>Reset all blocks to theme</button>
              <button onClick={() => { duplicateBlock(contextMenu.blockId); setContextMenu(null); }}>Duplicate</button>
              <button onClick={() => { deleteBlock(contextMenu.blockId); setContextMenu(null); }}>Delete</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); moveBlock("up", contextMenu.blockId); closeTransientOverlays(); }}>Move Up</button>
              <button onClick={() => { selectBlock(contextMenu.blockId); moveBlock("down", contextMenu.blockId); closeTransientOverlays(); }}>Move Down</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); }}>AI Edit</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); }}>Generate Image</button>
              <button onClick={() => { openAiDrawer(contextMenu.blockId); setContextMenu(null); }}>Edit Photo</button>
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
              <button className={settingsTab === "keys" ? "selected" : ""} onClick={() => setSettingsTab("keys")}>Image/API Keys</button>
              <button className={settingsTab === "deploy" ? "selected" : ""} onClick={() => setSettingsTab("deploy")}>Deploy Safety</button>
              <button className={settingsTab === "debug" ? "selected" : ""} onClick={() => setSettingsTab("debug")}>Debug</button>
              <button className={settingsTab === "about" ? "selected" : ""} onClick={() => setSettingsTab("about")}>About</button>
            </div>
            {settingsTab === "general" && (
              <div className="panel-status">
                <p>Use tabs to configure providers, keys, and deploy safety.</p>
                <p><strong>Builder UI Theme</strong> changes only the editor toolbar, panels, buttons, and modals.</p>
                <p><strong>Website Theme</strong> changes only the page preview, including your site header/nav and content blocks.</p>
                <p className="hint">The SBUILD topbar, left/right panels, and all editor buttons always use Builder UI Theme colors — Website Theme never affects them.</p>
                <label style={{ marginTop: 12, display: "block" }}>Editor Theme
                  <select value={editorTheme} onChange={(e) => setEditorTheme(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="Light">Light</option>
                    <option value="Dark">Dark</option>
                  </select>
                </label>
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
              <p className="hint"><strong>B) API-key providers</strong> use local secret fields in Image/API Keys.</p>
              <p className="hint"><strong>C) Image/API keys</strong> are masked and never stored in project.json.</p>
              {providerCheckMessage && <p className="panel-status">{providerCheckMessage}</p>}
            </div>}
            {settingsTab === "keys" && <div>
              <p className="hint">Keys are saved in local ignored secret config, never project.json.</p>
              <label>Image Generation API Key<input type="password" value={secretInputs.imageGenApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageGenApiKey: e.target.value }))} placeholder="sk-..." /></label>
              <label>Image Analyze API Key<input type="password" value={secretInputs.imageAnalyzeApiKey} onChange={(e) => setSecretInputs((s) => ({ ...s, imageAnalyzeApiKey: e.target.value }))} placeholder="sk-..." /></label>
              <div className="button-row"><button onClick={() => void saveSecrets()}>Save Keys</button><button onClick={() => void testProvider("image-gen")}>Test Keys</button></div>
              <p className="panel-status">Image gen source: {secretStatus?.imageGenKeySource || "missing"} · Image analyze source: {secretStatus?.imageAnalyzeKeySource || "missing"}</p>
              {secretStatusMsg && <p className="panel-status">{secretStatusMsg}</p>}
            </div>}
            {settingsTab === "deploy" && <div>
              <p className="panel-status"><strong>Live publish disabled</strong></p>
              <p>SBUILD_ALLOW_PUBLISH: {"false"}</p>
              <p>Publish target: dry-run preview</p>
            </div>}
            {settingsTab === "debug" && <div>
              <p><strong>Version:</strong> {SBUILD_APP_NAME} {SBUILD_VERSION}</p>
              <p><strong>Git commit:</strong> {buildInfo?.gitCommit || "unknown"}</p>
              <p><strong>Selected block:</strong> {selectedBlock?.id || "none"} ({selectedBlock?.type || "none"})</p>
              <p><strong>Theme:</strong> {themeApplied || "custom"}</p>
              <p><strong>Last API status:</strong> {status}</p>
            </div>}
            {settingsTab === "about" && <div>
              <p><strong>{SBUILD_APP_NAME}</strong> <span style={{ opacity: 0.7 }}>{SBUILD_VERSION}</span></p>
              <p><strong>Health:</strong> {buildInfo ? "✅ Server reachable" : "❌ Server unreachable"}</p>
              <p><strong>Git commit:</strong> {buildInfo?.gitCommit || "unknown"}</p>
              <p><strong>Branch:</strong> {buildInfo?.branch || "unknown"}</p>
              <p><strong>Build date:</strong> {buildInfo?.buildDate ? new Date(buildInfo.buildDate).toLocaleString() : "unknown"}</p>
              <p><strong>Publish allowed:</strong> {buildInfo?.publishAllowed ? "Yes" : "No (dry-run)"}</p>
              <p><strong>Loaded project source:</strong> {loadedProjectSource}</p>
              {projectPath && <p><strong>Project path:</strong> {projectPath}</p>}
              <p><strong>App dirty (unsaved edits):</strong> {dirty ? "Yes — has unsaved changes" : "No — all saved"}</p>
              <p><strong>Git working tree:</strong> {buildInfo?.dirty ? "Modified (has local changes)" : "Clean (matches last commit)"}</p>
              {buildInfo?.dirtySummary && (
                <p><strong>Git summary:</strong> {`${buildInfo.dirtySummary.modifiedTracked} tracked modified, ${buildInfo.dirtySummary.untracked} untracked`}</p>
              )}
              <p className="hint">Dirty means local source files differ from the last commit. Ignored uploads/cache not counted.</p>
              <div className="button-row compact">
                <button onClick={() => {
                  const dirtySummary = buildInfo?.dirtySummary;
                  const diag = {
                    app: SBUILD_APP_NAME,
                    version: SBUILD_VERSION,
                    buildInfo,
                    theme: themeApplied || "custom",
                    dirty,
                    dirtyNote: dirty ? "App has unsaved project edits" : "All app edits saved",
                    gitDirty: buildInfo?.dirty,
                    gitDirtyNote: buildInfo?.dirty ? "Source files differ from last commit" : "Clean working tree",
                    gitDirtySummary: dirtySummary,
                    blocks: project?.pages.reduce((sum, p) => sum + p.blocks.length, 0) || 0,
                    pages: project?.pages.length || 0,
                    userAgent: navigator.userAgent
                  };
                  navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).then(() => setStatus("Diagnostics copied to clipboard")).catch(() => setStatus("Copy failed"));
                }}>Copy diagnostics</button>
              </div>
              <hr />
              <p><strong>Changelog</strong></p>
              <p>Latest: 0.4.0-dev — Versioning, Transparent Styles, Visual Effects</p>
              <p style={{ fontSize: 12, opacity: 0.7 }}>See CHANGELOG.md in project root for full history.</p>
            </div>}
            <div className="button-row"><button onClick={() => setSettingsOpen(false)}>Close</button></div>
          </div>
        </div>
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

      {/* Image Manager Modal */}
      {imageManagerOpen && (
        <div className="modal-backdrop" onClick={() => setImageManagerOpen(false)}>
          <div className="modal image-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Image Manager</h3>
              <button className="modal-close" onClick={() => setImageManagerOpen(false)} aria-label="Close Image Manager">✕</button>
            </div>
            <div className="image-manager-upload">
              <label>Upload image
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImages(e.target.files)} />
              </label>
              {uploadingImage && <span className="hint">Uploading...</span>}
            </div>
            <div className="image-manager-folder">
              <h4>Project Photo Folder</h4>
              <p className="hint">Photos uploaded here. Default: project/images</p>
              <label>Folder path
                <input value={photoFolder} onChange={(e) => setPhotoFolder(e.target.value)} placeholder="project/images" />
              </label>
              <div className="button-row compact">
                <button onClick={() => void savePhotoFolder()}>Save folder</button>
                <button onClick={() => setPhotoFolder("project/images")}>Reset to project/images</button>
              </div>
            </div>
            
            <div className="image-manager-gallery">
              <h4>Project Images</h4>
              {uploadedImages.length === 0 && <p className="hint">No images uploaded yet. Upload an image above.</p>}
              <div className="image-grid">
                {uploadedImages.map((img) => (
                  <div key={img.url} className={`image-card ${selectedUploadImage === img.url ? "selected" : ""}`} onClick={() => setSelectedUploadImage(img.url)}>
                    <img
                      src={img.url}
                      alt={img.name}
                      loading="lazy"
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
                    <div className="image-meta">{img.name}{img.isEdited ? " (edited)" : ""}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {renderImageManagerActions(true)}
            <div className="image-manager-footer">
              <button onClick={() => setImageManagerOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
