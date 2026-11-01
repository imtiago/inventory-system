/** Multa, juros e carência vigentes (configurações do crédito). */
export interface LateFeeRates {
  graceDays: number;
  fineBps: number;
  monthlyInterestBps: number;
}

export interface LateFeeRatesReader {
  rates(): Promise<LateFeeRates>;
}
