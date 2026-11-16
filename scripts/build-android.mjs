// Android build helper.
// Sets a process-local JAVA_HOME to a JDK >= 21 before invoking Gradle,
// because this machine's global JAVA_HOME is JDK 17 and the app targets Java 21.
// If no JDK 21 candidate is found, Gradle falls back to its own resolution.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const TASK = process.argv[2] === "release" ? "bundleRelease" : "assembleDebug";

const candidates = [
  process.env.JAVA_HOME,
  "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot",
  "C:\\Program Files\\Microsoft\\jdk-21.0.9.9-hotspot",
  "C:\\Program Files\\Java\\jdk-21",
  "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.7.6-hotspot"
];

function probe(javaHome) {
  if (!javaHome) return false;
  const javaBin = join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(javaBin)) return false;
  const out = spawnSync(javaBin, ["-version"], { encoding: "utf8" });
  const text = `${out.stdout ?? ""}${out.stderr ?? ""}`;
  const match = text.match(/version "(\d+)/);
  return match !== null && Number(match[1]) >= 21;
}

const chosen = candidates.find(probe);
if (chosen && chosen !== process.env.JAVA_HOME) {
  process.env.JAVA_HOME = chosen;
  console.log(`[android-build] using JAVA_HOME=${chosen}`);
} else if (chosen) {
  console.log(`[android-build] JAVA_HOME already targets JDK >= 21`);
} else {
  console.log("[android-build] no JDK >= 21 candidate found; relying on Gradle resolution");
}

function run(command, args, cwd) {
  // shell:true keeps this working on Windows where npx/gradlew are .bat/.cmd shims.
  const result = spawnSync([command, ...args].join(" "), {
    stdio: "inherit",
    cwd: cwd ?? ".",
    shell: true,
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("node", ["scripts/build-web.mjs"]);
run("npx", ["cap", "sync", "android"]);
run(process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew", [TASK], "android");
