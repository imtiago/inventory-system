import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError } from "@shared/domain/errors";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeImportAccessKeyTaken, NfeImportRepository } from "../../../contracts/NfeImportRepository";
import { GetNfeImportUseCase } from "../../queries/GetNfeImportUseCase";
import { UploadNfeImportUseCase } from "../UploadNfeImportUseCase";

test("chave tomada também na repetição → 409 CONCURRENT_UPDATE (não 500)", async () => {
  let attempts = 0;
  const repo = {
    lockByAccessKey: async () => null,
    createDraft: async () => {
      attempts++;
      throw new NfeImportAccessKeyTaken();
    },
  } as unknown as NfeImportRepository;
  const useCase = new UploadNfeImportUseCase(
    { parse: () => ({ accessKey: "k" }) as NfeDocument },
    repo,
    { execute: (work) => work() },
    {} as GetNfeImportUseCase,
  );

  await assert.rejects(
    useCase.execute({ file: Buffer.from("<x/>"), userId: null }),
    (e: unknown) =>
      e instanceof ConflictError &&
      e.code === "CONCURRENT_UPDATE" &&
      e.message === "Operação em andamento para este item. Tente novamente.",
  );
  assert.equal(attempts, 2);
});
