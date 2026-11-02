import { test } from "node:test";
import assert from "node:assert/strict";
import { findSimilar, nameMatch, normalizeName } from "../nameSimilarity";

const similar: [string, string][] = [
  ["Maria Silva", "Maria S."],
  ["Maria Silva", "maria  silva"],
  ["José da Silva", "Jose Silva"],
  ["Ana Souza", "Ana Sousa"],
  ["Maria", "Maria Silva"],
  ["Maria Silva", "Maria"],
  ["M. Silva", "Maria Silva"],
  ["João Pedro Souza", "João P. Souza"],
];
const different: [string, string][] = [
  ["Maria Silva", "Mariana Silva"],
  ["João Souza", "Joana Souza"],
  ["Ana Paula", "Ana Lúcia"],
  ["Maria Silva", "Maria Santos"],
  ["Carlos", "Carla"],
  ["Carlos", "Maria Carlos"],
  ["M. S.", "Maria Silva"],
  ["Ana Lima", "Ana Maria Lima"],
  ["Ana Souza", "Anna Sousa"],
  ["", "Maria"],
];

test("normalizeName: acentos, caixa, pontuação, partículas", () => {
  assert.deepEqual(normalizeName("  JOSÉ  da   Silva "), ["jose", "silva"]);
  assert.deepEqual(normalizeName("Maria S."), ["maria", "s"]);
  assert.deepEqual(normalizeName("Ana-Clara D'Ávila"), ["ana", "clara", "davila"]);
  assert.deepEqual(normalizeName("Pedro e Filhos dos Santos"), ["pedro", "filhos", "santos"]);
  assert.deepEqual(normalizeName("   "), []);
});

test("parecidos", () => {
  for (const [a, b] of similar) {
    assert.notEqual(nameMatch(a, b), null, `${a} × ${b}`);
    assert.notEqual(nameMatch(b, a), null, `${b} × ${a}`);
  }
});

test("diferentes", () => {
  for (const [a, b] of different) {
    assert.equal(nameMatch(a, b), null, `${a} × ${b}`);
    assert.equal(nameMatch(b, a), null, `${b} × ${a}`);
  }
});

test("iguais após normalizar → SAME", () => {
  assert.equal(nameMatch("JOSÉ  da silva", "Jose da Silva"), "SAME");
  assert.equal(nameMatch("Maria Silva", "Maria S."), "SIMILAR");
});

test("findSimilar: mesmo celular com nome diferente → PHONE", () => {
  const r = findSimilar("Fulano Tal", [{ id: "1", name: "Beltrano Cruz", phone: "(11) 98888-7777" }], "+55 11 98888-7777");
  assert.deepEqual(r, [{ id: "1", match: "PHONE" }]);
  assert.deepEqual(findSimilar("Fulano Tal", [{ id: "1", name: "Beltrano", phone: "11988887777" }], "9888"), []);
  assert.deepEqual(findSimilar("Fulano", [{ id: "1", name: "Beltrano", phone: null }], null), []);
});

test("findSimilar: nome igual + celular igual fica SAME; SAME/PHONE antes de SIMILAR; máximo 5", () => {
  const candidates = [
    { id: "s1", name: "Maria S." },
    { id: "s2", name: "Maria" },
    { id: "p", name: "Outra Pessoa", phone: "11988887777" },
    { id: "same", name: "maria silva", phone: "11988887777" },
    { id: "x", name: "Carlos Dias" },
    { id: "s3", name: "M. Silva" },
    { id: "s4", name: "Maria Silvia" },
    { id: "s5", name: "Maria Silv." },
  ];
  const r = findSimilar("Maria Silva", candidates, "11988887777");
  assert.equal(r.length, 5);
  assert.deepEqual(new Set(r.slice(0, 2).map((x) => x.id)), new Set(["same", "p"]));
  assert.equal(r.find((x) => x.id === "same")?.match, "SAME");
  assert.ok(r.slice(2).every((x) => x.match === "SIMILAR"));
  assert.ok(!r.some((x) => x.id === "x"));
});

// Mediana de 5 rodadas com teto folgado: a suíte roda arquivos em paralelo e um tempo isolado
// (antes, < 200 ms numa rodada só) falhava por carga da máquina. O teto ainda pega uma regressão
// de complexidade (ex.: comparação quadrática por caractere), que levaria segundos.
test("desempenho: 100 linhas × 200 clientes, mediana de 5 rodadas < 1 s", () => {
  const first = ["Maria", "João", "Ana", "Carlos", "Paula", "Pedro", "Lucia", "José", "Marcos", "Rita"];
  const last = ["Silva", "Souza", "Santos", "Lima", "Costa", "Alves", "Rocha", "Dias", "Melo", "Cruz"];
  const mk = (i: number) => `${first[i % 10]} ${last[Math.floor(i / 10) % 10]} ${last[(i * 7) % 10]}`;
  const customers = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: mk(i), phone: `1199${String(i).padStart(7, "0")}` }));
  const runs: number[] = [];
  for (let run = 0; run < 5; run++) {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) findSimilar(mk(i * 3 + 1), customers, `1198${String(i).padStart(7, "0")}`);
    runs.push(performance.now() - t0);
  }
  const median = [...runs].sort((a, b) => a - b)[2];
  assert.ok(median < 1000, `mediana ${median.toFixed(1)} ms (rodadas: ${runs.map((ms) => ms.toFixed(0)).join(", ")})`);
});
