/**
 * Conteúdo (puro, só texto já formatado) do carnê e do recibo. O desenho no PDF fica em
 * `CreditDocumentsPdfService`; aqui só se decide o que aparece e com que palavras.
 * Dinheiro em centavos inteiros; percentuais em bps; datas "YYYY-MM-DD".
 */

export interface StoreInfo {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
}

export interface CustomerInfo {
  name: string;
  document: string | null;
  phone: string | null;
  address: string | null;
}

export interface CarneInput {
  store: StoreInfo;
  customer: CustomerInfo;
  sale: { code: string; date: string; items: { name: string; quantity: number }[] };
  financing: {
    cashPriceCents: number;
    downPaymentCents: number;
    downPaymentMethod: string | null;
    financedCents: number;
    installments: number;
    monthlyRateBps: number;
    surchargeCents: number;
    totalCents: number;
  };
  /** Parcelas do plano em ordem de vencimento (sem a entrada, que já foi paga no ato). */
  parcels: { dueDate: string; amountCents: number }[];
  rules: { fineBps: number; monthlyInterestBps: number; graceDays: number };
}

export interface CarneContent {
  store: string[];
  customer: string[];
  sale: string[];
  summary: { label: string; value: string }[];
  stubs: { number: string; dueDate: string; amount: string }[];
  /** Repetidos em cada canhoto. */
  storeName: string;
  stubOwner: string;
  saleCode: string;
}

export interface ReceiptInput {
  store: StoreInfo;
  customer: CustomerInfo;
  payment: {
    code: string;
    paymentDate: string;
    method: string;
    reference: string | null;
    /** null = entrada do crediário (não numera as parcelas do carnê). */
    parcelNumber: number | null;
    parcelCount: number;
    dueDate: string;
    /** Vencimento "a combinar" (caderninho): o recibo não mostra a data. */
    dueDateUnknown?: boolean;
    principalCents: number;
    fineCents: number;
    interestCents: number;
    waivedCents: number;
    waiverReason: string | null;
    /** Pagamento lançado com data passada: motivo. */
    backdateReason?: string | null;
    receivedBy: string | null;
    originLabel: string;
  };
}

export interface ReceiptContent {
  store: string[];
  customer: string[];
  title: string;
  statement: string;
  lines: { label: string; value: string }[];
  /** Quem recebeu (linha de assinatura do recibo). */
  receivedBy: string | null;
}

