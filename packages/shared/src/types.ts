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

export interface BlockStyles {
  backgroundColor?: string;
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

export interface DividerBlockData {
  style?: "solid" | "dashed";
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
  };
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
