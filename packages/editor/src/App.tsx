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
  SBuildProviderStatus,
  SBuildSecretConfig,
  clampMinHeight,
  clampWidthPercent,
  groupBlocksIntoRows,
  joinAdjacentBlocks,
  leaveRowForBlock,
  snapMinHeight,
  snapWidthPercent
} from "@sbuild/shared";

type DeviceMode = "desktop" | "tablet" | "phone";
type RightTab = "properties" | "ai" | "status";
type PropertiesTab = "fields" | "resize";
type SettingsTab = "general" | "providers" | "keys" | "deploy" | "debug";
type ChatItem = { role: "user" | "assistant"; text: string };
type PaintPoint = { x: number; y: number };
type DragState = { blockId: string; startIndex: number; currentIndex: number } | null;
type ContextMenuState = { visible: boolean; x: number; y: number; blockId: string } | null;
type ResizeDragState = { handle: "right" | "bottom"; blockId: string; startX: number; startY: number; startWidth: number; startMinHeight: number } | null;

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
  { name: "Harvest Light", colors: { bg: "#f6f3e9", surface: "#fffef9", text: "#1f2a24", accent: "#2f6b3f", muted: "#6f7f73" }, headingFont: "Nunito Sans", isDark: false },
  { name: "Farmstand Dark", colors: { bg: "#1a1f1c", surface: "#242b26", text: "#e8f0e9", accent: "#5cb85c", muted: "#8a9a8d" }, headingFont: "Nunito Sans", isDark: true },
  { name: "Slimy Neon", colors: { bg: "#0a0a12", surface: "#12121f", text: "#e0e0ff", accent: "#00ffaa", muted: "#6b6b8a" }, headingFont: "Space Grotesk", isDark: true },
  { name: "Midnight Orchard", colors: { bg: "#0f1419", surface: "#1a2028", text: "#d4dde5", accent: "#7eb8da", muted: "#5a6b7a" }, headingFont: "Lato", isDark: true },
  { name: "Retro Terminal", colors: { bg: "#0c0c0c", surface: "#1a1a1a", text: "#33ff33", accent: "#ffff33", muted: "#555555" }, headingFont: "Space Grotesk", isDark: true },
  { name: "Clean Market", colors: { bg: "#fafafa", surface: "#ffffff", text: "#1a1a1a", accent: "#ff6b35", muted: "#888888" }, headingFont: "Poppins", isDark: false },
  { name: "Ocean", colors: { bg: "#eef6fb", surface: "#ffffff", text: "#1b2f3b", accent: "#1a7ba8", muted: "#5f7380" }, headingFont: "Lato", isDark: false },
  { name: "Sunset", colors: { bg: "#fff1e8", surface: "#fffaf4", text: "#3a241f", accent: "#cc5f2f", muted: "#8b6b60" }, headingFont: "Playfair Display", isDark: false }
];

const OLD_LIGHT_BACKGROUNDS = new Set(["#fff", "#ffffff", "#fffef9", "#fafafa", "#f6f3e9"]);
const OLD_DARK_TEXT = new Set(["#222", "#222222", "#1f2a24", "#1a1a1a"]);

function shortRowId(rowId?: string): string {
  if (!rowId) return "Single";
  return `Row ${rowId.replace("row-", "").slice(0, 4).toUpperCase()}`;
}

