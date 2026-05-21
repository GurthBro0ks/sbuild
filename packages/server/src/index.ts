import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3137);
const app = createApp();

app.listen(port, () => {
  console.log(`[sbuild] server listening on http://localhost:${port}`);
});
