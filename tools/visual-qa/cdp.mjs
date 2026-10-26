// Chrome headless controlado por CDP (WebSocket nativo do Node 22). Sem dependências.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CDP_PORT, CHROME } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(port = CDP_PORT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-qa-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: process.env.QA_DEBUG ? 'inherit' : 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch (e) { if (process.env.QA_DEBUG) console.error(String(e.cause || e)); }
    await sleep(200);
  }
  const target = targets?.find((t) => t.type === 'page');
  if (!target) { proc.kill('SIGKILL'); throw new Error(`Chrome não respondeu em ${port} (CHROME=${CHROME})`); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (d) => (d.error ? rej(new Error(`${method}: ${JSON.stringify(d.error)}`)) : res(d.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  return {
    send, sleep,
    async viewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async goto(url, wait = 1500) { await send('Page.navigate', { url }); await sleep(wait); },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
      return r.result.value;
    },
    /** Define sessão e tema (chave `ui.theme`: light | dark | system) na origem atual; vale a partir da próxima navegação. */
    async prepare({ theme = 'light', auth = true } = {}) {
      await this.eval(`localStorage.setItem('ui.theme', ${JSON.stringify(theme)}); ${auth ? "localStorage.setItem('token','fake')" : "localStorage.removeItem('token')"}`);
    },
    async shot(file, full = false) {
      let clip;
      if (full) {
        const m = await send('Page.getLayoutMetrics');
        clip = { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: Math.min(Math.ceil(m.cssContentSize.height), 6000), scale: 1 };
      }
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async close() { ws.close(); proc.kill('SIGKILL'); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* perfil temporário: o SO limpa depois */ } },
  };
}
