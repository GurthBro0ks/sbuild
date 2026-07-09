import fs from "node:fs/promises";
import path from "node:path";
import { Block, SBuildProject } from "@sbuild/shared";
import { distDir, projectImagesDir } from "../lib/paths.js";

type GeneratedPage = SBuildProject["pages"][number];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function styleClassForBlock(block: Block): string {
  return `block-${block.id}`;
}

function siteBaseUrl(project: SBuildProject): string {
  const rawDomain = String(project.site.domain || "example.com").trim();
  const stripped = rawDomain.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  return `https://${stripped || "example.com"}`;
}

function safeRouteSegments(page: GeneratedPage, index: number): string[] {
  const raw = String(page.slug || (index === 0 ? "/" : `/${page.id || `page-${index + 1}`}`)).trim();
  const pathOnly = (raw.split(/[?#]/)[0] || "/").replace(/^https?:\/\/[^/]+/i, "");
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const normalized = path.posix.normalize(withLeadingSlash);
  if (normalized === "/" || normalized === ".") return [];
  return normalized
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[^A-Za-z0-9._~-]/g, "-") || "page");
}

function routePathForPage(page: GeneratedPage, index: number): string {
  const segments = safeRouteSegments(page, index);
  if (segments.length === 0) return "/";
  return `/${segments.join("/")}/`;
}

function outputRelativePathForPage(page: GeneratedPage, index: number): string {
  const segments = safeRouteSegments(page, index);
  if (segments.length === 0) return "index.html";
  return path.join(...segments, "index.html");
}

function generatedPages(project: SBuildProject): GeneratedPage[] {
  return project.pages.length ? project.pages : [
    {
      id: "home",
      slug: "/",
      title: project.site.title || project.site.siteName || "Home",
      blocks: []
    }
  ];
}

function canonicalUrlForPage(project: SBuildProject, page: GeneratedPage, index: number): string {
  return `${siteBaseUrl(project)}${routePathForPage(page, index)}`;
}

function titleForPage(project: SBuildProject, page: GeneratedPage, index: number): string {
  const siteTitle = project.site.title || project.site.siteName || "Untitled Site";
  if (routePathForPage(page, index) === "/") return siteTitle;
  const pageTitle = page.title || siteTitle;
  return project.site.siteName && pageTitle !== project.site.siteName
    ? `${pageTitle} | ${project.site.siteName}`
    : pageTitle;
}

const backgroundStylePresets: Record<string, string[]> = {
  clean: [],
  glass: [
    "backdrop-filter:blur(12px);",
    "-webkit-backdrop-filter:blur(12px);",
    "background:rgba(255,255,255,0.08);",
    "border:1px solid rgba(255,255,255,0.15);"
  ],
  neon: [
    "box-shadow:0 0 20px rgba(0,255,170,0.35), inset 0 0 10px rgba(0,255,170,0.1);",
    "border:1px solid rgba(0,255,170,0.4);"
  ],
  soft: [
    "box-shadow:0 8px 32px rgba(0,0,0,0.08);",
    "border-radius:16px;",
    "border:1px solid rgba(0,0,0,0.04);"
  ],
  bold: [
    "box-shadow:0 12px 40px rgba(0,0,0,0.18);",
    "border-radius:8px;",
    "border:2px solid var(--accent);"
  ],
  terminal: [
    "background:#0c0c0c;",
    "color:#33ff33;",
    "border:1px solid #3e5a3e;",
    "font-family:monospace;",
    "box-shadow:inset 0 0 20px rgba(51,255,51,0.05);"
  ],
  "image-overlay": [
    "background:linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.7));",
    "color:#ffffff;"
  ]
};

const borderStylePresets: Record<string, string> = {
  none: "border:none;",
  thin: "border:1px solid rgba(0,0,0,.08);",
  accent: "border:2px solid var(--accent);",
  double: "border:3px double rgba(0,0,0,.08);",
  dashed: "border:2px dashed rgba(0,0,0,.08);",
  "glow-edge": "border:1px solid rgba(0,255,170,0.5);"
};

// Mirrors editor SHADOW_STYLE_PRESETS (App.tsx) — keep values in sync with that table.
const shadowStylePresets: Record<string, string> = {
  none: "",
  soft: "box-shadow:0 4px 16px rgba(0,0,0,0.06);",
  lifted: "box-shadow:0 12px 24px rgba(0,0,0,0.12);",
  strong: "box-shadow:0 16px 48px rgba(0,0,0,0.22);",
  neon: "box-shadow:0 0 24px rgba(0,255,170,0.35), 0 0 8px rgba(0,255,170,0.2);",
  inner: "box-shadow:inset 0 2px 12px rgba(0,0,0,0.08);"
};

// Mirrors editor TEXT_EFFECT_PRESETS (App.tsx) — keep values in sync with that table.
const textEffectPresets: Record<string, string[]> = {
  none: [],
  "subtle-glow": ["text-shadow:0 0 8px rgba(255,255,255,0.35);"],
  "strong-glow": ["text-shadow:0 0 16px rgba(0,255,170,0.6);"],
  outline: ["-webkit-text-stroke:1px currentColor;", "color:transparent;"],
  shadow: ["text-shadow:2px 2px 4px rgba(0,0,0,0.35);"]
};

// Mirrors editor BUTTON_STYLE_PRESETS (App.tsx); var(--sbuild-accent) there maps to var(--accent) here.
const buttonStylePresets: Record<string, string[]> = {
  solid: ["background:var(--accent);", "color:#ffffff;", "border:none;"],
  outline: ["background:transparent;", "color:var(--accent);", "border:2px solid var(--accent);"],
  ghost: ["background:transparent;", "color:var(--accent);", "border:1px solid rgba(0,0,0,0.1);"],
  pill: ["background:var(--accent);", "color:#ffffff;", "border:none;", "border-radius:999px;"],
  glow: ["background:var(--accent);", "color:#ffffff;", "border:none;", "box-shadow:0 0 16px rgba(0,255,170,0.45);"]
};

export function renderBlock(block: Block): string {
  const idAttr = `id="${escapeHtml(block.id)}"`;
  const cls = `class="block ${styleClassForBlock(block)} type-${block.type}"`;
  const data = block.data as any;

  switch (block.type) {
    case "hero":
      return `<section ${idAttr} ${cls}><h1>${escapeHtml(data.heading || "")}</h1><p>${escapeHtml(data.subheading || "")}</p>${data.ctaLabel ? `<a class="btn" href="${escapeHtml(data.ctaHref || "#")}">${escapeHtml(data.ctaLabel)}</a>` : ""}</section>`;
    case "text":
      return `<section ${idAttr} ${cls}><h2>${escapeHtml(data.title || "")}</h2><p>${escapeHtml(data.body || "")}</p></section>`;
    case "image":
      return `<section ${idAttr} ${cls}><img src="${escapeHtml(data.src || "")}" alt="${escapeHtml(data.alt || "")}"/>${data.caption ? `<p>${escapeHtml(data.caption)}</p>` : ""}</section>`;
    case "cards":
      return `<section ${idAttr} ${cls}><h2>${escapeHtml(data.title || "")}</h2><div class="cards">${(data.cards || [])
        .map((card: any) => `<article><h3>${escapeHtml(card.title || "")}</h3><p>${escapeHtml(card.body || "")}</p></article>`)
        .join("")}</div></section>`;
    case "hours":
      return `<section ${idAttr} ${cls}><h2>${escapeHtml(data.title || "Hours")}</h2><ul>${(data.rows || [])
        .map((row: any) => `<li><strong>${escapeHtml(row.day || "")}</strong> ${escapeHtml(row.open || "")}-${escapeHtml(row.close || "")}</li>`)
        .join("")}</ul></section>`;
    case "gallery":
      return `<section ${idAttr} ${cls}><h2>${escapeHtml(data.title || "Gallery")}</h2><div class="gallery">${(data.images || [])
        .map(
          (img: any) =>
            `<figure><img src="${escapeHtml(img.src || "")}" alt="${escapeHtml(img.alt || "")}"/></figure>`
        )
        .join("")}</div></section>`;
    case "contact":
      return `<section ${idAttr} ${cls}><h2>${escapeHtml(data.title || "Contact")}</h2><p>${escapeHtml(data.phone || "")}</p><p>${escapeHtml(data.email || "")}</p><p>${escapeHtml(data.address || "")}</p></section>`;
    case "testimonial":
      return `<section ${idAttr} ${cls}><blockquote>“${escapeHtml(data.quote || "")}"</blockquote><cite>${escapeHtml(data.author || "")}</cite></section>`;
    case "map":
      return `<section ${idAttr} ${cls}><h2>Map</h2>${data.embedUrl ? `<iframe src="${escapeHtml(data.embedUrl)}"></iframe>` : `<p>${escapeHtml(data.address || "Map coming soon")}</p>`}</section>`;
    case "marquee":
      return `<section ${idAttr} ${cls}><div class="marquee-track">${escapeHtml(data.text || "")}</div></section>`;
    case "spacer":
      return `<section ${idAttr} ${cls} style="height:${Number(data.height || 24)}px"></section>`;
    case "divider":
      return `<hr ${idAttr} ${cls} />`;
    case "html":
      return `<section ${idAttr} ${cls}>${data.html || ""}</section>`;
    default:
      return `<section ${idAttr} ${cls}><p>Unsupported block type</p></section>`;
  }
}

function blockCss(project: SBuildProject): string {
  const lines: string[] = [];
  const blocks = generatedPages(project).flatMap((page) => page.blocks || []);
  for (const block of blocks) {
    const styles = block.styles || {};
    const selectors = [`.${styleClassForBlock(block)}`];
    if ((styles.effects || []).includes("hover-grow")) selectors.push(`.${styleClassForBlock(block)}:hover`);
    if ((styles.effects || []).includes("pulse")) selectors.push(`.${styleClassForBlock(block)}`);

    const base: string[] = [];
    if (styles.backgroundColor) base.push(`background:${styles.backgroundColor};`);
    if (styles.backgroundImage) {
      const fit = styles.backgroundSize === "contain" ? "contain" : styles.backgroundSize === "fill" ? "100% 100%" : "cover";
      base.push(`background-image:url('${styles.backgroundImage}');`);
      base.push(`background-size:${fit};`);
      base.push(`background-repeat:no-repeat;`);
      base.push(`background-position:${styles.backgroundPosition || "center"};`);
    }
    if (styles.textColor) base.push(`color:${styles.textColor};`);
    if (styles.fontFamily) base.push(`font-family:'${styles.fontFamily}', sans-serif;`);
    if (styles.fontSize) base.push(`font-size:${styles.fontSize}px;`);
    if (styles.fontWeight) base.push(`font-weight:${styles.fontWeight};`);
    if (styles.textAlign) base.push(`text-align:${styles.textAlign};`);
    if (styles.padding !== undefined) base.push(`padding:${styles.padding}px;`);
    if (styles.margin !== undefined) base.push(`margin:${styles.margin}px auto;`);
    if (styles.borderRadius !== undefined) base.push(`border-radius:${styles.borderRadius}px;`);
    if (styles.shadow) base.push(`box-shadow:${styles.shadow};`);
    if ((styles.effects || []).includes("glow")) base.push(`text-shadow:0 0 12px rgba(46,128,255,0.6);`);
    if ((styles.effects || []).includes("gradient-text")) base.push(`background:linear-gradient(90deg,#1f5fff,#3ddc97);-webkit-background-clip:text;color:transparent;`);
    if ((styles.effects || []).includes("parallax")) base.push(`background-attachment:fixed;`);
    base.push(...(backgroundStylePresets[styles.backgroundStyle || ""] || []));
    const borderStyle = borderStylePresets[styles.borderStyle || ""];
    if (borderStyle) base.push(borderStyle);
    const shadowStyle = shadowStylePresets[styles.shadowStyle || ""];
    if (shadowStyle) base.push(shadowStyle);
    base.push(...(textEffectPresets[styles.textEffect || ""] || []));

    lines.push(`${selectors[0]}{${base.join("")}}`);
    const buttonStyle = buttonStylePresets[styles.buttonStyle || ""];
    if (buttonStyle && buttonStyle.length) {
      lines.push(`.${styleClassForBlock(block)} .btn{${buttonStyle.join("")}}`);
    }
    if ((styles.effects || []).includes("hover-grow")) {
      lines.push(`.${styleClassForBlock(block)}{transition:transform .2s ease;}`);
      lines.push(`.${styleClassForBlock(block)}:hover{transform:scale(1.02);}`);
    }
    if ((styles.effects || []).includes("pulse")) {
      lines.push(`.${styleClassForBlock(block)}{animation:pulse 2.2s infinite;}`);
    }
    if ((styles.effects || []).includes("marquee")) {
      lines.push(`.${styleClassForBlock(block)} .marquee-track{display:inline-block;white-space:nowrap;animation:marquee 12s linear infinite;}`);
    }
    if ((styles.effects || []).includes("fade-in")) {
      lines.push(`.${styleClassForBlock(block)}{animation:fadeIn .6s ease both;}`);
    }
  }
  return lines.join("\n");
}

export function renderSiteStyles(project: SBuildProject): string {
  return `:root{--bg:${project.globalStyles.colors.bg};--surface:${project.globalStyles.colors.surface};--text:${project.globalStyles.colors.text};--accent:${project.globalStyles.colors.accent};--muted:${project.globalStyles.colors.muted};}
*{box-sizing:border-box}
body{margin:0;font-family:'${project.globalStyles.bodyFont}',sans-serif;background:var(--bg);color:var(--text)}
h1,h2,h3{font-family:'${project.globalStyles.headingFont}',serif;margin:0 0 12px}
p{line-height:1.6}
.site-header{position:sticky;top:0;display:flex;justify-content:space-between;gap:16px;padding:14px 20px;background:var(--surface);border-bottom:1px solid rgba(0,0,0,.08)}
.site-header nav{display:flex;gap:12px;flex-wrap:wrap}
.site-header a{text-decoration:none;color:var(--text);font-weight:700}
main{max-width:1000px;margin:20px auto;padding:0 16px;display:flex;flex-direction:column;gap:18px}
.block{background:var(--surface);border-radius:14px;padding:18px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.gallery img,.type-image img{width:100%;border-radius:10px}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700}
footer{padding:28px;text-align:center;color:var(--muted)}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.01)}}
@keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
${blockCss(project)}
`;
}

async function copyProjectImages(): Promise<void> {
  const outputImageDir = path.join(distDir, "images");
  await fs.mkdir(outputImageDir, { recursive: true });
  const copyRecursive = async (srcDir: string, destDir: string): Promise<void> => {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await fs.mkdir(destDir, { recursive: true });
    for (const entry of entries) {
      const src = path.join(srcDir, entry.name);
      const dest = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await copyRecursive(src, dest);
      } else {
        await fs.copyFile(src, dest);
      }
    }
  };
  try {
    await copyRecursive(projectImagesDir, outputImageDir);
  } catch {
    // no images yet
  }
}