function apiBase(): string { return ""; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${url}`, { headers: { "Content-Type": "application/json" }, ...init });
  return (await res.json()) as T;
}

function blockStyleToCss(block: Block): Record<string, string | number> {
  const s = block.styles || {};
  const layout = s.layout || {};
  const css: Record<string, string | number> = {
    background: s.backgroundColor || "var(--sbuild-block-bg)",
    backgroundImage: s.backgroundImage ? `url(${s.backgroundImage})` : "",
    backgroundSize: s.backgroundSize === "contain" ? "contain" : s.backgroundSize === "fill" ? "100% 100%" : "cover",
    backgroundRepeat: s.backgroundImage ? "no-repeat" : "",
    backgroundPosition: s.backgroundPosition || "center",
    color: s.textColor || "var(--sbuild-text)",
    fontFamily: s.fontFamily
      ? `'${s.fontFamily}', sans-serif`
      : (block.type === "hero" || block.type === "text" || block.type === "cards" ? "var(--sbuild-heading-font)" : "var(--sbuild-body-font)"),
    fontSize: s.fontSize ? `${s.fontSize}px` : "",
    fontWeight: s.fontWeight || "",
    textAlign: s.textAlign || "left",
    padding: `${s.padding ?? 16}px`,
    margin: `${s.margin ?? 8}px 0`,
    borderRadius: `${s.borderRadius ?? 12}px`,
    boxShadow: s.shadow || "",
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

const HeroBlock = ({ block, onText }: { block: Block; onText: (field: string, value: string) => void }) => {
  const data = block.data as HeroBlockData;
  return (
    <section>
      <h1 contentEditable suppressContentEditableWarning onBlur={(e) => onText("heading", e.currentTarget.textContent || "")}>{data.heading}</h1>
      <p contentEditable suppressContentEditableWarning onBlur={(e) => onText("subheading", e.currentTarget.textContent || "")}>{data.subheading}</p>
      <button className="cta-btn">{data.ctaLabel || "Call to Action"}</button>
    </section>
  );
};

const TextBlock = ({ block, onText }: { block: Block; onText: (field: string, value: string) => void }) => {
  const data = block.data as TextBlockData;
  return (
    <section>
      <h2 contentEditable suppressContentEditableWarning onBlur={(e) => onText("title", e.currentTarget.textContent || "")}>{data.title}</h2>
      <p contentEditable suppressContentEditableWarning onBlur={(e) => onText("body", e.currentTarget.textContent || "")}>{data.body}</p>
    </section>
  );
};

const ImageBlock = ({ block }: { block: Block }) => {
  const data = block.data as ImageBlockData;
  const fit = block.styles?.backgroundSize || "cover";
  return (
    <section>
      {data.src ? <img src={data.src} alt={data.alt} className="block-image" style={{ objectFit: fit }} /> : <div className="image-placeholder">Image Placeholder</div>}
      <p>{data.caption}</p>
    </section>
  );
};

const CardsBlock = ({ block }: { block: Block }) => {
  const data = block.data as CardsBlockData;
  return (
    <section>
      <h2>{data.title}</h2>
      <div className="cards-grid">
        {data.cards.map((card) => (
          <article key={card.id}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

const HoursBlock = ({ block }: { block: Block }) => {
  const data = block.data as HoursBlockData;
  return (
    <section>
      <h2>{data.title}</h2>
      <ul>
        {data.rows.map((row, i) => (
          <li key={`${row.day}-${i}`}>{row.day}: {row.open} - {row.close}</li>
        ))}
      </ul>
    </section>
  );
};

const GalleryBlock = ({ block }: { block: Block }) => {
  const data = block.data as GalleryBlockData;
  const fit = block.styles?.backgroundSize || "cover";
  return (
    <section>
      <h2>{data.title}</h2>
      <div className="gallery-grid">
        {data.images.map((img) => (
          <figure key={img.id}>{img.src ? <img src={img.src} alt={img.alt} className="block-image" style={{ objectFit: fit }} /> : <div className="image-placeholder">Gallery Image</div>}</figure>
        ))}
      </div>
    </section>
  );
};

const ContactBlock = ({ block }: { block: Block }) => {
  const data = block.data as ContactBlockData;
  return (
    <section>
      <h2>{data.title}</h2>
      <p>{data.phone}</p>
      <p>{data.email}</p>
      <p>{data.address}</p>
    </section>
  );
};

const TestimonialBlock = ({ block }: { block: Block }) => {
  const data = block.data as TestimonialBlockData;
  return (
    <section>
      <blockquote>"{data.quote}"</blockquote>
      <cite>{data.author}</cite>
    </section>
  );
};

const MapBlock = ({ block }: { block: Block }) => {
  const data = block.data as MapBlockData;
  return <section><h2>Map</h2><p>{data.address || "Map placeholder"}</p></section>;
};

const MarqueeBlock = ({ block }: { block: Block }) => {
  const data = block.data as MarqueeBlockData;
  return <section className="marquee"><div>{data.text}</div></section>;
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

function renderTypedBlock(block: Block, onText: (field: string, value: string) => void): JSX.Element {
  switch (block.type) {
    case "hero": return <HeroBlock block={block} onText={onText} />;
    case "text": return <TextBlock block={block} onText={onText} />;
    case "image": return <ImageBlock block={block} />;
    case "cards": return <CardsBlock block={block} />;
    case "hours": return <HoursBlock block={block} />;
    case "gallery": return <GalleryBlock block={block} />;
    case "contact": return <ContactBlock block={block} />;
    case "testimonial": return <TestimonialBlock block={block} />;
    case "map": return <MapBlock block={block} />;
    case "marquee": return <MarqueeBlock block={block} />;
    case "spacer": return <SpacerBlock block={block} />;
    case "divider": return <DividerBlock block={block} />;
    case "html": return <HtmlBlock block={block} />;
    default: return <div>Unknown block</div>;
  }
}

export function App() {
  const [project, setProject] = useState<SBuildProject | null>(null);
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
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedUploadImage, setSelectedUploadImage] = useState("");
  const [photoEditType, setPhotoEditType] = useState("enhance");
  const [photoEditInstruction, setPhotoEditInstruction] = useState("");
  const [photoEditStatus, setPhotoEditStatus] = useState("");
  const [lastEditedImage, setLastEditedImage] = useState("");
  const [paintPath, setPaintPath] = useState<PaintPoint[]>([]);
  const [paintPrompt, setPaintPrompt] = useState("");
  const [paintOpen, setPaintOpen] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [themeApplied, setThemeApplied] = useState("");
  const [providerStatus, setProviderStatus] = useState<SBuildProviderStatus[]>([]);
  const [secretInputs, setSecretInputs] = useState({ imageGenApiKey: "", imageAnalyzeApiKey: "" });
  const [secretStatusMsg, setSecretStatusMsg] = useState("");
  const [resizeStatus, setResizeStatus] = useState("");
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>("fields");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem("sbuild_left_collapsed") === "1");
  const [layoutHighlight, setLayoutHighlight] = useState(false);
  const [secretStatus, setSecretStatus] = useState<SBuildSecretConfig | null>(null);
  const [providerCheckMessage, setProviderCheckMessage] = useState("");
  const [opencodeAuth, setOpencodeAuth] = useState<{ status: string; message: string; commands: string[]; output?: string } | null>(null);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState>(null);
  const [selectedThemeName, setSelectedThemeName] = useState(themePresets[0].name);
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutSectionRef = useRef<HTMLDivElement>(null);

  const selectedPage = useMemo(() => project?.pages.find((p) => p.id === selectedPageId) || project?.pages[0], [project, selectedPageId]);
  const selectedBlock = selectedPage?.blocks.find((b) => b.id === selectedBlockId) || selectedPage?.blocks[0];
  const rowGroups = useMemo(() => groupBlocksIntoRows(selectedPage?.blocks || []), [selectedPage?.blocks]);

  useEffect(() => {
    void loadProject();
    void loadFonts();
    void loadImages();
    void loadProviders();
    void loadSecretsStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem("sbuild_left_collapsed", leftCollapsed ? "1" : "0");
  }, [leftCollapsed]);

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
  }, []);

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
    document.body.style.setProperty("--sbuild-editor-bg", dark ? colors.bg : "#f3ecdc");
    document.body.style.setProperty("--sbuild-canvas-bg", colors.bg);
    document.body.style.setProperty("--sbuild-surface", colors.surface);
    document.body.style.setProperty("--sbuild-surface-2", dark ? "rgba(255,255,255,0.04)" : "#fffef9");
    document.body.style.setProperty("--sbuild-border", dark ? "rgba(255,255,255,0.18)" : "#d5cfbe");
    document.body.style.setProperty("--sbuild-text", colors.text);
    document.body.style.setProperty("--sbuild-muted", colors.muted);
    document.body.style.setProperty("--sbuild-accent", colors.accent);
    document.body.style.setProperty("--sbuild-nav-bg", dark ? "rgba(12,12,18,0.86)" : colors.surface);
    document.body.style.setProperty("--sbuild-block-bg", dark ? colors.surface : colors.surface);
    document.body.style.setProperty("--sbuild-card-bg", dark ? "rgba(255,255,255,0.06)" : "#f7efdc");
    document.body.style.setProperty("--sbuild-button-bg", dark ? "rgba(255,255,255,0.08)" : colors.surface);
    document.body.style.setProperty("--sbuild-button-text", colors.text);
    document.body.style.setProperty("--sbuild-heading-font", project.globalStyles.headingFont || "Nunito Sans");
    document.body.style.setProperty("--sbuild-body-font", project.globalStyles.bodyFont || "Nunito Sans");
  }, [project, themeApplied]);

  useEffect(() => {
    if (!project || selectedPageId) return;
    const page = project.pages[0];
    setSelectedPageId(page.id);
    setSelectedBlockId(page.blocks[0]?.id || "");
  }, [project, selectedPageId]);

  async function loadProject() {
    try {
      const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/project");
      setProject(data.project);
      const matched = themePresets.find((t) => t.colors.bg === data.project.globalStyles.colors.bg && t.colors.surface === data.project.globalStyles.colors.surface);
      if (matched) {
        setSelectedThemeName(matched.name);
        setThemeApplied(matched.name);
      }
      setStatus("Project loaded");
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
      const data = await fetchJson<{ ok: boolean; images: string[] }>("/api/images");
      const next = data.images || [];
      setUploadedImages(next);
      if (!selectedUploadImage && next.length > 0) setSelectedUploadImage(next[0]);
    } catch { setUploadedImages([]); }
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

  function currentTargetContext(): ImageTargetContext {
    return {
      blockType: blockTypeForTarget(selectedBlock),
      usage: usageForTarget(selectedBlock),
      viewportHint: deviceMode === "phone" ? "mobile" : deviceMode === "tablet" ? "tablet" : "desktop",
      aspectRatioHint: inferAspectRatioHint(selectedBlock),
      currentBlockId: selectedBlock?.id,
      currentImagePath: selectedBlock?.type === "image" ? (selectedBlock.data as ImageBlockData).src : undefined,
      cropMode: selectedBlock?.type === "hero" ? "cover" : selectedBlock?.type === "image" ? "contain" : "cover"
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
        const existing = data.images.findIndex((img) => !img.src);
        const images = [...data.images];
        const next = { id: `g-${Date.now()}`, src: nextImage, alt: altText };
        if (existing >= 0) images[existing] = next; else images.push(next);
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
    if (!project) return;
    setStatus("Saving...");
    const data = await fetchJson<{ ok: boolean }>("/api/project", { method: "PUT", body: JSON.stringify({ project }) });
    if (data.ok) { setDirty(false); setStatus("Saved"); setLastAction("save"); }
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

  async function applyPhotoEdit() {
    if (!selectedUploadImage) { setPhotoEditStatus("Select an uploaded image first."); return; }
    const targetContext = currentTargetContext();
    const data = await fetchJson<{ ok: boolean; unavailable?: boolean; message?: string; error?: string; editedImageUrl?: string; originalImageUrl?: string; sizeDecision?: ImageSizeDecision; warnings?: string[] }>("/api/images/edit", {
      method: "POST",
      body: JSON.stringify({ imagePath: selectedUploadImage, instruction: photoEditInstruction, editType: photoEditType, targetContext })
    });
    if (data.sizeDecision) setImageSizeDecision(data.sizeDecision);
    if (!data.ok || !data.editedImageUrl) { setPhotoEditStatus(data.message || data.error || "Photo edit unavailable."); return; }
    setLastEditedImage(data.editedImageUrl);
    applyImageToSelectedBlock(data.editedImageUrl, `Edited photo (${photoEditType})`);
    await loadImages();
    setPhotoEditStatus(`Edited photo ready. ${(data.warnings || []).join(" ")}`.trim());
    setLastAction("photo-edit");
  }

  function duplicateBlock(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    const target = selectedPage.blocks.find((b) => b.id === targetId);
    if (!target) return;
    const copy: Block = { ...target, id: `${target.id}-copy-${Math.random().toString(36).slice(2, 6)}` };
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, copy] });
    setSelectedBlockId(copy.id);
    setLastAction("duplicate-block");
  }

  function deleteBlock(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const next = selectedPage.blocks.filter((b) => b.id !== targetId);
    patchCurrentPage({ ...selectedPage, blocks: next });
    setSelectedBlockId(next[0]?.id || "");
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
    setContextMenu(null);
  }

  function applyTheme(index: number) {
    if (!project) return;
    const theme = themePresets[index];
    setSelectedThemeName(theme.name);
    const nextPages = project.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        const bg = String(block.styles?.backgroundColor || "").toLowerCase();
        const txt = String(block.styles?.textColor || "").toLowerCase();
        const hasExplicitBg = Boolean(bg && !OLD_LIGHT_BACKGROUNDS.has(bg));
        const hasExplicitText = Boolean(txt && !OLD_DARK_TEXT.has(txt));
        return {
          ...block,
          styles: {
            ...(block.styles || {}),
            backgroundColor: hasExplicitBg ? block.styles?.backgroundColor : theme.colors.surface,
            textColor: hasExplicitText ? block.styles?.textColor : theme.colors.text,
            fontFamily: block.styles?.fontFamily || (block.type === "hero" || block.type === "text" || block.type === "cards" ? theme.headingFont : project.globalStyles.bodyFont)
          }
        };
      })
    }));
    setProject({
      ...project,
      globalStyles: {
        ...project.globalStyles,
        headingFont: theme.headingFont || project.globalStyles.headingFont,
        bodyFont: theme.headingFont === "Playfair Display" ? "Lato" : project.globalStyles.bodyFont,
        colors: { ...project.globalStyles.colors, ...theme.colors }
      },
      pages: nextPages
    });
    setDirty(true);
    setLastAction(`theme-${theme.name}`);
    setThemeApplied(theme.name);
    setStatus(`Theme applied: ${theme.name} · dark=${theme.isDark ? "true" : "false"} · canvas=${theme.colors.bg} · block=${theme.colors.surface} · text=${theme.colors.text}`);
  }

  function openResizeLayoutForBlock(blockId: string) {
    const block = selectedPage?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    setSelectedBlockId(blockId);
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
    setStatus("Joined row with previous block");
  }

  function placeWithNext(blockId?: string) {
    if (!selectedPage) return;
    const targetId = blockId || selectedBlock?.id;
    if (!targetId) return;
    const idx = selectedPage.blocks.findIndex((b) => b.id === targetId);
    const joined = joinAdjacentBlocks(selectedPage.blocks, idx, "next");
    if (joined === selectedPage.blocks) return;
    patchCurrentPage({ ...selectedPage, blocks: joined });
    setStatus("Joined row with next block");
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
    patchCurrentPage({ ...selectedPage, blocks: updateBlock(selectedPage.blocks, targetId, (b) => ({ ...b, styles: { ...(b.styles || {}), backgroundColor: project.globalStyles.colors.surface, textColor: project.globalStyles.colors.text, fontFamily: undefined } })) });
    setStatus("Block colors reset to theme");
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
            backgroundColor: b.styles?.backgroundColor && !OLD_LIGHT_BACKGROUNDS.has(String(b.styles.backgroundColor).toLowerCase())
              ? b.styles?.backgroundColor
              : project.globalStyles.colors.surface,
            textColor: b.styles?.textColor && !OLD_DARK_TEXT.has(String(b.styles.textColor).toLowerCase())
              ? b.styles?.textColor
              : project.globalStyles.colors.text,
            fontFamily: b.styles?.fontFamily || (b.type === "hero" || b.type === "text" || b.type === "cards" ? project.globalStyles.headingFont : project.globalStyles.bodyFont)
          }
        }))
      }))
    });
    setDirty(true);
    setStatus("Applied theme to all blocks");
  }

  function addBlock(type: BlockType) {
    if (!selectedPage) return;
    const b = defaultBlock(type);
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, b] });
    setSelectedBlockId(b.id);
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
    if (!paintMode) return;
    setPaintPath([pointerPoint(e)]);
  }

  function movePaint(e: React.PointerEvent<HTMLDivElement>) {
    if (!paintMode || paintPath.length === 0) return;
    setPaintPath((pts) => [...pts, pointerPoint(e)]);
  }

  function endPaint() {
    if (!paintMode || paintPath.length < 2) return;
    setPaintOpen(true);
  }

  async function applyPaintFix() {
    if (!project || !selectedPage) return;
    const data = await fetchJson<{ ok: boolean; project: SBuildProject; notes: string[] }>("/api/ai/paint-fix", {
      method: "POST",
      body: JSON.stringify({ instruction: paintPrompt, pageId: selectedPage.id, bounds: { width: 0, height: 0 }, points: paintPath, selectedBlockId, project })
    });
    if (data.ok) { setProject(data.project); setDirty(true); setStatus(`Paint fix applied: ${data.notes.join("; ")}`); setLastAction("paint-fix"); }
    setPaintOpen(false); setPaintPrompt(""); setPaintPath([]);
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

  function handleBlockPointerDown(e: React.PointerEvent, blockId: string, index: number) {
    if (e.button !== 0) return;
    const timer = setTimeout(() => {
      openContextMenu(e, blockId);
      setLongPressTimer(null);
    }, 600);
    setLongPressTimer(timer);
  }

  function handleBlockPointerUp(e: React.PointerEvent, blockId: string, index: number) {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null); }
    if (!drag) { setSelectedBlockId(blockId); }
  }

  function handleBlockPointerMove(e: React.PointerEvent, blockId: string, index: number) {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null); }
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

  if (!project || !selectedPage) {
    return <div className="loading">Loading sBuild...</div>;
  }

  return (
    <div className={`app ${previewMode ? "preview" : "edit"}`}>
      <header className="topbar">
        <button onClick={() => { setLeftCollapsed((prev) => { const next = !prev; setStatus(next ? "Left panel collapsed" : "Left panel opened"); return next; }); }}>☰</button>
        <div className="logo">sBuild v2</div>
        <button onClick={() => setPreviewMode((v) => !v)}>{previewMode ? "Edit" : "Preview"}</button>
        <button onClick={() => setPaintMode((p) => !p)} className={paintMode ? "active" : ""}>Paint</button>
        <button onClick={() => setRightTab("ai")}>AI</button>
        <button onClick={() => { setSettingsOpen(true); setSettingsTab("general"); setStatus("Settings opened"); }}>Settings</button>
        <button onClick={() => void saveProject()}>Save</button>
        <button onClick={() => void runBuild()}>Build</button>
        <button onClick={() => void runPublish()}>Publish</button>
        <div className="topbar-status">
          <strong>Status:</strong> {withSavedStatusText(status, dirty)} · {status}
        </div>
      </header>

      <div className={`workspace ${leftCollapsed ? "left-collapsed" : ""}`}>
        <aside className={`left-drawer ${leftCollapsed ? "collapsed" : ""}`}>
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
              <button onClick={() => applyThemeToAllBlocks()}>Apply theme to all blocks</button>
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
          <div className="canvas-controls">
            <button onClick={() => setDeviceMode("desktop")} className={deviceMode === "desktop" ? "selected" : ""}>Desktop</button>
            <button onClick={() => setDeviceMode("tablet")} className={deviceMode === "tablet" ? "selected" : ""}>Tablet</button>
            <button onClick={() => setDeviceMode("phone")} className={deviceMode === "phone" ? "selected" : ""}>Phone</button>
            <button onClick={() => duplicateBlock()}>Duplicate</button>
            <button onClick={() => deleteBlock()}>Delete</button>
            <button onClick={() => moveBlock("up")}>Up</button>
            <button onClick={() => moveBlock("down")}>Down</button>
          </div>
          <p className="panel-status">
            <strong>Canvas debug:</strong> selected {selectedBlock?.type || "none"} · {selectedBlock?.id || "none"} · mode {previewMode ? "preview" : "edit"}
            {drag && ` · dragging ${drag.blockId.slice(0, 12)} ${drag.startIndex}→${drag.currentIndex}`}
            {resizeStatus && ` · ${resizeStatus}`}
            {themeApplied && ` · theme: ${themeApplied}`}
            {!leftCollapsed ? " · left panel open" : " · left panel collapsed"}
          </p>

          <div
            ref={canvasRef}
            className={`canvas-frame ${deviceMode}`}
            style={{ background: project.globalStyles.colors.bg, color: project.globalStyles.colors.text }}
            onPointerDown={beginPaint}
            onPointerMove={movePaint}
            onPointerUp={endPaint}
          >
            <nav className="canvas-nav">
              <strong>{project.site.siteName}</strong>
              <div className="nav-items">
                {project.site.nav.map((item) => (
                  <span key={item.id}>{item.label}</span>
                ))}
              </div>
            </nav>

            {rowGroups.map((row) => (
              <div key={row.rowId} className={`row-shell ${row.blocks.length > 1 ? "multi" : "single"} ${deviceMode === "phone" ? "stack" : ""}`}>
                <div className="row-label">{shortRowId(row.rowId.startsWith("single:") ? undefined : row.rowId)} · {row.blocks.length} columns</div>
                <div className="row-grid">
                  {row.blocks.map((block) => {
                    const index = selectedPage.blocks.findIndex((b) => b.id === block.id);
                    const width = block.styles?.layout?.widthPercent || 100;
                    const minH = block.styles?.layout?.minHeightPx || 120;
                    return (
                      <div
                        key={block.id}
                        className={`block-shell ${block.id === selectedBlock?.id ? "selected-block" : ""} ${drag?.blockId === block.id ? "dragging" : ""}`}
                        style={{ ...blockStyleToCss(block), flexBasis: deviceMode === "phone" ? "100%" : `${width}%` }}
                        onClick={() => setSelectedBlockId(block.id)}
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
                            <span className="grab-handle" title="Drag to reorder">⋮⋮</span>
                            {block.type} · {block.id.slice(0, 12)}
                            <span className="resize-badge">{row.rowId.startsWith("single:") ? "Single" : `${shortRowId(row.rowId)} · ${width}%`} · {minH}px</span>
                            <button className="context-btn" onClick={(e) => { e.stopPropagation(); openContextMenu(e, block.id); }} title="Menu">⋯</button>
                          </div>
                        )}
                        {renderTypedBlock(block, (field, value) => {
                          patchSelectedBlock((current) => ({ ...current, data: { ...(current.data as Record<string, unknown>), [field]: value } }));
                        })}
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
            ))}

            {paintMode && (
              <svg className="paint-overlay" viewBox="0 0 1200 1200" preserveAspectRatio="none">
                <polyline points={paintPath.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2b6dff" strokeWidth="3" />
              </svg>
            )}
          </div>

          {paintOpen && (
            <div className="paint-prompt">
              <label>Paint Instruction</label>
              <input value={paintPrompt} onChange={(e) => setPaintPrompt(e.target.value)} placeholder="make heading bigger" />
              <button onClick={() => void applyPaintFix()}>Apply</button>
              <button onClick={() => { setPaintOpen(false); setPaintPath([]); }}>Cancel</button>
            </div>
          )}
        </main>

        <aside className="right-drawer">
          <div className="tabs">
            <button onClick={() => setRightTab("properties")} className={rightTab === "properties" ? "selected" : ""}>Properties</button>
            <button onClick={() => { setRightTab("properties"); setPropertiesTab("resize"); }} className={rightTab === "properties" && propertiesTab === "resize" ? "selected" : ""}>Resize</button>
            <button onClick={() => setRightTab("ai")} className={rightTab === "ai" ? "selected" : ""}>AI Chat</button>
            <button onClick={() => setRightTab("status")} className={rightTab === "status" ? "selected" : ""}>Debug</button>
          </div>

          {rightTab === "properties" && selectedBlock && (
            <div className="panel">
              <h3>Block Fields</h3>
              <div className="button-row">
                <button className={propertiesTab === "fields" ? "selected" : ""} onClick={() => setPropertiesTab("fields")}>Fields</button>
                <button className={propertiesTab === "resize" ? "selected" : ""} onClick={() => setPropertiesTab("resize")}>Resize</button>
              </div>
              <p className="panel-status">
                <strong>Properties debug:</strong> {selectedBlock.type} · {selectedBlock.id}
              </p>

              {propertiesTab === "fields" && <>
              {/* Block-specific fields */}
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
            </div>
          )}

          {rightTab === "ai" && (
            <div className="panel">
              <h3>AI Chat</h3>
              <p className="panel-status">
                <strong>AI panel:</strong> block {selectedBlock?.type || "none"} · {selectedBlock?.id || "none"}
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
              <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} rows={4} placeholder="Ask AI to improve copy or layout" />
              <button onClick={() => void chat()}>Send</button>

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
              <button onClick={() => void generateImage()}>Generate image for this block ({blockTypeForTarget(selectedBlock)})</button>
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
                  {uploadedImages.length === 0 ? <option value="">No uploaded images</option> : uploadedImages.map((img) => <option key={img} value={img}>{img}</option>)}
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
              <button onClick={() => void applyPhotoEdit()} disabled={uploadingImage}>{uploadingImage ? "Uploading..." : "Apply photo edit"}</button>
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
              <p><strong>Last action:</strong> {lastAction}</p>
              {drag && <p><strong>Drag:</strong> {drag.blockId.slice(0, 12)} {drag.startIndex}→{drag.currentIndex}</p>}
              {themeApplied && <p><strong>Theme:</strong> {themeApplied}</p>}
              <p><strong>Publish:</strong> dry-run (live disabled)</p>

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
        </aside>
      </div>

      {/* Context Menu */}
      {contextMenu?.visible && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => { setSelectedBlockId(contextMenu.blockId); setRightTab("properties"); setContextMenu(null); }}>Edit Properties</button>
          <button onClick={() => { openResizeLayoutForBlock(contextMenu.blockId); setContextMenu(null); }}>Resize/Layout</button>
          <button onClick={() => { startNewRow(contextMenu.blockId); setContextMenu(null); }}>Start new row</button>
          <button onClick={() => { placeWithPrevious(contextMenu.blockId); setContextMenu(null); }}>Place with block above</button>
          <button onClick={() => { placeWithNext(contextMenu.blockId); setContextMenu(null); }}>Place with block below</button>
          <button onClick={() => { removeFromRow(contextMenu.blockId); setContextMenu(null); }}>Remove from row</button>
          <button onClick={() => { resetBlockColorsToTheme(contextMenu.blockId); setContextMenu(null); }}>Reset block colors to theme</button>
          <button onClick={() => { applyThemeToAllBlocks(); setContextMenu(null); }}>Apply theme to all blocks</button>
          <button onClick={() => { duplicateBlock(contextMenu.blockId); setContextMenu(null); }}>Duplicate</button>
          <button onClick={() => { deleteBlock(contextMenu.blockId); }}>Delete</button>
          <button onClick={() => { moveBlock("up", contextMenu.blockId); }}>Move Up</button>
          <button onClick={() => { moveBlock("down", contextMenu.blockId); }}>Move Down</button>
          <button onClick={() => { setSelectedBlockId(contextMenu.blockId); setRightTab("ai"); setContextMenu(null); }}>AI Edit</button>
          <button onClick={() => { setSelectedBlockId(contextMenu.blockId); setRightTab("ai"); setContextMenu(null); }}>Generate Image</button>
          <button onClick={() => { setSelectedBlockId(contextMenu.blockId); setRightTab("ai"); setContextMenu(null); }}>Edit Photo</button>
          <button onClick={() => {
            const block = selectedPage.blocks.find((b) => b.id === contextMenu.blockId);
            if (block) navigator.clipboard?.writeText(JSON.stringify(block, null, 2));
            setContextMenu(null);
          }}>Copy Block JSON</button>
          <button onClick={() => setContextMenu(null)}>Close</button>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal settings-modal">
            <h3>Settings</h3>
            <div className="tabs">
              <button className={settingsTab === "general" ? "selected" : ""} onClick={() => setSettingsTab("general")}>General</button>
              <button className={settingsTab === "providers" ? "selected" : ""} onClick={() => setSettingsTab("providers")}>AI Providers</button>
              <button className={settingsTab === "keys" ? "selected" : ""} onClick={() => setSettingsTab("keys")}>Image/API Keys</button>
              <button className={settingsTab === "deploy" ? "selected" : ""} onClick={() => setSettingsTab("deploy")}>Deploy Safety</button>
              <button className={settingsTab === "debug" ? "selected" : ""} onClick={() => setSettingsTab("debug")}>Debug</button>
            </div>
            {settingsTab === "general" && <p className="panel-status">Use tabs to configure providers, keys, and deploy safety.</p>}
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
              <p><strong>Version:</strong> 0.1.0</p>
              <p><strong>Selected block:</strong> {selectedBlock?.id || "none"} ({selectedBlock?.type || "none"})</p>
              <p><strong>Theme:</strong> {themeApplied || "custom"}</p>
              <p><strong>Last API status:</strong> {status}</p>
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
    </div>
  );
}
