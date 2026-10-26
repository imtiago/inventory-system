// Regras da checagem de cores cruas (usadas por check-raw-colors.mjs e pelo auto-teste).
const palette =
  "gray|slate|zinc|neutral|stone|red|blue|green|amber|yellow|emerald|indigo|sky|orange|purple|rose|teal|cyan|lime|pink|violet|fuchsia";
// `border` cobre também os lados/eixos (border-t-…, border-x-…); `ring-offset` é a cor do recuo do anel.
const utilities =
  "text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|from|to|via|fill|stroke|divide|placeholder|outline|accent|caret|decoration|shadow";
const named = "white|black|red|blue|green|yellow|orange|purple|pink|gray|grey|transparent";

const patterns = [
  // text-gray-500, bg-white, border-t-gray-200/60 …
  new RegExp(`\\b(?:${utilities})-(?:(?:${palette})-\\d{2,3}|white|black)\\b`),
  // valor arbitrário com cor literal: bg-[#fff], text-[rgb(0_0_0)], shadow-[0_0_#000]
  new RegExp(`\\b(?:${utilities})-\\[[^\\]]*(?:#[0-9a-fA-F]{3}|(?:rgba?|hsla?|oklch|oklab)\\((?!var\\())[^\\]]*\\]`),
  // hexadecimal de 3, 4, 6 ou 8 dígitos
  /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/,
  /#[0-9a-fA-F]{3,4}\b(?![0-9a-fA-F])/,
  // rgb()/hsl() literais (rgb(var(--token)) é permitido)
  /\b(?:rgba?|hsla?)\((?!\s*var\()/,
  // nomes de cor em props de estilo/SVG: style={{ color: 'white' }}, fill="black"
  new RegExp(`\\b(?:color|background|backgroundColor|borderColor|fill|stroke)\\s*[:=]\\s*\\{?\\s*['"](?:${named})['"]`),
];

/** Devolve o trecho cru encontrado na linha, ou null. */
export function findRawColor(line) {
  if (line.includes("raw-color-ok")) return null;
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return match[0];
  }
  return null;
}
