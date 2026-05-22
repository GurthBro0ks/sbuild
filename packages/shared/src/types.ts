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

export interface SBuildAISettings {
  provider: "mock" | "opencode" | "openai";
  model: string;
}

export interface SBuildProviderStatus {
  name: string;
  status: "connected" | "not_configured" | "unknown" | "error";
  message?: string;
}

export interface SBuildSecretConfig {
  openCodePath?: string;
  openCodeDetected?: boolean;
  imageGenApiKey?: string;
  imageAnalyzeApiKey?: string;
  imageGenKeySource?: "env" | "local" | "missing";
  imageAnalyzeKeySource?: "env" | "local" | "missing";
}

export interface SBuildDeploySettings {
  method: "dry-run" | "local-web-root" | "git";
  webRoot: string;
  githubRepo?: string;
}

export interface SBuildProject {
  version: string;
  updatedAt: string;
  site: SBuildSiteSettings;
  globalStyles: SBuildGlobalStyles;
  ai: SBuildAISettings;
  deploy: SBuildDeploySettings;
  pages: SBuildPage[];
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
