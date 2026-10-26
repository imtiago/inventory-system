/**
 * Cabeçalho `Content-Disposition` seguro para nome de arquivo vindo de texto do usuário
 * (RFC 6266 / RFC 5987): `filename` só com ASCII seguro (fallback) e `filename*` em UTF-8
 * com percent-encoding. Aspas, barras, quebras de linha e caracteres fora de latin1 nunca
 * chegam crus ao cabeçalho.
 */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  // Surrogates soltos fariam encodeURIComponent lançar: viram U+FFFD.
  const name =
    filename.length > 0
      ? filename.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
      : "arquivo";
  const fallback = name.replace(/[^A-Za-z0-9._-]/gu, "_");
  // encodeURIComponent deixa passar ! ' ( ) *, que o atributo-char da RFC 5987 não aceita.
  const encoded = encodeURIComponent(name).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
