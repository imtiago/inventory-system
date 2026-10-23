import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Erros HTTP de nfe-import", () => {
  let token: string;
  before(async () => {
    token = signTestToken(await getTestUserId());
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  const boundary = "----tx-test-boundary";
  const multipart = (parts: string) => ({
    headers: { ...auth(), "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: parts + `--${boundary}--\r\n`,
  });

  test("nfe-import sem arquivo → 400 FILE_REQUIRED", async () => {
    const body = multipart(
      `--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nx\r\n`,
    );
    const res = await app.inject({ method: "POST", url: "/nfe-import", ...body });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "FILE_REQUIRED");
  });

  test("nfe-import extensão .txt → 422 UNSUPPORTED_FILE_FORMAT", async () => {
    const body = multipart(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="nota.txt"\r\nContent-Type: text/plain\r\n\r\nconteudo\r\n`,
    );
    const res = await app.inject({ method: "POST", url: "/nfe-import", ...body });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "UNSUPPORTED_FILE_FORMAT");
  });

  test("nfe-import .xml malformado → 422 INVALID_FILE_CONTENT", async () => {
    const body = multipart(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="nota.xml"\r\nContent-Type: text/xml\r\n\r\n<nfe><broken\r\n`,
    );
    const res = await app.inject({ method: "POST", url: "/nfe-import", ...body });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "INVALID_FILE_CONTENT");
  });

  test("nfe-import ?mode=FOO → 400 VALIDATION_ERROR no campo mode", async () => {
    const body = multipart(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="nota.xml"\r\nContent-Type: text/xml\r\n\r\n<nfe/>\r\n`,
    );
    const res = await app.inject({ method: "POST", url: "/nfe-import?mode=FOO", ...body });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    assert.equal(res.json().errors[0].field, "mode");
  });
});
