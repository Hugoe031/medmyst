import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const out = "dist";
const files = ["index.html", "styles.css", "manifest.webmanifest", "sw.js", "PRIVACY_POLICY.md"];
const dirs = ["assets", "src"];
const sourceAssets = new Set([resolve("assets/icon.png")]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  await cp(file, `${out}/${file}`);
}
for (const dir of dirs) {
  await cp(dir, `${out}/${dir}`, {
    recursive: true,
    filter: (src) => !sourceAssets.has(resolve(src))
  });
}

console.log(`web build written to ${out}/`);
