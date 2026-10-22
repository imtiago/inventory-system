import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";

app.log.level = "silent";

describe("Erros HTTP de nfe-import", () => {
  let token: string;
  before(async () => {
    token = jwt.sign({ sub: await getTestUserId(), role: "admin" }, process.env.JWT_SECRET!);
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
});
