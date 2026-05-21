import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Block, SBuildProject } from "@sbuild/shared";

const execFileAsync = promisify(execFile);

export function opencodeAvailable(): boolean {
  return !!process.env.PATH;
}

export async function chatWithFallback(prompt: string): Promise<{ provider: string; response: string }> {
  const opencode = process.env.SBUILD_OPENCODE_BIN || "opencode";
  try {
    const { stdout } = await execFileAsync(opencode, ["--prompt", prompt], { timeout: 6000 });
    const text = stdout?.trim();
    if (text) {
      return { provider: "opencode", response: text };
    }
  } catch {
    // fall through to deterministic mock
  }

  return {
    provider: "mock",
    response:
      "Prototype assistant: I can help rewrite block copy, suggest layout changes, or generate a starter site plan."
  };
}

export function applyDeterministicPaintFix(instruction: string, blocks: Block[]): { blocks: Block[]; notes: string[] } {
  const lower = instruction.toLowerCase();
  const notes: string[] = [];

  const next = blocks.map((block, idx) => {
    const b = { ...block, styles: { ...(block.styles || {}) } };

    if (idx === 0 && b.type === "hero") {
      if (lower.includes("bigger")) {
        b.styles.fontSize = Math.min((b.styles.fontSize || 34) + 8, 96);
        notes.push("Increased hero font size");
      }
      if (lower.includes("smaller")) {
        b.styles.fontSize = Math.max((b.styles.fontSize || 34) - 6, 14);
        notes.push("Reduced hero font size");
      }
    }

    if (lower.includes("blue")) {
      b.styles.textColor = "#1f5fff";
      notes.push(`Set ${b.id} text color to blue`);
    }

    if (lower.includes("center")) {
      b.styles.textAlign = "center";
      notes.push(`Centered text on ${b.id}`);
    }

    if (lower.includes("glow")) {
      const effects = new Set(b.styles.effects || []);
      effects.add("glow");
      b.styles.effects = [...effects];
      notes.push(`Added glow effect to ${b.id}`);
    }

    return b;
  });

  return { blocks: next, notes: notes.length ? notes : ["No deterministic rule matched, no changes applied."] };
}

export function wizardFallback(input: {
  name?: string;
  businessType?: string;
  description?: string;
  theme?: string;
}): Partial<SBuildProject> {
  const name = input.name?.trim() || "My Local Business";
  const type = input.businessType?.trim() || "Service";
  const description = input.description?.trim() || `A friendly ${type.toLowerCase()} website.`;

  return {
    site: {
      siteName: name,
      title: `${name} | ${type}`,
      description,
      domain: "",
      nav: [
        { id: "nav-home", label: "Home", href: "/" },
        { id: "nav-services", label: "Services", href: "/#services" },
        { id: "nav-contact", label: "Contact", href: "/#contact" }
      ]
    },
    globalStyles: {
      headingFont: "Poppins",
      bodyFont: "Lato",
      colors: {
        bg: "#f7f4ed",
        surface: "#ffffff",
        text: "#1c1f23",
        accent: input.theme?.toLowerCase().includes("cool") ? "#2471a3" : "#1e824c",
        muted: "#6b7280"
      }
    }
  };
}
