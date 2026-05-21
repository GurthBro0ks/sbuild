import { createApp } from "./app.js";
import { editorDistDir } from "./lib/paths.js";
import fs from "node:fs";
import path from "node:path";

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
