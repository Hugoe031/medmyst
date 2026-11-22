import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const release = process.argv.includes("--release");
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

// Store builds get live ad IDs; debug syncs and Pages keep the test unit.
if (release) {
  await writeFile(`${out}/src/core/build-config.js`, "export const RELEASE_BUILD = true;\n");
}

console.log(`web build written to ${out}/ (${release ? "release" : "debug"})`);
