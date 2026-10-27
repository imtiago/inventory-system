import type { Bps } from "@shared/domain/percent";
import { buildInstallments } from "@shared/domain/installments";
import { assertNonNegativeInt, assertPositiveInt } from "./creditInput";

export interface PricePlan {
  /** Valor das parcelas 1..n−1 (e da última, salvo o ajuste de arredondamento). */
  installmentCents: number;
  parcels: number[];
  /** Σ parcelas = financiado + juros. */
  totalCents: number;
}

const BPS = 10_000n;

/** numerator (≥ 0) / denominator (> 0), meio para cima, exato em BigInt. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return (numerator % denominator) * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * Tabela Price em centavos inteiros (aritmética exata em BigInt).
 *   i = rateBps / 10000; pmt = roundHalfUp(P·i / (1 − (1 + i)^−n))
 *   para k = 1..n−1: juros = roundHalfUp(saldo·i); saldo −= pmt − juros
 *   última = saldo + roundHalfUp(saldo·i)  — absorve o resíduo dos arredondamentos.
 * Taxa 0 → divisão simples (`buildInstallments`: a última recebe o resto).
 */
export function buildPricePlan(principalCents: number, monthlyRateBps: Bps, installments: number): PricePlan {
  assertNonNegativeInt(principalCents, "principalCents");
  assertNonNegativeInt(monthlyRateBps, "monthlyRateBps");
  assertPositiveInt(installments, "installments");

  if (monthlyRateBps === 0) {
    const parcels = buildInstallments(principalCents, installments, new Date(0)).map((p) => p.amountCents);
    return { installmentCents: parcels[0], parcels, totalCents: principalCents };
  }

  const principal = BigInt(principalCents);
  const rate = BigInt(monthlyRateBps);
  const n = BigInt(installments);
  // P·i / (1 − (1+i)^−n) = P·r·(B+r)^n / (B·((B+r)^n − B^n)), com B = 10000.
  const grown = (BPS + rate) ** n;
  const pmt = roundHalfUp(principal * rate * grown, BPS * (grown - BPS ** n));

  const parcels: number[] = [];
  let balance = principal;
  for (let k = 1; k < installments; k++) {
    balance -= pmt - roundHalfUp(balance * rate, BPS);
    parcels.push(Number(pmt));
  }
  parcels.push(Number(balance + roundHalfUp(balance * rate, BPS)));

  return { installmentCents: Number(pmt), parcels, totalCents: parcels.reduce((a, b) => a + b, 0) };
}
