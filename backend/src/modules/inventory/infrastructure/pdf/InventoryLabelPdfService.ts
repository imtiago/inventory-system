import PDFDocument from "pdfkit";
import { Writable } from "stream";

export interface ProductLabel {
  boxCode: string;
  productCode: string;
}

export class InventoryLabelPdfService {
  /**
   * Label size: 50mm x 30mm
   *
   * PDF uses points:
   * 1mm = 2.83465pt
   */
  private readonly pageWidth = 50 * 2.83465;
  private readonly pageHeight = 30 * 2.83465;

  private readonly margin = 5;

  private readonly contentWidth = this.pageWidth - this.margin * 2;

  private readonly contentHeight = this.pageHeight - this.margin * 2;

  async generateBoxLabel(boxCode: string): Promise<Buffer> {
    const document = new PDFDocument({
      size: [this.pageWidth, this.pageHeight],

      margins: {
        top: this.margin,
        bottom: this.margin,
        left: this.margin,
        right: this.margin,
      },
    });

    return this.generateBuffer(document, () => {
      document.fontSize(24).font("Helvetica-Bold");

      this.drawCenteredText(document, boxCode);
    });
  }

  async generateProductLabels(labels: ProductLabel[]): Promise<Buffer> {
    const document = new PDFDocument({
      size: [this.pageWidth, this.pageHeight],

      margins: {
        top: this.margin,
        bottom: this.margin,
        left: this.margin,
        right: this.margin,
      },
    });

    labels.forEach((label, index) => {
      if (index > 0) {
        document.addPage({
          size: [this.pageWidth, this.pageHeight],

          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin,
          },
        });
      }

      const text = `${label.boxCode} - ${label.productCode}`;

      document.fontSize(16).font("Helvetica-Bold");

      this.drawCenteredText(document, text);
    });

    return this.generateBuffer(document);
  }

  private drawCenteredText(
    document: InstanceType<typeof PDFDocument>,
    text: string,
  ): void {
    const textHeight = document.heightOfString(text, {
      width: this.contentWidth,
      align: "center",
    });

    const y = this.margin + (this.contentHeight - textHeight) / 2;

    document.text(text, this.margin, y, {
      width: this.contentWidth,
      align: "center",
      lineBreak: false,
    });
  }

  private generateBuffer(
    document: InstanceType<typeof PDFDocument>,
    render?: () => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));

          callback();
        },
      });

      writable.on("finish", () => {
        resolve(Buffer.concat(chunks));
      });

      writable.on("error", reject);

      document.pipe(writable);

      if (render) {
        render();
      }

      document.end();
    });
  }
}
