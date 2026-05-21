#!/usr/bin/env node

const port = process.env.PORT || "3137";

if (process.argv.includes("--help")) {
  console.log("sbuild prototype CLI\n\nUsage:\n  sbuild\n\nStarts instructions for running the sBuild server/editor.");
  process.exit(0);
}

console.log("sbuild prototype is installed.");
console.log(`Start server: PORT=${port} pnpm --filter @sbuild/server dev`);
console.log("Start editor: pnpm --filter @sbuild/editor dev");
console.log(`Open: http://localhost:${port} (production build) or http://localhost:5177 (dev)`);