export function formatBrl(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

/** 399 → "3,99%"; 200 → "2%"; 150 → "1,5%". */
export function formatBps(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = String(bps % 100).padStart(2, "0").replace(/0$/, "");
  return `${whole}${frac && frac !== "0" ? `,${frac}` : ""}%`;
}

export function formatDateBr(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

function formatDocument(raw: string): { label: string; value: string } {
  const d = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (d.length === 11) return { label: "CPF", value: `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` };
  if (d.length === 14) {
    return { label: "CNPJ", value: `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` };
  }
  return { label: "CPF/CNPJ", value: raw };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  BANK_TRANSFER: "Transferência",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BOLETO: "Boleto",
};
const methodLabel = (method: string) => METHOD_LABELS[method] ?? method;

function storeLines(store: StoreInfo): string[] {
  return [store.name, `CNPJ: ${formatDocument(store.cnpj).value}`, store.address, `Telefone: ${formatPhone(store.phone)}`];
}

function customerLines(customer: CustomerInfo): string[] {
  const lines = [customer.name];
  if (customer.document) {
    const doc = formatDocument(customer.document);
    lines.push(`${doc.label}: ${doc.value}`);
  }
  if (customer.phone) lines.push(`Telefone: ${formatPhone(customer.phone)}`);
  if (customer.address) lines.push(`Endereço: ${customer.address}`);
  return lines;
}

/** Parcelas consecutivas de mesmo valor agrupadas: "4 × R$ 224,56 + 1 × R$ 224,58". */
function describeParcels(amounts: number[]): string {
  const groups: { amount: number; count: number }[] = [];
  for (const amount of amounts) {
    const last = groups[groups.length - 1];
    if (last && last.amount === amount) last.count += 1;
    else groups.push({ amount, count: 1 });
  }
  return groups.map((g) => `${g.count} × ${formatBrl(g.amount)}`).join(" + ");
}

const MAX_ITEM_LINES = 6;

function saleLines(sale: CarneInput["sale"]): string[] {
  const lines = [`Venda #${sale.code} em ${formatDateBr(sale.date)}`];
  const shown = sale.items.slice(0, MAX_ITEM_LINES).map((i) => `${i.quantity} × ${i.name}`);
  lines.push(...shown);
  if (sale.items.length > MAX_ITEM_LINES) lines.push(`e mais ${sale.items.length - MAX_ITEM_LINES} item(ns)`);
  return lines;
}

export function buildCarneContent(input: CarneInput): CarneContent {
  const { financing: f, rules } = input;
  const grace = rules.graceDays > 0 ? `, se atrasar mais de ${rules.graceDays} ${rules.graceDays === 1 ? "dia" : "dias"}` : "";
  const down =
    f.downPaymentCents > 0 && f.downPaymentMethod
      ? `${formatBrl(f.downPaymentCents)} (${methodLabel(f.downPaymentMethod)})`
      : formatBrl(f.downPaymentCents);

  const summary = [
    { label: "Preço à vista", value: formatBrl(f.cashPriceCents) },
    { label: "Entrada", value: down },
    { label: "Valor financiado", value: formatBrl(f.financedCents) },
    { label: "Parcelas", value: describeParcels(input.parcels.map((p) => p.amountCents)) },
    { label: "Taxa mensal", value: f.monthlyRateBps === 0 ? "0% (sem acréscimo)" : `${formatBps(f.monthlyRateBps)} ao mês` },
    { label: "Acréscimo total", value: formatBrl(f.surchargeCents) },
    { label: "Total a prazo", value: formatBrl(f.totalCents) },
    { label: "Multa por atraso", value: `${formatBps(rules.fineBps)} sobre o valor da parcela${grace}` },
    { label: "Juros por atraso", value: `${formatBps(rules.monthlyInterestBps)} ao mês, proporcional aos dias de atraso` },
  ];

  const count = input.parcels.length;
  return {
    store: storeLines(input.store),
    customer: customerLines(input.customer),
    sale: saleLines(input.sale),
    summary,
    stubs: input.parcels.map((p, i) => ({
      number: `${i + 1}/${count}`,
      dueDate: formatDateBr(p.dueDate),
      amount: formatBrl(p.amountCents),
    })),
    storeName: input.store.name,
    stubOwner: input.customer.name,
    saleCode: input.sale.code,
  };
}

export function buildReceiptContent(input: ReceiptInput): ReceiptContent {
  const p = input.payment;
  const totalCents = p.principalCents + p.fineCents + p.interestCents - p.waivedCents;
  const parcelText = p.parcelNumber === null ? "Entrada" : `${p.parcelNumber}/${p.parcelCount}`;
  const lines: { label: string; value: string }[] = [
    { label: "Referente a", value: p.originLabel },
    { label: "Parcela", value: `${parcelText} (venc. ${p.dueDateUnknown ? "a combinar" : formatDateBr(p.dueDate)})` },
    { label: "Data do pagamento", value: formatDateBr(p.paymentDate) },
    ...(p.backdateReason ? [{ label: "Motivo da data retroativa", value: p.backdateReason }] : []),
    { label: "Forma de pagamento", value: methodLabel(p.method) },
  ];
  if (p.reference) lines.push({ label: "Referência", value: p.reference });
  lines.push({ label: "Valor da parcela (principal)", value: formatBrl(p.principalCents) });
  if (p.fineCents > 0) lines.push({ label: "Multa por atraso", value: formatBrl(p.fineCents) });
  if (p.interestCents > 0) lines.push({ label: "Juros por atraso", value: formatBrl(p.interestCents) });
  if (p.waivedCents > 0) {
    lines.push({ label: "Dispensado", value: `- ${formatBrl(p.waivedCents)}` });
    if (p.waiverReason) lines.push({ label: "Motivo da dispensa", value: p.waiverReason });
  }
  lines.push({ label: "Total recebido", value: formatBrl(totalCents) });

  return {
    store: storeLines(input.store),
    customer: customerLines(input.customer),
    title: `Recibo nº ${p.code}`,
    statement: `Recebemos de ${input.customer.name} a quantia de ${formatBrl(totalCents)}, referente ${p.parcelNumber === null ? "à entrada" : `à parcela ${parcelText}`} (${p.originLabel}).`,
    lines,
    receivedBy: p.receivedBy,
  };
}
