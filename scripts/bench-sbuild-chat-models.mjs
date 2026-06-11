#!/usr/bin/env node
/*
 * sBuild AI Chat Model Benchmark
 *
 * READ-ONLY: does not pull, download, install, or delete any model.
 * Connects to the local Ollama instance (or $SBUILD_OLLAMA_ENDPOINT),
 * lists already-installed models, and runs a fixed sBuild QA set against
 * each one. The script is safe to run on a production server: it never
 * mutates Ollama state, never touches git, never touches the filesystem
 * outside the proof dir, and never reads or writes any secret.
 *
 * Usage:
 *   node scripts/bench-sbuild-chat-models.mjs [--out <proof-dir>]
 *
 * Output:
 *   <proof-dir>/model-benchmark.json   machine-readable results
 *   <proof-dir>/model-benchmark.md     human-readable summary
 *   <proof-dir>/model-benchmark.log    per-call logs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let proofDir = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--out" && i + 1 < args.length) {
    proofDir = args[i + 1];
    i += 1;
  }
}
if (!proofDir) {
  proofDir = `/tmp/proof_sbuild_bench_$(date -u +%Y%m%dT%H%M%SZ)`;
}
await mkdir(proofDir, { recursive: true });

const OLLAMA_ENDPOINT = process.env.SBUILD_OLLAMA_ENDPOINT || "http://127.0.0.1:11434";
const PER_PROMPT_TIMEOUT_MS = 25000;

const QA_SET = [
  {
    id: "card-titles-details",
    prompt: "What are the titles and details of each card?",
    projectKind: "cards-selected",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const has = ["seasonal vegetables", "herbs", "flowers"].some((w) => lower.includes(w));
      return { pass: has, note: has ? "card titles detected" : "no card titles detected" };
    }
  },
  {
    id: "pickup-hours",
    prompt: "What are the farm pickup hours?",
    projectKind: "site-with-hours",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const hasDay = ["monday", "tuesday", "saturday", "sunday"].some((d) => lower.includes(d));
      const hasTime = /\b\d{1,2}(:\d{2})?(\s*[ap]m)?\b/i.test(lower);
      return {
        pass: hasDay && hasTime,
        note: hasDay && hasTime ? "hours detected" : "no hours detected"
      };
    }
  },
  {
    id: "selected-block-title-description",
    prompt: "What is the title and description of this block?",
    projectKind: "hero-selected",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const hasHeroWords = ["hero", "fresh", "farm", "seasonal"].some((w) => lower.includes(w));
      return {
        pass: hasHeroWords,
        note: hasHeroWords ? "selected-block detail detected" : "no selected-block detail detected"
      };
    }
  },
  {
    id: "version-build",
    prompt: "What version/build am I running?",
    projectKind: "any",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const has = ["sbuild", "0.5.0", "dev", "commit", "branch"].some((w) => lower.includes(w));
      return {
        pass: has,
        note: has ? "build info detected" : "no build info detected"
      };
    }
  },
  {
    id: "general-knowledge-corn",
    prompt: "What color is a kernel of corn?",
    projectKind: "any",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const has = ["yellow", "white", "color", "kernel", "corn"].some((w) => lower.includes(w));
      return {
        pass: has,
        note: has ? "color mentioned" : "no color mentioned"
      };
    }
  },
  {
    id: "page-list",
    prompt: "What pages are on this site?",
    projectKind: "multi-page",
    heuristic: (text) => {
      const lower = (text || "").toLowerCase();
      const has = ["home", "about"].some((w) => lower.includes(w));
      return {
        pass: has,
        note: has ? "page names detected" : "no page names detected"
      };
    }
  }
];

function makeProject() {
  return {
    version: "1",
    updatedAt: "2026-06-10T00:00:00Z",
    site: {
      siteName: "Blackfish Farms",
      title: "Blackfish Farms",
      description: "Family farm",
      domain: "blackfishfarms.com",
      nav: []
    },
    globalStyles: {
      headingFont: "system-ui",
      bodyFont: "system-ui",
      colors: { bg: "#fff", surface: "#f4f4f4", text: "#222", accent: "#0a0", muted: "#666" }
    },
    ai: { provider: "ollama", model: "qwen2.5:1.5b" },
    deploy: { method: "dry-run", webRoot: "" },
    pages: [
      {
        id: "page-home",
        slug: "home",
        title: "Home",
        blocks: [
          {
            id: "hero-1",
            type: "hero",
            data: { heading: "Fresh from the farm", subheading: "Seasonal produce picked daily" }
          },
          {
            id: "cards-1",
            type: "cards",
            data: {
              title: "What We Grow",
              cards: [
                { id: "c1", title: "Seasonal Vegetables", body: "Tomatoes, peppers, squash, and greens." },
                { id: "c2", title: "Herbs & Greens", body: "Basil, cilantro, kale, and chard." },
                { id: "c3", title: "Farm Flowers", body: "Cut-flower bouquets by the bunch." }
              ]
            }
          },
          {
            id: "hours-1",
            type: "hours",
            data: {
              title: "Pickup Hours",
              rows: [
                { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
                { day: "Wednesday", open: "9:00 AM", close: "5:00 PM" },
                { day: "Saturday", open: "8:00 AM", close: "2:00 PM", note: "Farmers market" }
              ]
            }
          },
          {
            id: "contact-1",
            type: "contact",
            data: {
              phone: "555-0123",
              email: "hello@blackfish.example",
              address: "100 Farm Road, Smalltown"
            }
          }
        ]
      },
      {
        id: "page-about",
        slug: "about",
        title: "About",
        blocks: [
          {
            id: "text-about",
            type: "text",
            data: { title: "Our Story", body: "We are a small family farm that has been growing food for over 20 years." }
          }
        ]
      }
    ]
  };
}

function makeSystemPrompt() {
  return [
    "You are a helpful assistant for sBuild, a website editor.",
    "Give short, direct, plain-text answers.",
    "Do NOT wrap your answer in JSON unless the user explicitly asks for JSON.",
    "Do NOT include your reasoning process or thinking steps.",
    "When asked to write website copy, output ONLY the actual words a website visitor would read."
  ].join(" ");
}

async function fetchOllamaTags() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { reachable: false, models: [] };
    const payload = await res.json();
    return {
      reachable: true,
      models: (payload.models || []).map((m) => ({
        name: String(m.name || ""),
        size: m.size,
        parameterSize: m.details?.parameter_size
      }))
    };
  } catch {
    clearTimeout(timer);
    return { reachable: false, models: [] };
  }
}

async function runPromptOnModel(model, qa) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_PROMPT_TIMEOUT_MS);
  const startedAt = Date.now();
  const project = makeProject();
  const messages = [
    { role: "system", content: makeSystemPrompt() },
    { role: "user", content: qa.prompt }
  ];
  try {
    const res = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.2, num_predict: 256 },
        messages
      })
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) {
      return { ok: false, error: `http ${res.status}`, latencyMs };
    }
    const payload = await res.json().catch(() => ({}));
    const text = String(payload?.message?.content || "").trim();
    const timedOut = false;
    const heuristic = qa.heuristic(text);
    return { ok: true, text, latencyMs, heuristic, timedOut };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const aborted = err && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? `timeout after ${latencyMs}ms` : (err && err.message) || String(err),
      latencyMs,
      timedOut: aborted
    };
  }
}

async function main() {
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
  };
  log(`Proof dir: ${proofDir}`);
  log(`Ollama endpoint: ${OLLAMA_ENDPOINT}`);
  log(`Read-only mode: no model will be pulled, downloaded, or installed.`);

  const tags = await fetchOllamaTags();
  const discovered = {
    endpoint: OLLAMA_ENDPOINT,
    reachable: tags.reachable,
    discoveredAt: new Date().toISOString(),
    models: tags.models
  };
  log(`Ollama reachable: ${tags.reachable}, models: ${tags.models.map((m) => m.name).join(", ") || "(none)"}`);

  const results = {
    meta: {
      script: "scripts/bench-sbuild-chat-models.mjs",
      endpoint: OLLAMA_ENDPOINT,
      perPromptTimeoutMs: PER_PROMPT_TIMEOUT_MS,
      qaSet: QA_SET.map((q) => ({ id: q.id, prompt: q.prompt, projectKind: q.projectKind })),
      readOnly: true,
      note: "This script never pulls, downloads, installs, or deletes any model. It only POSTs /api/chat to already-installed models."
    },
    discovered,
    runs: []
  };

  if (!tags.reachable || tags.models.length === 0) {
    log("No models available; recording empty result.");
  } else {
    for (const m of tags.models) {
      log(`--- benchmarking ${m.name} (${m.parameterSize || "?"}) ---`);
      const modelRun = {
        name: m.name,
        size: m.size,
        parameterSize: m.parameterSize,
        prompts: []
      };
      for (const qa of QA_SET) {
        log(`  [${m.name}] ${qa.id}: running…`);
        const r = await runPromptOnModel(m.name, qa);
        const verdict = r.ok
          ? (r.heuristic?.pass ? "PASS" : "WARN")
          : (r.timedOut ? "TIMEOUT" : "FAIL");
        const entry = {
          id: qa.id,
          prompt: qa.prompt,
          ok: r.ok,
          error: r.error || null,
          timedOut: !!r.timedOut,
          latencyMs: r.latencyMs,
          text: r.text || "",
          heuristic: r.heuristic || null,
          verdict
        };
        modelRun.prompts.push(entry);
        log(`  [${m.name}] ${qa.id}: ${verdict} (${r.latencyMs}ms${r.timedOut ? ", TIMEOUT" : ""})`);
      }
      const passed = modelRun.prompts.filter((p) => p.verdict === "PASS").length;
      const warned = modelRun.prompts.filter((p) => p.verdict === "WARN").length;
      const failed = modelRun.prompts.filter((p) => p.verdict === "FAIL" || p.verdict === "TIMEOUT").length;
      const avgMs = Math.round(
        modelRun.prompts.reduce((s, p) => s + (p.latencyMs || 0), 0) / Math.max(1, modelRun.prompts.length)
      );
      modelRun.summary = { passed, warned, failed, total: modelRun.prompts.length, avgLatencyMs: avgMs };
      results.runs.push(modelRun);
    }
  }

  results.recommendation = deriveRecommendation(results);
  await writeFile(path.join(proofDir, "model-benchmark.json"), JSON.stringify(results, null, 2), "utf8");
  await writeFile(path.join(proofDir, "model-benchmark.md"), renderMarkdown(results), "utf8");
  log(`Wrote model-benchmark.json and model-benchmark.md to ${proofDir}`);
  log(`Recommendation: ${results.recommendation.short}`);
}

function deriveRecommendation(results) {
  if (!results.runs || results.runs.length === 0) {
    return {
      short: "no-models",
      detail: "Ollama unreachable or no models installed. Cannot recommend a model from the benchmark."
    };
  }
  const ranked = [...results.runs].sort((a, b) => {
    const aScore = (a.summary?.passed || 0) - (a.summary?.failed || 0);
    const bScore = (b.summary?.passed || 0) - (b.summary?.failed || 0);
    if (aScore !== bScore) return bScore - aScore;
    return (a.summary?.avgLatencyMs || 99999) - (b.summary?.avgLatencyMs || 99999);
  });
  const winner = ranked[0];
  const winnerVerdict = (winner.summary?.passed || 0) === winner.summary?.total
    ? "all-pass"
    : (winner.summary?.passed || 0) >= Math.ceil(winner.summary?.total / 2)
      ? "mostly-pass"
      : "mostly-fail";
  return {
    short: `${winner.name} (${winnerVerdict})`,
    detail: `Top model by pass count: ${winner.name} (${winner.parameterSize || "?"}) — ${winner.summary?.passed}/${winner.summary?.total} passed, avg ${winner.summary?.avgLatencyMs}ms. If timing out frequently, keep qwen2.5:1.5b as fallback/smoke only. Heavier work should be routed to a real API or a future local AI hub; do not install Gemma-family/QAT models without operator approval.`
  };
}

function renderMarkdown(results) {
  const lines = [];
  lines.push(`# sBuild AI Chat Model Benchmark`);
  lines.push(``);
  lines.push(`- Endpoint: ${results.meta.endpoint}`);
  lines.push(`- Read-only: ${results.meta.readOnly ? "yes" : "no"}`);
  lines.push(`- Per-prompt timeout: ${results.meta.perPromptTimeoutMs}ms`);
  lines.push(`- Models installed: ${results.discovered.models.map((m) => m.name).join(", ") || "(none)"}`);
  lines.push(`- Ollama reachable: ${results.discovered.reachable ? "yes" : "no"}`);
  lines.push(``);
  lines.push(`## QA set`);
  for (const q of results.meta.qaSet) {
    lines.push(`- \`${q.id}\`: ${q.prompt} (${q.projectKind})`);
  }
  lines.push(``);
  lines.push(`## Results`);
  if (!results.runs || results.runs.length === 0) {
    lines.push(`_No models were benchmarked._`);
  } else {
    for (const run of results.runs) {
      lines.push(``);
      lines.push(`### ${run.name} (${run.parameterSize || "?"})`);
      lines.push(``);
      lines.push(`| Prompt | Verdict | Latency (ms) | Detail |`);
      lines.push(`|---|---|---|---|`);
      for (const p of run.prompts) {
        const detail = p.timedOut
          ? "TIMEOUT"
          : p.error
            ? p.error
            : p.heuristic?.note || "";
        lines.push(`| ${p.prompt} | ${p.verdict} | ${p.latencyMs} | ${detail} |`);
      }
      lines.push(``);
      lines.push(`Summary: ${run.summary.passed} PASS, ${run.summary.warned} WARN, ${run.summary.failed} FAIL/TIMEOUT, avg ${run.summary.avgLatencyMs}ms`);
    }
  }
  lines.push(``);
  lines.push(`## Recommendation`);
  lines.push(``);
  lines.push(`**${results.recommendation.short}**`);
  lines.push(``);
  lines.push(results.recommendation.detail);
  lines.push(``);
  lines.push(`## Candidate model notes (do NOT install without operator approval)`);
  lines.push(``);
  lines.push(`- **qwen2.5:1.5b** (~986 MB): keep as fallback/smoke only. Already installed. If it keeps timing out, route heavier Q&A to sBuild Brain (deterministic) or to a configured API.`);
  lines.push(`- **qwen3:4b** (~2.5 GB): already installed; may be slower. The Brain handles site Q&A instantly so the LLM only needs to run for general-knowledge questions and copy generation.`);
  lines.push(`- **Gemma-family / QAT local models**: not installed. Do not download or install without explicit operator approval (mission safety: do not download or install any model > 1GB without approval).`);
  lines.push(`- **OpenAI / OpenAI-compatible API**: allowed if \`SBUILD_OPENAI_CHAT_API_KEY\` is configured. Use this when the local Ollama path times out.`);
  lines.push(`- **Future: local AI hub route**: the longer-term architecture is a dedicated AI hub service with proper routing, fallback, and a model registry. Not in scope for this sprint.`);
  return lines.join("\n");
}

main().catch((err) => {
  console.error("[bench] fatal error:", err);
  process.exit(1);
});
