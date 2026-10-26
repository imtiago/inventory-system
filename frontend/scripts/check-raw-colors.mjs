// Falha se algum componente usar cor crua do Tailwind (ex.: text-gray-500, bg-white) ou hexadecimal em vez dos
// tokens do tema (text-muted, bg-surface, …). Cores cruas não mudam com o tema escuro.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const palette =
  "gray|slate|zinc|neutral|stone|red|blue|green|amber|yellow|emerald|indigo|sky|orange|purple|rose|teal|cyan|lime|pink|violet|fuchsia";
const utilities =
  "text|bg|border|ring|from|to|via|fill|stroke|divide|placeholder|outline|accent|caret|decoration|shadow";
const rawColor = new RegExp(
  `\\b(?:${utilities})-(?:(?:${palette})-\\d{2,3}|white|black)\\b|#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b(?![0-9a-fA-F])`,
);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__" && name !== "test") yield* files(path);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      yield path;
    }
  }
}

const problems = [];
for (const file of files(root)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes("raw-color-ok")) return;
      const match = line.match(rawColor);
      if (match) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${match[0]}`);
    });
}

if (problems.length) {
  console.error("Cores cruas encontradas (use os tokens do tema; exceção justificada: comentário `raw-color-ok`):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check-raw-colors: nenhuma cor crua.");
