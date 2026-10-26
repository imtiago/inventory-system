import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSeedAllowed } from "../seedGuard";

test("seed roda em banco de desenvolvimento vazio", () => {
  assert.equal(checkSeedAllowed({ nodeEnv: "development", force: false, hasData: false }), null);
  assert.equal(checkSeedAllowed({ nodeEnv: undefined, force: false, hasData: false }), null);
});

test("seed recusa banco com dados, a menos que use --force", () => {
  assert.match(checkSeedAllowed({ nodeEnv: "development", force: false, hasData: true }) ?? "", /--force/);
  assert.equal(checkSeedAllowed({ nodeEnv: "development", force: true, hasData: true }), null);
});

test("seed recusa NODE_ENV=production mesmo com --force", () => {
  assert.match(checkSeedAllowed({ nodeEnv: "production", force: true, hasData: false }) ?? "", /produção/);
});
