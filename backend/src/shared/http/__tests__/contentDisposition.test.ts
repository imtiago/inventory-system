import { test } from "node:test";
import assert from "node:assert/strict";
import { contentDisposition } from "../contentDisposition";

test("nome simples: filename e filename* iguais", () => {
  assert.equal(
    contentDisposition("inline", "CAIXA-001.pdf"),
    `inline; filename="CAIXA-001.pdf"; filename*=UTF-8''CAIXA-001.pdf`,
  );
});

test("aspas, barras e quebras de linha não escapam do cabeçalho", () => {
  const header = contentDisposition("inline", 'a"b\\c\r\nSet-Cookie: x=1.pdf');
  assert.ok(!/[\r\n]/.test(header));
  assert.match(header, /^inline; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9._%-]+$/);
  assert.ok(!header.includes('"b'), header);
});

test("emoji e acentos: fallback ASCII e filename* em UTF-8 percent-encoded (sem ERR_INVALID_CHAR)", () => {
  const header = contentDisposition("inline", "caixa-é-😀.pdf");
  assert.equal(header, `inline; filename="caixa-_-_.pdf"; filename*=UTF-8''caixa-%C3%A9-%F0%9F%98%80.pdf`);
  // Todos os caracteres do cabeçalho são ASCII imprimível.
  assert.match(header, /^[\x20-\x7e]+$/);
});

test("nome vazio vira 'arquivo'", () => {
  assert.match(contentDisposition("attachment", ""), /filename="arquivo"/);
});

test("surrogate solto não faz o encode lançar", () => {
  assert.doesNotThrow(() => contentDisposition("inline", "a\uD800b.pdf"));
});
