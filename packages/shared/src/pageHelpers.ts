import { Block, SBuildPage, SBuildNavItem } from "./types.js";

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/${base || "untitled"}`;
}

export function getUniqueSlug(slug: string, existingPages: SBuildPage[], excludeId?: string): string {
  const slugs = new Set(existingPages.filter((p) => p.id !== excludeId).map((p) => p.slug));
  if (!slugs.has(slug)) return slug;
  let i = 2;
  while (slugs.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export function createPage(title: string, existingPages: SBuildPage[], opts?: { parentId?: string; showInNav?: boolean; template?: string; blocks?: Block[] }): SBuildPage {
  const rawSlug = generateSlug(title);
  const slug = getUniqueSlug(rawSlug === "/" ? rawSlug : rawSlug, existingPages);
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slug,
    title,
    blocks: opts?.blocks || [],
    parentId: opts?.parentId || undefined,
    showInNav: opts?.showInNav !== undefined ? opts.showInNav : true,
    order: existingPages.length,
    template: opts?.template || "blank",
  };
}

export function duplicatePage(page: SBuildPage, existingPages: SBuildPage[]): SBuildPage {
  const title = `${page.title} (copy)`;
  const rawSlug = generateSlug(title);
  const slug = getUniqueSlug(rawSlug, existingPages, page.id);
  return {
    ...page,
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    slug,
    order: existingPages.length,
    blocks: page.blocks.map((b) => ({ ...b, id: `${b.id}-copy-${Date.now()}` })),
    template: "copy",
  };
}

export function deletePage(pages: SBuildPage[], pageId: string): { pages: SBuildPage[]; fallbackId: string | null } {
  if (pages.length <= 1) return { pages, fallbackId: pages[0]?.id || null };
  const filtered = pages.filter((p) => p.id !== pageId);
  const fallbackId = filtered[0]?.id || null;
  return { pages: filtered, fallbackId };
}

export function renamePage(page: SBuildPage, newTitle: string): SBuildPage {
  return { ...page, title: newTitle };
}

export function updatePageSlug(page: SBuildPage, newSlug: string, existingPages: SBuildPage[]): SBuildPage {
  const cleaned = newSlug.startsWith("/") ? newSlug : `/${newSlug}`;
  const slug = getUniqueSlug(cleaned, existingPages, page.id);
  return { ...page, slug };
}

export function buildNavItems(pages: SBuildPage[]): SBuildNavItem[] {
  return pages
    .filter((p) => p.showInNav !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((p) => ({
      id: `nav-${p.id}`,
      label: p.title,
      href: p.slug,
    }));
}

export function migrateLegacyProject(pages: SBuildPage[] | undefined): SBuildPage[] {
  if (!pages || pages.length === 0) {
    return [
      {
        id: "page-home",
        slug: "/",
        title: "Home",
        blocks: [],
        showInNav: true,
        order: 0,
        template: "blank",
      },
    ];
  }
  return pages;
}

export const STARTER_TEMPLATES: Array<{ id: string; label: string; description: string }> = [
  { id: "blank", label: "Blank page", description: "Start with an empty page." },
  { id: "copy", label: "Copy current page", description: "Duplicate the current page's blocks." },
  { id: "hero-text", label: "Simple page", description: "Hero section + text block." },
  { id: "contact", label: "Contact page", description: "Contact form layout." },
  { id: "gallery", label: "Gallery page", description: "Image gallery layout." },
];

export function getStarterBlocks(templateId: string, currentPageBlocks: Block[]): Block[] {
  switch (templateId) {
    case "copy":
      return currentPageBlocks.map((b) => ({ ...b, id: `${b.id}-tpl-${Date.now()}` }));
    case "hero-text":
      return [
        { id: `tpl-hero-${Date.now()}`, type: "hero", data: { heading: "Page Title", subheading: "Add a subtitle here.", ctaLabel: "Learn More", ctaHref: "#" } },
        { id: `tpl-text-${Date.now()}`, type: "text", data: { title: "Section Heading", body: "Add your content here." } },
      ];
    case "contact":
      return [
        { id: `tpl-contact-${Date.now()}`, type: "contact", data: { title: "Get in Touch", phone: "", email: "", address: "" } },
      ];
    case "gallery":
      return [
        { id: `tpl-gallery-${Date.now()}`, type: "gallery", data: { title: "Gallery", images: [] } },
      ];
    default:
      return [];
  }
}
