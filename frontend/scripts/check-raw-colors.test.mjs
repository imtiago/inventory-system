// Auto-teste da checagem: node --test scripts/check-raw-colors.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findRawColor } from "./raw-color-rules.mjs";

const caught = [
  'className="text-gray-500"',
  'className="bg-white"',
  'className="text-white/80"',
  'className="from-black/40"',
  'className="border-t-gray-200"',
  'className="border-x-red-500"',
  'className="border-l-blue-500"',
  'className="ring-offset-white"',
  'className="bg-[#fff]"',
  'className="bg-[#fffc]"',
  'className="text-[#0f172acc]"',
  'className="text-[rgb(0_0_0)]"',
  'className="shadow-[0_0_4px_rgba(0,0,0,.5)]"',
  "style={{ background: 'rgb(0 0 0)' }}",
  "style={{ color: 'hsl(10 10% 10%)' }}",
  "style={{ color: 'white' }}",
  'fill="black"',
  "const c = '#123456'",
];
const allowed = [
  'className="text-muted bg-surface border-border"',
  'className="border-t border-border"',
  'className="border-x-border ring-offset-surface"',
  'className="bg-primary/10 text-primary-foreground"',
  'className="border-t-0 border-b-2 text-[length:14px] w-[10px]"',
  "style={{ background: 'rgb(var(--surface))' }}",
  'className="text-white" // raw-color-ok',
  "style={{ color: 'var(--text)' }}",
];

for (const line of caught) test(`pega: ${line}`, () => assert.ok(findRawColor(line), line));
for (const line of allowed) test(`aceita: ${line}`, () => assert.equal(findRawColor(line), null, line));
