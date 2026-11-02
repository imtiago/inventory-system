import PDFDocument from "pdfkit";
import { Writable } from "stream";
import type { CarneContent, ReceiptContent } from "@credit/domain/carneContent";

type Doc = InstanceType<typeof PDFDocument>;

// Cores só do PDF (impresso em papel; não passam pelo tema da tela).
const INK = "#1b1b1f";
const MUTED = "#5a5a66";
const ACCENT = "#1f3a5f";
const ACCENT_SOFT = "#e8eef6";
const RULE = "#b8bcc6";

const MARGIN = 40;
const STUBS_PER_PAGE = 3;
const STUB_HEIGHT = 236;
const STUB_GAP = 16;

// Helvetica (WinAnsi) não tem emoji nem alfabetos não latinos: troca por "?" em vez de sair lixo.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    out += code === 0x09 || code === 0x0a || (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch) ? ch : "?";
  }
  return out;
}

/** Carnê (resumo + canhotos) e recibo em A4, com pdfkit (mesmo padrão das etiquetas). */
export class CreditDocumentsPdfService {
  carne(content: CarneContent): Promise<Buffer> {
    return this.render((doc) => {
      this.drawCarneSummary(doc, content);
      for (let i = 0; i < content.stubs.length; i++) {
        const slot = i % STUBS_PER_PAGE;
        if (slot === 0) doc.addPage();
        this.drawStub(doc, content, i, MARGIN + slot * (STUB_HEIGHT + STUB_GAP));
      }
    });
  }

  receipt(content: ReceiptContent): Promise<Buffer> {
    return this.render((doc) => this.drawReceipt(doc, content));
  }

