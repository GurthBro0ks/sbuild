export type BlockType =
  | "hero"
  | "text"
  | "image"
  | "cards"
  | "hours"
  | "gallery"
  | "contact"
  | "testimonial"
  | "map"
  | "marquee"
  | "spacer"
  | "divider"
  | "html";

export type BlockEffect =
  | "glow"
  | "marquee"
  | "fade-in"
  | "gradient-text"
  | "parallax"
  | "pulse"
  | "hover-grow";

export interface BlockLayout {
  rowId?: string;
  columnSpan?: number;
  widthMode?: "full" | "wide" | "medium" | "narrow" | "custom";
  widthPercent?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  heightMode?: "auto" | "fixed" | "aspect";
  heightPx?: number;
  aspectRatio?: string;
  alignSelf?: "left" | "center" | "right" | "stretch";
}

export type BackgroundStylePreset = "clean" | "glass" | "neon" | "soft" | "bold" | "terminal" | "image-overlay";
export type BorderStylePreset = "none" | "thin" | "accent" | "double" | "dashed" | "glow-edge";
export type ShadowStylePreset = "none" | "soft" | "lifted" | "strong" | "neon" | "inner";
export type TextEffectPreset = "none" | "subtle-glow" | "strong-glow" | "outline" | "shadow";
export type ButtonStylePreset = "solid" | "outline" | "ghost" | "pill" | "glow";

export interface PartStyle {
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  padding?: number;
  margin?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shadow?: string;
  opacity?: number;
  backgroundImage?: string;
  backgroundFit?: "cover" | "contain" | "fill" | "repeat";
  backgroundStyle?: BackgroundStylePreset;
  borderStyle?: BorderStylePreset;
  shadowStyle?: ShadowStylePreset;
  textEffect?: TextEffectPreset;
  buttonStyle?: ButtonStylePreset;
  gradientType?: "linear" | "radial" | "conic";
  gradientColors?: string[];
  gradientDirection?: string;
}

export interface BlockPartStyles {
  container?: PartStyle;
  heading?: PartStyle;
  body?: PartStyle;
  button?: PartStyle;
  card?: PartStyle;
  cardHeading?: PartStyle;
  cardBody?: PartStyle;
  nav?: PartStyle;
  image?: PartStyle;
}

export interface BlockStyles {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: "cover" | "contain" | "fill";
  backgroundPosition?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  padding?: number;
  margin?: number;
  borderRadius?: number;
  shadow?: string;
  effects?: BlockEffect[];
  layout?: BlockLayout;
  parts?: BlockPartStyles;
  backgroundStyle?: BackgroundStylePreset;
  borderStyle?: BorderStylePreset;
  shadowStyle?: ShadowStylePreset;
  textEffect?: TextEffectPreset;
  buttonStyle?: ButtonStylePreset;
}

export interface SBuildNavItem {
  id: string;
  label: string;
  href: string;
}

