// Sunset Cover Studio — the entrypoint program (Node 22, stdlib only).
// It hands the app in: copies app/ and screenshots/ from beside this file
// into the output directory and writes dossier.json with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, e.g. `MAKEFUN_OUTPUT_DIR=out node main.ts`.
// The copy is byte-for-byte, so two runs write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, "app"), join(outputDir, "app"), { recursive: true });
mkdirSync(join(outputDir, "screenshots"), { recursive: true });
if (existsSync(join(repoRoot, "screenshots"))) {
  cpSync(join(repoRoot, "screenshots"), join(outputDir, "screenshots"), { recursive: true });
}

// The scorer's own caps: text capped at 160 KiB, at most 4 screenshots of
// at most 256 KiB each, app/ at most 993 files / 48 MiB, paths at most
// 1000 bytes. An entry over any of these is refused by the gate, so the
// library raises here instead of writing a dossier that cannot pass.
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, "dossier.json"), dossierBytes);