  private render(draw: (doc: Doc) => void): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Producer: "inventory-system", Creator: "inventory-system" } });
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      sink.on("finish", () => resolve(Buffer.concat(chunks)));
      sink.on("error", reject);
      doc.pipe(sink);
      try {
        draw(doc);
      } catch (error) {
        reject(error);
      }
      doc.end();
    });
  }

  private get contentWidth(): number {
    return 595.28 - MARGIN * 2;
  }

  private band(doc: Doc, y: number, left: string, right: string): void {
    const width = this.contentWidth;
    doc.save().rect(MARGIN, y, width, 56).fill(ACCENT).restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(17).text(pdfSafe(left), MARGIN + 16, y + 11, { width: width - 32, lineBreak: false, ellipsis: true });
    doc.font("Helvetica").fontSize(10).text(pdfSafe(right), MARGIN + 16, y + 35, { width: width - 32, lineBreak: false });
  }

  /** Bloco de linhas pequenas; devolve o y logo abaixo. */
  private lines(doc: Doc, lines: string[], x: number, y: number, width: number, size = 9.5): number {
    doc.fillColor(INK).font("Helvetica").fontSize(size);
    let cursor = y;
    for (const line of lines) {
      const text = pdfSafe(line);
      doc.text(text, x, cursor, { width });
      cursor += doc.heightOfString(text, { width }) + 2;
    }
    return cursor;
  }

  private heading(doc: Doc, text: string, x: number, y: number, width: number): number {
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10).text(pdfSafe(text.toUpperCase()), x, y, { width, characterSpacing: 0.6 });
    doc.save().moveTo(x, y + 15).lineTo(x + width, y + 15).lineWidth(0.8).strokeColor(ACCENT).stroke().restore();
    return y + 21;
  }

  private drawCarneSummary(doc: Doc, c: CarneContent): void {
    const width = this.contentWidth;
    this.band(doc, MARGIN, "Carnê de pagamento", c.storeName);
    let y = this.lines(doc, c.store.slice(1), MARGIN, MARGIN + 66, width, 9);

    y += 12;
    const colWidth = (width - 24) / 2;
    const left = this.heading(doc, "Cliente", MARGIN, y, colWidth);
    const right = this.heading(doc, "Venda", MARGIN + colWidth + 24, y, colWidth);
    const leftEnd = this.lines(doc, c.customer, MARGIN, left, colWidth);
    const rightEnd = this.lines(doc, c.sale, MARGIN + colWidth + 24, right, colWidth);
    y = Math.max(leftEnd, rightEnd) + 14;

    y = this.heading(doc, "Resumo do financiamento", MARGIN, y, width);
    const labelWidth = 150;
    const valueWidth = width - labelWidth - 24;
    c.summary.forEach((row, index) => {
      const value = pdfSafe(row.value);
      const strong = row.label === "Total a prazo";
      doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 12 : 10.5);
      const height = Math.max(doc.heightOfString(value, { width: valueWidth }), 14) + 12;
      if (index % 2 === 0 || strong) doc.save().rect(MARGIN, y, width, height).fill(ACCENT_SOFT).restore();
      doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(pdfSafe(row.label), MARGIN + 12, y + 6, { width: labelWidth });
      doc.fillColor(INK).font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 12 : 10.5).text(value, MARGIN + labelWidth + 12, y + 6, { width: valueWidth, align: "right" });
      y += height;
    });

    y += 18;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(
      pdfSafe(
        `Pague cada parcela até a data de vencimento indicada no canhoto. Apresente este carnê ao pagar e guarde os comprovantes. ` +
          `Em caso de dúvida, procure a loja: ${c.store[0]}${c.store[3] ? ` - ${c.store[3]}` : ""}.`,
      ),
      MARGIN,
      y,
      { width, align: "left" },
    );
  }

  private drawStub(doc: Doc, c: CarneContent, index: number, y: number): void {
    const stub = c.stubs[index];
    const width = this.contentWidth;
    const x = MARGIN;
    // Contorno tracejado (linha de corte) e faixa de cor à esquerda.
    doc.save().roundedRect(x, y, width, STUB_HEIGHT, 6).dash(4, { space: 3 }).lineWidth(0.8).strokeColor(RULE).stroke().undash().restore();
    doc.save().rect(x, y, 10, STUB_HEIGHT).fill(ACCENT).restore();

    const inner = x + 28;
    const innerWidth = width - 28 - 18;
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(pdfSafe(c.storeName), inner, y + 16, { width: innerWidth - 120, lineBreak: false, ellipsis: true });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text(`Parcela ${stub.number}`, inner, y + 14, { width: innerWidth, align: "right", lineBreak: false });
    doc.save().moveTo(inner, y + 40).lineTo(inner + innerWidth, y + 40).lineWidth(0.5).strokeColor(RULE).stroke().restore();

    const half = innerWidth / 2;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("VENCIMENTO", inner, y + 52, { width: half, lineBreak: false });
    doc.text("VALOR", inner + half, y + 52, { width: half, lineBreak: false });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(stub.dueDate, inner, y + 66, { width: half, lineBreak: false });
    doc.text(stub.amount, inner + half, y + 66, { width: half, lineBreak: false });

    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(pdfSafe(`Cliente: ${c.stubOwner}`), inner, y + 106, { width: innerWidth, lineBreak: false, ellipsis: true });
    doc.text(pdfSafe(`Venda #${c.saleCode}`), inner, y + 121, { width: innerWidth, lineBreak: false });

    // Espaço para assinatura e data do pagamento.
    const lineY = y + STUB_HEIGHT - 52;
    const signWidth = innerWidth * 0.62;
    doc.save().lineWidth(0.7).strokeColor(INK);
    doc.moveTo(inner, lineY).lineTo(inner + signWidth, lineY).stroke();
    doc.moveTo(inner + signWidth + 18, lineY).lineTo(inner + innerWidth, lineY).stroke().restore();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    doc.text("Assinatura", inner, lineY + 4, { width: signWidth, lineBreak: false });
    doc.text("Data do pagamento", inner + signWidth + 18, lineY + 4, { width: innerWidth - signWidth - 18, lineBreak: false });
  }

  private drawReceipt(doc: Doc, c: ReceiptContent): void {
    const width = this.contentWidth;
    this.band(doc, MARGIN, c.title, c.store[0]);
    let y = this.lines(doc, c.store.slice(1), MARGIN, MARGIN + 66, width, 9);

    y += 14;
    y = this.heading(doc, "Cliente", MARGIN, y, width);
    y = this.lines(doc, c.customer, MARGIN, y, width) + 10;

    doc.fillColor(INK).font("Helvetica").fontSize(11).text(pdfSafe(c.statement), MARGIN, y, { width, align: "left" });
    y += doc.heightOfString(pdfSafe(c.statement), { width }) + 16;

    y = this.heading(doc, "Detalhes do pagamento", MARGIN, y, width);
    const labelWidth = 190;
    const valueWidth = width - labelWidth - 24;
    c.lines.forEach((row, index) => {
      const total = row.label === "Total recebido";
      const value = pdfSafe(row.value);
      doc.font(total ? "Helvetica-Bold" : "Helvetica").fontSize(total ? 13 : 10.5);
      const height = Math.max(doc.heightOfString(value, { width: valueWidth }), 14) + 12;
      if (index % 2 === 0 || total) doc.save().rect(MARGIN, y, width, height).fill(ACCENT_SOFT).restore();
      doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(pdfSafe(row.label), MARGIN + 12, y + 6, { width: labelWidth });
      doc.fillColor(INK).font(total ? "Helvetica-Bold" : "Helvetica").fontSize(total ? 13 : 10.5).text(value, MARGIN + labelWidth + 12, y + 6, { width: valueWidth, align: "right" });
      y += height;
    });

    y += 56;
    const signWidth = 260;
    doc.save().lineWidth(0.7).strokeColor(INK).moveTo(MARGIN, y).lineTo(MARGIN + signWidth, y).stroke().restore();
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(pdfSafe(c.receivedBy ? `Recebido por ${c.receivedBy}` : "Assinatura de quem recebeu"), MARGIN, y + 5, { width: signWidth, lineBreak: false });
  }
}
