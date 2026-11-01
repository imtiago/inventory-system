/** Multa, juros e carência de um documento a receber. */
export interface LateFeeRates {
  graceDays: number;
  fineBps: number;
  monthlyInterestBps: number;
}

/** Origem do documento (venda do crediário → termos gravados na venda). */
export interface LateFeeOrigin {
  originType: string;
  originId: string;
}

/**
 * Termos de atraso do documento: os contratados na venda do crediário (`SaleFinancing`); documento sem
 * financiamento usa os atuais das configurações do crédito.
 */
export interface LateFeeRatesReader {
  rates(origin: LateFeeOrigin): Promise<LateFeeRates>;
}
