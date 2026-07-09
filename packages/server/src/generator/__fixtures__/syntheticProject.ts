import type { Block, BlockData, BlockStyles, SBuildPage, SBuildProject } from "@sbuild/shared";

const defaultBlockData: Record<Block["type"], BlockData> = {
  hero: {
    heading: "Synthetic Hero",
    subheading: "Synthetic subheading",
    ctaLabel: "Synthetic CTA",
    ctaHref: "/synthetic"
  },
  text: {
    title: "Synthetic Text",
    body: "Synthetic body copy."
  },
  image: {
    src: "/images/synthetic.png",
    alt: "Synthetic image",
    caption: "Synthetic caption"
  },
  cards: {
    title: "Synthetic Cards",
    cards: [
      { id: "synthetic-card-1", title: "Synthetic Card", body: "Synthetic card body." }
    ]
  },
  hours: {
    title: "Synthetic Hours",
    rows: [{ day: "Monday", open: "08:00", close: "14:00" }]
  },
  gallery: {
    title: "Synthetic Gallery",
    images: [{ id: "synthetic-image-1", src: "/images/gallery-1.png", alt: "Synthetic gallery image" }]
  },
  contact: {
    title: "Synthetic Contact",
    phone: "555-0100",
    email: "hello@example.test",
    address: "100 Synthetic Road"
  },
  testimonial: {
    quote: "Synthetic quote.",
    author: "Synthetic Author"
  },
  map: {
    address: "100 Synthetic Road"
  },
  marquee: {
    text: "Synthetic marquee"
  },
  spacer: {
    height: 32
  },
  divider: {
    style: "solid"
  },
  html: {
    html: "<div data-synthetic-html=\"true\">Synthetic embed</div>"
  }
};

export function makeBlock(
  type: Block["type"] = "text",
  options: {
    id?: string;
    data?: Record<string, unknown>;
    styles?: BlockStyles;
  } = {}
): Block {
  const id = options.id ?? `synthetic-${type}`;
  const data = options.data === undefined
    ? defaultBlockData[type]
    : options.data as BlockData;
  return {
    id,
    type,
    data,
    ...(options.styles ? { styles: options.styles } : {})
  };
}

export function makeProject(options: {
  blocks?: Block[];
  pages?: SBuildPage[];
  site?: Partial<SBuildProject["site"]>;
  globalStyles?: Partial<SBuildProject["globalStyles"]>;
} = {}): SBuildProject {
  const pages = options.pages ?? [
    {
      id: "synthetic-page-home",
      slug: "/",
      title: "Synthetic Home",
      blocks: options.blocks ?? [makeBlock()]
    }
  ];

  return {
    version: "0.1.0",
    updatedAt: "2026-07-09T00:00:00.000Z",
    site: {
      siteName: "Synthetic Site",
      title: "Synthetic Site",
      description: "Synthetic description.",
      nav: [],
      ...options.site
    },
    globalStyles: {
      headingFont: "Inter",
      bodyFont: "Inter",
      colors: {
        bg: "#ffffff",
        surface: "#f6f6f6",
        text: "#111111",
        accent: "#2b6dff",
        muted: "#666666"
      },
      ...options.globalStyles
    },
    ai: {
      provider: "disabled",
      model: ""
    },
    deploy: {
      method: "dry-run",
      webRoot: ""
    },
    pages
  };
}

// Two-page synthetic variant for generator boundary tests.
export function makeTwoPageProject(page0Blocks: Block[], page1Blocks: Block[]): SBuildProject {
  return makeProject({
    pages: [
      {
        id: "synthetic-page-0",
        slug: "/",
        title: "Synthetic Page 0",
        blocks: page0Blocks
      },
      {
        id: "synthetic-page-1",
        slug: "/second",
        title: "Synthetic Page 1",
        blocks: page1Blocks
      }
    ]
  });
}
