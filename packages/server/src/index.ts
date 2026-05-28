import { createApp } from "./app.js";
import { editorDistDir, repoRoot } from "./lib/paths.js";
import fs from "node:fs";
import path from "node:path";

function loadAuthEnvFile(): void {
  const configuredPath = process.env.SBUILD_AUTH_ENV_FILE || path.join(repoRoot, ".env.sbuild-auth");
  if (!fs.existsSync(configuredPath)) return;
  const raw = fs.readFileSync(configuredPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadAuthEnvFile();

const port = Number(process.env.PORT || 3137);
const app = createApp();
const editorIndexPath = path.join(editorDistDir, "index.html");
const editorDistExists = fs.existsSync(editorIndexPath);
const publishAllowed = process.env.SBUILD_ALLOW_PUBLISH === "1";

app.listen(port, () => {
  console.log(`[sbuild] server listening on http://localhost:${port}`);
  console.log(`[sbuild] editorDistPath=${editorDistDir}`);
  console.log(`[sbuild] editorIndexExists=${editorDistExists}`);
  console.log(`[sbuild] publishMode=${publishAllowed ? "live-enabled" : "dry-run"}`);
});
