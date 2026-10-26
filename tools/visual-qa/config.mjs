// Configuração comum das ferramentas de QA visual. Tudo vem de argumentos (--chave valor) ou variáveis QA_*.
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
export const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; i++; }
  } else positional.push(argv[i]);
}

const pick = (name, env, fallback) => flags[name] ?? process.env[env] ?? fallback;
const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);

// Portas fora do padrão do projeto (5173 front, 3000 API) para nunca esbarrar nos servidores de dev.
export const PORT = Number(pick('port', 'QA_PORT', 4400));
export const CDP_PORT = Number(pick('cdp-port', 'QA_CDP_PORT', 4401));
export const BASE = pick('base', 'QA_BASE', `http://127.0.0.1:${PORT}`);
export const CHROME = pick('chrome', 'QA_CHROME', process.env.CHROME_BIN || '/usr/bin/google-chrome');
export const OUT = path.resolve(pick('out', 'QA_OUT', path.join(os.tmpdir(), 'visual-qa-out')));
export const WIDTHS = list(pick('widths', 'QA_WIDTHS', '375,768,1280,1440,1920')).map(Number);
export const THEMES = list(pick('themes', 'QA_THEMES', 'light,dark'));
export const ONLY = flags.only ? list(flags.only) : null;
export const HEIGHT_FOR = (w) => (w <= 430 ? 812 : w <= 820 ? 1024 : 900);
export const flag = (name) => flags[name];
