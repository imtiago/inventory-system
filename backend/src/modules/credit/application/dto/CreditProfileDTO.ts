import { bpsToPercent } from "@shared/domain/percent";
import { fromCents } from "@shared/domain/money";
import type { CreditProfileCode, CreditProfileParams } from "@credit/domain/CreditProfileCode";

export interface CreditProfileDTO {
  code: CreditProfileCode;
  name: string;
  initialLimit: number;
  minDownPaymentPercent: number;
  maxInstallments: number;
  position: number;
}

export function toCreditProfileDTO(p: CreditProfileParams, position: number): CreditProfileDTO {
  return {
    code: p.code,
    name: p.name,
    initialLimit: fromCents(p.initialLimitCents),
    minDownPaymentPercent: bpsToPercent(p.minDownPaymentBps),
    maxInstallments: p.maxInstallments,
    position,
  };
}
