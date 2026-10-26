// Falha se algum componente usar cor crua do Tailwind (ex.: text-gray-500, bg-white) ou hexadecimal em vez dos
// tokens do tema (text-muted, bg-surface, …). Cores cruas não mudam com o tema escuro.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { findRawColor } from "./raw-color-rules.mjs";


const root = new URL("../src", import.meta.url).pathname;
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__" && name !== "test") yield* files(path);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name) && !/\.test\.[jt]sx?$/.test(name)) {
      yield path;
    }
  }
}

const problems = [];
for (const file of files(root)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const match = findRawColor(line);
      if (match) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${match}`);
    });
}

if (problems.length) {
  console.error("Cores cruas encontradas (use os tokens do tema; exceção justificada: comentário `raw-color-ok`):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check-raw-colors: nenhuma cor crua.");
