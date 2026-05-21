import { useEffect, useMemo, useState } from "react";
import {
  Block,
  BlockType,
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
  DividerBlockData,
  HtmlBlockData,
  BlockEffect
} from "@sbuild/shared";

type DeviceMode = "desktop" | "tablet" | "phone";
type RightTab = "properties" | "ai" | "status";

type ChatItem = { role: "user" | "assistant"; text: string };

type PaintPoint = { x: number; y: number };

const BLOCK_TYPES: BlockType[] = [
  "hero",
  "text",
  "image",
  "cards",
  "hours",
  "gallery",
  "contact",
  "testimonial",
  "map",
  "marquee",
  "spacer",
  "divider",
  "html"
];

const EFFECTS: BlockEffect[] = ["glow", "marquee", "fade-in", "gradient-text", "parallax", "pulse", "hover-grow"];

const themePresets = [
  {
    name: "Harvest",
    bg: "#f6f3e9",
    surface: "#fffef9",
    text: "#1f2a24",
    accent: "#2f6b3f",
    muted: "#6f7f73"
  },
  {
    name: "Ocean",
    bg: "#eef6fb",
    surface: "#ffffff",
    text: "#1b2f3b",
    accent: "#1a7ba8",
    muted: "#5f7380"
  },
  {
    name: "Sunset",
    bg: "#fff1e8",
    surface: "#fffaf4",
    text: "#3a241f",
    accent: "#cc5f2f",
    muted: "#8b6b60"
  }
];

function apiBase(): string {
  return "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  return (await res.json()) as T;
}