export interface HeroBlockData {
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface TextBlockData {
  title?: string;
  body: string;
}

export interface ImageBlockData {
  src: string;
  alt: string;
  caption?: string;
}

export interface CardsBlockData {
  title?: string;
  cards: Array<{ id: string; title: string; body: string }>;
}

export interface HoursBlockData {
  title?: string;
  rows: Array<{ day: string; open: string; close: string }>;
}

export interface GalleryBlockData {
  title?: string;
  images: Array<{ id: string; src: string; alt: string }>;
}

export interface ContactBlockData {
  title?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface TestimonialBlockData {
  quote: string;
  author: string;
}

export interface MapBlockData {
  embedUrl?: string;
  address?: string;
}

export interface MarqueeBlockData {
  text: string;
}

export interface SpacerBlockData {
  height: number;
}

export type DividerStyle = "solid" | "dashed" | "dotted" | "double" | "gradient" | "glow" | "zigzag" | "wave" | "spacer-line";

export interface DividerBlockData {
  style?: DividerStyle;
  thickness?: number;
  color?: string;
  widthPercent?: number;
  alignment?: "left" | "center" | "right";
  marginTop?: number;
  marginBottom?: number;
  label?: string;
  glowIntensity?: number;
}

export interface HtmlBlockData {
  html: string;
}

export type BlockData =
  | HeroBlockData
  | TextBlockData
  | ImageBlockData
  | CardsBlockData
  | HoursBlockData
  | GalleryBlockData
  | ContactBlockData
  | TestimonialBlockData
  | MapBlockData
  | MarqueeBlockData
  | SpacerBlockData
  | DividerBlockData
  | HtmlBlockData;

export interface Block {
  id: string;
  type: BlockType;
  styles?: BlockStyles;
  data: BlockData;
}

export interface SBuildPage {
  id: string;
  slug: string;
  title: string;
  blocks: Block[];
  parentId?: string;
  showInNav?: boolean;
  order?: number;
  template?: string;
}

export interface SBuildGlobalStyles {
  headingFont: string;
  bodyFont: string;
  colors: {
    bg: string;
    surface: string;
    text: string;
    accent: string;
    muted: string;
    pageBackground?: string;
    canvasBackground?: string;
    navBackground?: string;
    blockBackground?: string;
    blockAltBackground?: string;
    cardBackground?: string;
    cardAltBackground?: string;
    headingColor?: string;
    bodyTextColor?: string;
    mutedTextColor?: string;
    accentColor?: string;
    buttonBackground?: string;
    buttonTextColor?: string;
    borderColor?: string;
    shadowColor?: string;
    linkColor?: string;
  };
}

export interface SBuildThemePreset {
  name: string;
  colors: {
    bg: string;
    surface: string;
    text: string;
    accent: string;
    muted: string;
    primary?: string;
    secondary?: string;
    nav?: string;
  };
  headingFont?: string;
  bodyFont?: string;
  buttonStyle?: "rounded" | "pill" | "square";
  isDark?: boolean;
}

export interface SBuildSiteSettings {
  siteName: string;
  domain?: string;
  title: string;
  description: string;
  nav: SBuildNavItem[];
}

export type AiChatProvider = "auto" | "local" | "openai" | "openrouter" | "disabled" | "ollama" | "openai-compatible";

export interface SBuildAISettings {
  provider: AiChatProvider;
  model: string;
  baseUrl?: string;
  providerMode?: "auto" | "local" | "openai" | "openrouter";
  localModel?: string;
  openaiModel?: string;
  openrouterModel?: string;
  fallbackEnabled?: boolean;
  fallbackTimeoutSec?: number;
}

export interface SBuildProviderStatus {
  name: string;
  status: "configured" | "unconfigured" | "reachable" | "unreachable" | "untested";
  message?: string;
  provider?: string;
  model?: string;
  keySource?: "env" | "local" | "missing";
  configured?: boolean;
  reachability?: "reachable" | "unreachable" | "untested";
  lastTest?: {
    ok: boolean;
    result: "passed" | "failed" | "unconfigured" | "untested";
    testedAt: string;
    latencyMs: number | null;
    errorCategory: string | null;
    message: string;
  };
}

export interface SBuildLocalModel {
  name: string;
  size?: number;
  modified?: string;
  parameterSize?: string;
}

export interface SBuildProviderDiscovery {
  ollama: {
    reachable: boolean;
    endpoint: string;
    models: SBuildLocalModel[];
    message: string;
  };
  openaiCompatible: {
    reachable: boolean;
    endpoint: string;
    models: SBuildLocalModel[];
    message: string;
  };
}

export interface SBuildSecretConfig {
  openCodePath?: string;
  openCodeDetected?: boolean;
  chatApiKey?: string;
  openaiChatApiKey?: string;
  openrouterChatApiKey?: string;
  chatKeySource?: "env" | "local" | "missing";
  imageGenApiKey?: string;
  imageAnalyzeApiKey?: string;
  imageGenKeySource?: "env" | "local" | "missing";
  imageAnalyzeKeySource?: "env" | "local" | "missing";
  chatProvider?: AiChatProvider;
  chatModel?: string;
  chatBaseUrl?: string;
  chatProviderMode?: "auto" | "local" | "openai" | "openrouter";
  chatLocalModel?: string;
  chatOpenAIModel?: string;
  chatOpenRouterModel?: string;
  chatFallbackEnabled?: boolean;
  chatFallbackTimeoutSec?: number;
}

export interface SBuildDeploySettings {
  method: "dry-run" | "local-web-root" | "git";
  webRoot: string;
  githubRepo?: string;
}

export type MarkupAnnotationType = "note";

export interface MarkupAnnotation {
  id: string;
  type: MarkupAnnotationType;
  pageId: string;
  blockId?: string;
  x: number;
  y: number;
  text: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarkupFreehandPoint {
  x: number;
  y: number;
}

export interface MarkupFreehandStroke {
  id: string;
  pageId: string;
  blockId?: string;
  points: MarkupFreehandPoint[];
  color: string;
  size: number;
  opacity?: number;
  createdAt?: string;
}

export interface SBuildProject {
  version: string;
  updatedAt: string;
  site: SBuildSiteSettings;
  globalStyles: SBuildGlobalStyles;
  ai: SBuildAISettings;
  deploy: SBuildDeploySettings;
  markupAnnotations?: MarkupAnnotation[];
  markupFreehandStrokes?: MarkupFreehandStroke[];
  pages: SBuildPage[];
  selectedTheme?: string;
}

export type ImageTargetBlockType =
  | "hero"
  | "image"
  | "gallery"
  | "card"
  | "testimonial"
  | "navLogo"
  | "favicon"
  | "background"
  | "unknown";

export type ImageTargetUsage =
  | "heroBackground"
  | "inlineImage"
  | "galleryItem"
  | "cardImage"
  | "logo"
  | "favicon"
  | "socialOg"
  | "custom";

export type ViewportHint = "desktop" | "tablet" | "mobile";
export type CropMode = "cover" | "contain" | "fill";
export type OpenAIImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface ImageTargetContext {
  blockType: ImageTargetBlockType;
  usage: ImageTargetUsage;
  viewportHint?: ViewportHint;
  aspectRatioHint?: string;
  currentBlockId?: string;
  currentImagePath?: string;
  cropMode?: CropMode;
  imageSlot?: number;
}

export interface ImageSizeDecision {
  providerSize: OpenAIImageSize;
  desiredAspectRatio: string;
  outputWidth: number;
  outputHeight: number;
  cropMode: CropMode;
  reason: string;
  warnings: string[];
}

export type ImageGenStyle =
  | "photorealistic"
  | "website-hero"
  | "product-shot"
  | "cartoon"
  | "watercolor"
  | "minimal-flat"
  | "cinematic"
  | "background-texture"
  | "custom";

export type ImageGenAspect =
  | "square"
  | "landscape"
  | "wide"
  | "hero-wide"
  | "portrait"
  | "fit-block"
  | "custom";

export type ImageGenPlacement =
  | "block-background"
  | "selected-image"
  | "fit-block"
  | "fill-block"
  | "add-to-gallery"
  | "save-library";

export interface ImageGenStylePreset {
  id: ImageGenStyle;
  label: string;
  promptSuffix: string;
}

export interface ImageGenSizePreset {
  id: ImageGenAspect;
  label: string;
  aspectRatio: string;
  providerSize: OpenAIImageSize;
}

export const IMAGE_GEN_STYLE_PRESETS: ImageGenStylePreset[] = [
  { id: "photorealistic", label: "Photorealistic", promptSuffix: "Photorealistic, high detail, professional photography" },
  { id: "website-hero", label: "Website Hero Banner", promptSuffix: "Website hero banner, wide composition, professional" },
  { id: "product-shot", label: "Product Shot", promptSuffix: "Product photography, clean background, commercial" },
  { id: "cartoon", label: "Cartoon", promptSuffix: "Cartoon style, vibrant colors, illustrative" },
  { id: "watercolor", label: "Watercolor", promptSuffix: "Watercolor painting, soft edges, artistic" },
  { id: "minimal-flat", label: "Minimal Flat Illustration", promptSuffix: "Minimal flat illustration, clean design, vector style" },
  { id: "cinematic", label: "Cinematic", promptSuffix: "Cinematic, dramatic lighting, movie still" },
  { id: "background-texture", label: "Background Texture", promptSuffix: "Background texture, seamless, tileable pattern" },
  { id: "custom", label: "Custom", promptSuffix: "" },
];

export const IMAGE_GEN_SIZE_PRESETS: ImageGenSizePreset[] = [
  { id: "square", label: "Square 1:1", aspectRatio: "1:1", providerSize: "1024x1024" },
  { id: "landscape", label: "Landscape 4:3", aspectRatio: "4:3", providerSize: "1024x1024" },
  { id: "wide", label: "Wide 16:9", aspectRatio: "16:9", providerSize: "1536x1024" },
  { id: "hero-wide", label: "Hero Wide 21:9", aspectRatio: "21:9", providerSize: "1536x1024" },
  { id: "portrait", label: "Portrait 4:5", aspectRatio: "4:5", providerSize: "1024x1024" },
  { id: "fit-block", label: "Fit Selected Block", aspectRatio: "auto", providerSize: "1024x1024" },
  { id: "custom", label: "Custom", aspectRatio: "custom", providerSize: "1024x1024" },
];