export function renderSiteDocument(project: SBuildProject, page: GeneratedPage = generatedPages(project)[0]): string {
  const pageIndex = Math.max(0, generatedPages(project).findIndex((candidate) => candidate.id === page.id));
  const canonicalUrl = canonicalUrlForPage(project, page, pageIndex);
  const documentTitle = titleForPage(project, page, pageIndex);
  const description = project.site.description || "";
  const blocksHtml = page.blocks.map((b) => renderBlock(b)).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(documentTitle)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(project.site.siteName)}" />
<meta property="og:title" content="${escapeHtml(documentTitle)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta name="twitter:card" content="summary" />
<link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
<header class="site-header">
  <div class="brand">${escapeHtml(project.site.siteName)}</div>
  <nav>${project.site.nav.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}</nav>
</header>
<main>${blocksHtml}</main>
<footer><small>${escapeHtml(project.site.siteName)} · ${new Date().getFullYear()}</small></footer>
</body>
</html>`;
}

export function renderSitemap(project: SBuildProject): string {
  const urls = generatedPages(project)
    .map((page, index) => `  <url><loc>${escapeHtml(canonicalUrlForPage(project, page, index))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function renderRobotsTxt(project: SBuildProject): string {
  return `User-agent: *\nAllow: /\nSitemap: ${siteBaseUrl(project)}/sitemap.xml\n`;
}

export function renderGeneratedSiteFiles(project: SBuildProject): Array<{ relativePath: string; contents: string }> {
  const htmlFiles = generatedPages(project).map((page, index) => ({
    relativePath: outputRelativePathForPage(page, index),
    contents: renderSiteDocument(project, page)
  }));

  return [
    ...htmlFiles,
    { relativePath: path.join("assets", "styles.css"), contents: renderSiteStyles(project) },
    { relativePath: "sitemap.xml", contents: renderSitemap(project) },
    { relativePath: "robots.txt", contents: renderRobotsTxt(project) }
  ];
}

export async function generateSite(project: SBuildProject): Promise<{ outputDir: string; files: string[] }> {
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(path.join(distDir, "assets"), { recursive: true });

  const files: string[] = [];

  for (const file of renderGeneratedSiteFiles(project)) {
    const relativePath = file.relativePath;
    const absolutePath = path.join(distDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.contents, "utf8");
    files.push(absolutePath);
  }
  await copyProjectImages();

  return {
    outputDir: distDir,
    files
  };
}