function blockStyleToCss(block: Block): Record<string, string | number> {
  const s = block.styles || {};
  const css: Record<string, string | number> = {
    background: s.backgroundColor || "#fff",
    backgroundImage: s.backgroundImage ? `url(${s.backgroundImage})` : "",
    backgroundSize: s.backgroundSize === "contain" ? "contain" : s.backgroundSize === "fill" ? "100% 100%" : "cover",
    backgroundRepeat: s.backgroundImage ? "no-repeat" : "",
    backgroundPosition: s.backgroundPosition || "center",
    color: s.textColor || "inherit",
    fontFamily: s.fontFamily ? `'${s.fontFamily}', sans-serif` : "inherit",
    fontSize: s.fontSize ? `${s.fontSize}px` : "",
    fontWeight: s.fontWeight || "",
    textAlign: s.textAlign || "left",
    padding: `${s.padding ?? 16}px`,
    margin: `${s.margin ?? 8}px 0`,
    borderRadius: `${s.borderRadius ?? 12}px`,
    boxShadow: s.shadow || ""
  };

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
    case "hero":
      return { ...base, data: { heading: "New Hero", subheading: "Tell your story", ctaLabel: "Learn More", ctaHref: "#" } };
    case "text":
      return { ...base, data: { title: "New Section", body: "Add your text here." } };
    case "image":
      return { ...base, data: { src: "", alt: "Image", caption: "" } };
    case "cards":
      return {
        ...base,
        data: {
          title: "Cards",
          cards: [
            { id: "c1", title: "Card 1", body: "Description" },
            { id: "c2", title: "Card 2", body: "Description" }
          ]
        }
      };
    case "hours":
      return { ...base, data: { title: "Hours", rows: [{ day: "Mon", open: "9:00", close: "17:00" }] } };
    case "gallery":
      return { ...base, data: { title: "Gallery", images: [{ id: "g1", src: "", alt: "Image" }] } };
    case "contact":
      return { ...base, data: { title: "Contact", phone: "", email: "", address: "" } };
    case "testimonial":
      return { ...base, data: { quote: "Great service!", author: "Happy Customer" } };
    case "map":
      return { ...base, data: { address: "Address", embedUrl: "" } };
    case "marquee":
      return { ...base, data: { text: "Scrolling highlight text" } };
    case "spacer":
      return { ...base, data: { height: 36 } };
    case "divider":
      return { ...base, data: { style: "solid" } };
    case "html":
      return { ...base, data: { html: "<p>Custom HTML</p>" } };
    default:
      return { ...base, data: { body: "Unknown block" } as TextBlockData };
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
  return (
    <section>
      {data.src ? <img src={data.src} alt={data.alt} className="block-image" /> : <div className="image-placeholder">Image Placeholder</div>}
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
  return (
    <section>
      <h2>{data.title}</h2>
      <div className="gallery-grid">
        {data.images.map((img) => (
          <figure key={img.id}>{img.src ? <img src={img.src} alt={img.alt} className="block-image" /> : <div className="image-placeholder">Gallery Image</div>}</figure>
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
      <blockquote>“{data.quote}”</blockquote>
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
  return <hr style={{ borderStyle: data.style || "solid" }} />;
};

const HtmlBlock = ({ block }: { block: Block }) => {
  const data = block.data as HtmlBlockData;
  return <section dangerouslySetInnerHTML={{ __html: data.html }} />;
};

function renderTypedBlock(block: Block, onText: (field: string, value: string) => void): JSX.Element {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} onText={onText} />;
    case "text":
      return <TextBlock block={block} onText={onText} />;
    case "image":
      return <ImageBlock block={block} />;
    case "cards":
      return <CardsBlock block={block} />;
    case "hours":
      return <HoursBlock block={block} />;
    case "gallery":
      return <GalleryBlock block={block} />;
    case "contact":
      return <ContactBlock block={block} />;
    case "testimonial":
      return <TestimonialBlock block={block} />;
    case "map":
      return <MapBlock block={block} />;
    case "marquee":
      return <MarqueeBlock block={block} />;
    case "spacer":
      return <SpacerBlock block={block} />;
    case "divider":
      return <DividerBlock block={block} />;
    case "html":
      return <HtmlBlock block={block} />;
    default:
      return <div>Unknown block</div>;
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

  const selectedPage = useMemo(
    () => project?.pages.find((p) => p.id === selectedPageId) || project?.pages[0],
    [project, selectedPageId]
  );
  const selectedBlock = selectedPage?.blocks.find((b) => b.id === selectedBlockId) || selectedPage?.blocks[0];

  useEffect(() => {
    void loadProject();
    void loadFonts();
    void loadImages();
  }, []);

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
      setStatus("Project loaded");
    } catch (error) {
      setStatus(`Failed to load project: ${String(error)}`);
    }
  }

  async function loadFonts() {
    try {
      const data = await fetchJson<{ fonts: Array<{ family: string }> }>("/api/fonts");
      setFonts(data.fonts || []);
    } catch {
      setFonts([]);
    }
  }

  async function loadImages() {
    try {
      const data = await fetchJson<{ ok: boolean; images: string[] }>("/api/images");
      const next = data.images || [];
      setUploadedImages(next);
      if (!selectedUploadImage && next.length > 0) {
        setSelectedUploadImage(next[0]);
      }
    } catch {
      setUploadedImages([]);
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
    patchCurrentPage({
      ...selectedPage,
      blocks: updateBlock(selectedPage.blocks, selectedBlock.id, mutator)
    });
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
      patchSelectedBlock((b) => ({
        ...b,
        data: {
          ...(b.data as ImageBlockData),
          src: nextImage,
          alt: altText,
          caption: (b.data as ImageBlockData).caption || "AI image"
        }
      }));
      return;
    }

    if (selectedBlock?.type === "hero") {
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundImage: nextImage,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }
      }));
      return;
    }

    if (selectedBlock?.type === "gallery") {
      patchSelectedBlock((b) => {
        const data = b.data as GalleryBlockData;
        const existing = data.images.findIndex((img) => !img.src);
        const images = [...data.images];
        const next = { id: `g-${Date.now()}`, src: nextImage, alt: altText };
        if (existing >= 0) {
          images[existing] = next;
        } else {
          images.push(next);
        }
        return { ...b, data: { ...data, images } };
      });
      return;
    }

    if (selectedBlock?.type === "cards") {
      patchSelectedBlock((b) => ({
        ...b,
        styles: {
          ...(b.styles || {}),
          backgroundImage: nextImage,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }
      }));
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
    const data = await fetchJson<{ ok: boolean }>("/api/project", {
      method: "PUT",
      body: JSON.stringify({ project })
    });
    if (data.ok) {
      setDirty(false);
      setStatus("Saved");
      setLastAction("save");
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
    if (data.ok) {
      setStatus(data.dryRun ? `Dry-run publish complete → ${data.target}` : `Published → ${data.target}`);
      setLastAction("publish");
    }
  }

  async function chat() {
    if (!chatInput.trim()) return;
    const prompt = chatInput.trim();
    setChatHistory((h) => [...h, { role: "user", text: prompt }]);
    setChatInput("");
    const data = await fetchJson<{ response: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
    setChatHistory((h) => [...h, { role: "assistant", text: data.response }]);
  }

  async function quickRewrite(mode: "rewrite" | "shorten" | "lengthen" | "tone") {
    if (!selectedBlock) return;
    const prompt = `${mode.toUpperCase()} this content: ${JSON.stringify(selectedBlock.data)}`;
    setChatInput(prompt);
    await chat();
  }

  async function runWizard() {
    const data = await fetchJson<{ ok: boolean; project: SBuildProject }>("/api/ai/wizard", {
      method: "POST",
      body: JSON.stringify(wizardForm)
    });
    if (data.ok) {
      setProject(data.project);
      setDirty(true);
      setShowWizard(false);
      setStatus("Wizard applied");
      setLastAction("wizard");
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    setPhotoEditStatus("Uploading...");
    try {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("images", file));
      const response = await fetch("/api/images", { method: "POST", body });
      const data = (await response.json()) as { ok: boolean; uploads?: Array<{ url: string }> };
      if (!response.ok || !data.ok) {
        setPhotoEditStatus("Upload failed.");
        return;
      }
      const firstUrl = data.uploads?.[0]?.url;
      await loadImages();
      if (firstUrl) setSelectedUploadImage(firstUrl);
      setPhotoEditStatus("Upload complete.");
      setLastAction("upload-image");
    } catch (error) {
      setPhotoEditStatus(`Upload failed: ${String(error)}`);
    } finally {
      setUploadingImage(false);
    }
  }

  async function generateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt) {
      setImageStatus("Enter an image prompt first.");
      return;
    }

    const targetContext = currentTargetContext();
    setImageStatus("Generating image for selected block...");
    const data = await fetchJson<{
      ok: boolean;
      unavailable?: boolean;
      message?: string;
      imageUrl?: string;
      originalImageUrl?: string;
      warnings?: string[];
      sizeDecision?: ImageSizeDecision;
      error?: string;
    }>("/api/ai/image", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        targetContext,
        explicitSize: providerSizeOverride || undefined
      })
    });

    if (data.sizeDecision) {
      setImageSizeDecision(data.sizeDecision);
    }

    const nextImage = data.imageUrl || "";
    const warningText = (data.warnings || []).join(" ");
    if (!data.ok || !nextImage) {
      setImageStatus(data.message || data.error || "Image generation unavailable.");
      if (warningText) {
        setImageStatus((current) => `${current} ${warningText}`.trim());
      }
      return;
    }

    setLastGeneratedImage(nextImage);
    setImageStatus(`Image ready for ${targetContext.blockType}.${warningText ? ` ${warningText}` : ""}`);
    setLastAction("image-generate");
    applyImageToSelectedBlock(nextImage, prompt);
  }

  async function applyPhotoEdit() {
    if (!selectedUploadImage) {
      setPhotoEditStatus("Select an uploaded image first.");
      return;
    }
    const targetContext = currentTargetContext();
    const data = await fetchJson<{
      ok: boolean;
      unavailable?: boolean;
      message?: string;
      error?: string;
      editedImageUrl?: string;
      originalImageUrl?: string;
      sizeDecision?: ImageSizeDecision;
      warnings?: string[];
    }>("/api/images/edit", {
      method: "POST",
      body: JSON.stringify({
        imagePath: selectedUploadImage,
        instruction: photoEditInstruction,
        editType: photoEditType,
        targetContext
      })
    });

    if (data.sizeDecision) {
      setImageSizeDecision(data.sizeDecision);
    }

    if (!data.ok || !data.editedImageUrl) {
      setPhotoEditStatus(data.message || data.error || "Photo edit unavailable.");
      return;
    }

    setLastEditedImage(data.editedImageUrl);
    applyImageToSelectedBlock(data.editedImageUrl, `Edited photo (${photoEditType})`);
    await loadImages();
    setPhotoEditStatus(`Edited photo ready. ${(data.warnings || []).join(" ")}`.trim());
    setLastAction("photo-edit");
  }

  function duplicateBlock() {
    if (!selectedPage || !selectedBlock) return;
    const copy: Block = { ...selectedBlock, id: `${selectedBlock.id}-copy-${Math.random().toString(36).slice(2, 6)}` };
    patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, copy] });
    setSelectedBlockId(copy.id);
    setLastAction("duplicate-block");
  }

  function deleteBlock() {
    if (!selectedPage || !selectedBlock) return;
    const next = selectedPage.blocks.filter((b) => b.id !== selectedBlock.id);
    patchCurrentPage({ ...selectedPage, blocks: next });
    setSelectedBlockId(next[0]?.id || "");
    setLastAction("delete-block");
  }

  function moveBlock(direction: "up" | "down") {
    if (!selectedPage || !selectedBlock) return;
    const index = selectedPage.blocks.findIndex((b) => b.id === selectedBlock.id);
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= selectedPage.blocks.length) return;
    patchCurrentPage({ ...selectedPage, blocks: move(selectedPage.blocks, index, to) });
    setLastAction(`move-${direction}`);
  }

  function applyTheme(index: number) {
    if (!project) return;
    const theme = themePresets[index];
    setProject({
      ...project,
      globalStyles: {
        ...project.globalStyles,
        colors: {
          bg: theme.bg,
          surface: theme.surface,
          text: theme.text,
          accent: theme.accent,
          muted: theme.muted
        }
      }
    });
    setDirty(true);
    setLastAction(`theme-${theme.name}`);
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
      body: JSON.stringify({
        instruction: paintPrompt,
        pageId: selectedPage.id,
        bounds: { width: 0, height: 0 },
        points: paintPath,
        selectedBlockId,
        project
      })
    });
    if (data.ok) {
      setProject(data.project);
      setDirty(true);
      setStatus(`Paint fix applied: ${data.notes.join("; ")}`);
      setLastAction("paint-fix");
    }
    setPaintOpen(false);
    setPaintPrompt("");
    setPaintPath([]);
  }

  if (!project || !selectedPage) {
    return <div className="loading">Loading sBuild...</div>;
  }

  return (
    <div className={`app ${previewMode ? "preview" : "edit"}`}>
      <header className="topbar">
        <button>☰</button>
        <div className="logo">sBuild v2</div>
        <button onClick={() => setPreviewMode((v) => !v)}>{previewMode ? "Edit" : "Preview"}</button>
        <button onClick={() => setPaintMode((p) => !p)} className={paintMode ? "active" : ""}>Paint</button>
        <button onClick={() => setRightTab("ai")}>AI</button>
        <button onClick={() => setRightTab("status")}>Settings</button>
        <button onClick={() => void saveProject()}>Save</button>
        <button onClick={() => void runBuild()}>Build</button>
        <button onClick={() => void runPublish()}>Publish</button>
      </header>

      <div className="workspace">
        <aside className="left-drawer">
          <section>
            <h3>Pages</h3>
            {project.pages.map((page) => (
              <button key={page.id} className={page.id === selectedPage.id ? "selected" : ""} onClick={() => setSelectedPageId(page.id)}>
                {page.title}
              </button>
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
            <h3>Theme Presets</h3>
            {themePresets.map((t, i) => (
              <button key={t.name} onClick={() => applyTheme(i)}>{t.name}</button>
            ))}
          </section>
          <section>
            <h3>Fonts</h3>
            <input value={fontSearch} onChange={(e) => setFontSearch(e.target.value)} placeholder="Search fonts" />
            <div className="font-list">
              {filteredFonts.map((f) => (
                <button
                  key={f.family}
                  onClick={() => {
                    addRecentFont(f.family);
                    setProject({ ...project, globalStyles: { ...project.globalStyles, headingFont: f.family } });
                    setDirty(true);
                  }}
                >
                  {f.family}
                </button>
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
            <button onClick={duplicateBlock}>Duplicate</button>
            <button onClick={deleteBlock}>Delete</button>
            <button onClick={() => moveBlock("up")}>Up</button>
            <button onClick={() => moveBlock("down")}>Down</button>
          </div>

          <div
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

            {selectedPage.blocks.map((block) => (
              <div
                key={block.id}
                className={`block-shell ${block.id === selectedBlock?.id ? "selected-block" : ""}`}
                style={blockStyleToCss(block)}
                onClick={() => setSelectedBlockId(block.id)}
              >
                {!previewMode && <div className="block-meta">{block.type} · {block.id}</div>}
                {renderTypedBlock(block, (field, value) => {
                  patchSelectedBlock((current) => ({ ...current, data: { ...(current.data as Record<string, unknown>), [field]: value } }));
                })}
              </div>
            ))}

            {paintMode && (
              <svg className="paint-overlay" viewBox="0 0 1200 1200" preserveAspectRatio="none">
                <polyline
                  points={paintPath.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#2b6dff"
                  strokeWidth="3"
                />
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
            <button onClick={() => setRightTab("ai")} className={rightTab === "ai" ? "selected" : ""}>AI Chat</button>
            <button onClick={() => setRightTab("status")} className={rightTab === "status" ? "selected" : ""}>Debug</button>
          </div>

          {rightTab === "properties" && selectedBlock && (
            <div className="panel">
              <h3>Block Styles</h3>
              <label>Background <input type="color" value={selectedBlock.styles?.backgroundColor || "#ffffff"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundColor: e.target.value } }))} /></label>
              <label>Text Color <input type="color" value={selectedBlock.styles?.textColor || "#222222"} onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), textColor: e.target.value } }))} /></label>
              <label>Font Family
                <input
                  value={selectedBlock.styles?.fontFamily || ""}
                  onChange={(e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontFamily: e.target.value } }))}
                  placeholder="e.g. Poppins"
                />
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

              <h4>Effects</h4>
              <div className="effect-list">
                {EFFECTS.map((effect) => {
                  const has = (selectedBlock.styles?.effects || []).includes(effect);
                  return (
                    <label key={effect}>
                      <input
                        type="checkbox"
                        checked={has}
                        onChange={(e) => {
                          const current = new Set(selectedBlock.styles?.effects || []);
                          if (e.target.checked) current.add(effect);
                          else current.delete(effect);
                          patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), effects: [...current] } }));
                        }}
                      />
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
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                  placeholder="e.g. aerial view of a catfish farm at golden hour"
                />
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
              <button onClick={() => void generateImage()}>
                Generate image for this block ({blockTypeForTarget(selectedBlock)})
              </button>
              {imageStatus && <p><strong>Image status:</strong> {imageStatus}</p>}
              {imageSizeDecision && (
                <div className="image-debug">
                  <p><strong>Target block:</strong> {blockTypeForTarget(selectedBlock)}</p>
                  <p><strong>Provider size:</strong> {imageSizeDecision.providerSize}</p>
                  <p><strong>Final output:</strong> {imageSizeDecision.outputWidth} x {imageSizeDecision.outputHeight}</p>
                  <p><strong>Crop mode:</strong> {imageSizeDecision.cropMode}</p>
                  {imageSizeDecision.warnings.length > 0 && (
                    <p><strong>Warnings:</strong> {imageSizeDecision.warnings.join(" | ")}</p>
                  )}
                </div>
              )}
              {lastGeneratedImage && (
                <img src={lastGeneratedImage} alt="Last generated" className="block-image" />
              )}

              <h3>Edit Uploaded Photo</h3>
              <label>
                Upload source photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void uploadImages(e.target.files)}
                />
              </label>
              <label>
                Source uploaded image
                <select value={selectedUploadImage} onChange={(e) => setSelectedUploadImage(e.target.value)}>
                  {uploadedImages.length === 0 ? (
                    <option value="">No uploaded images</option>
                  ) : (
                    uploadedImages.map((img) => <option key={img} value={img}>{img}</option>)
                  )}
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
                <textarea
                  value={photoEditInstruction}
                  onChange={(e) => setPhotoEditInstruction(e.target.value)}
                  rows={3}
                  placeholder="Optional instruction for edit."
                />
              </label>
              <button onClick={() => void applyPhotoEdit()} disabled={uploadingImage}>
                {uploadingImage ? "Uploading..." : "Apply photo edit"}
              </button>
              {photoEditStatus && <p><strong>Photo edit status:</strong> {photoEditStatus}</p>}
              {lastEditedImage && <img src={lastEditedImage} alt="Last edited" className="block-image" />}
            </div>
          )}

          {rightTab === "status" && (
            <div className="panel">
              <h3>Status</h3>
              <p><strong>API:</strong> {status}</p>
              <p><strong>Selected Block:</strong> {selectedBlock?.id || "none"}</p>
              <p><strong>Dirty:</strong> {dirty ? "yes" : "no"}</p>
              <p><strong>Last action:</strong> {lastAction}</p>

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
                <select
                  value={project.deploy.method}
                  onChange={(e) => {
                    setProject({ ...project, deploy: { ...project.deploy, method: e.target.value as SBuildProject["deploy"]["method"] } });
                    setDirty(true);
                  }}
                >
                  <option value="dry-run">dry-run</option>
                  <option value="local-web-root">local-web-root</option>
                  <option value="git">git</option>
                </select>
              </label>
              <label>Web Root
                <input
                  value={project.deploy.webRoot}
                  onChange={(e) => {
                    setProject({ ...project, deploy: { ...project.deploy, webRoot: e.target.value } });
                    setDirty(true);
                  }}
                />
              </label>
              <label>GitHub Repo URL
                <input
                  value={project.deploy.githubRepo || ""}
                  onChange={(e) => {
                    setProject({ ...project, deploy: { ...project.deploy, githubRepo: e.target.value } });
                    setDirty(true);
                  }}
                  placeholder="https://github.com/org/repo"
                />
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
