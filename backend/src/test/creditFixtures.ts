import type { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { DEFAULT_CREDIT_RULES } from "@credit/domain/creditRules";
import { DEFAULT_CREDIT_PROFILES } from "@credit/domain/CreditProfileCode";

/** Volta configurações e perfis de crédito aos valores iniciais (segure `acquireCreditTestLock()`). */
export async function resetCreditDefaults(): Promise<void> {
  await prisma.creditSettings.update({
    where: { id: "default" },
    data: {
      crediarioEnabled: false,
      rules: DEFAULT_CREDIT_RULES as unknown as Prisma.InputJsonValue,
      enabledAt: null,
      enabledById: null,
      updatedById: null,
    },
  });
  for (const p of DEFAULT_CREDIT_PROFILES) {
    await prisma.creditProfile.update({
      where: { code: p.code },
      data: {
        name: p.name,
        initialLimit: p.initialLimitCents / 100,
        minDownPaymentBps: p.minDownPaymentBps,
        maxInstallments: p.maxInstallments,
      },
    });
  }
}
