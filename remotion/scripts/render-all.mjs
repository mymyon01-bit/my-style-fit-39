import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const jobs = [
  ["fit-mobile", "/mnt/documents/mymyon-fit-mobile.mp4"],
  ["ootd-mobile", "/mnt/documents/mymyon-ootd-mobile.mp4"],
  ["discover-mobile", "/mnt/documents/mymyon-discover-mobile.mp4"],
  ["fit", "/mnt/documents/mymyon-fit.mp4"],
  ["ootd", "/mnt/documents/mymyon-ootd.mp4"],
  ["discover", "/mnt/documents/mymyon-discover.mp4"],
];

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

for (const [id, out] of jobs) {
  console.log("Rendering", id);
  const composition = await selectComposition({ serveUrl: bundled, id, puppeteerInstance: browser });
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: out,
    puppeteerInstance: browser,
    muted: true,
    concurrency: 1,
  });
  console.log("Done", out);
}

await browser.close({ silent: false });
