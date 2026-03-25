import { NfeItem } from "../../domain/entities/NfeItem";
import pdf from "@cedrugs/pdf-parse"; // ✔ ES Module + Tipado

export class ParsePdfService {
  async parseBuffer(buffer: Buffer): Promise<NfeItem[]> {
    const data = await pdf(buffer);
    const text = data.text;

    // 1️⃣ Extrair linhas do PDF
    const lines = text.split("\n");

    // 2️⃣ Extrair apenas as linhas dos produtos
    const itemsNf: string[] = [];
    let control = false;

    for (const line of lines) {
      if (
        line ===
        "RECEBEMOS DE A. D. T. J. B. DISTRIBUIDORA LTDA OS PRODUTOS/SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO "
      )
        control = false;

      if (control) itemsNf.push(line);
      if (line === "TRIB.") control = true;
    }

    // 3️⃣ Agrupar itens de 3 em 3 (linha de produto)
    const listProds: string[][] = [];
    for (let i = 0; i < itemsNf.length; i += 3) {
      listProds.push(itemsNf.slice(i, i + 3));
    }
    const parseName = (line: string) => {
      const match = line.match(/^(\d+)(.*)$/);

      if (match) {
        const code = match[1]; // números iniciais
        const name = match[2].trim(); // resto da linha
        return { code, name };
      }

      // fallback se não encontrar números
      return { code: "UNKNOWN", name: line.trim() };
    };

    const parseQuantityPrice = (line: string) => {
      const match = line.match(/UN(.{5})(.{5})/);
      if (!match) return { quantity: 0, price: 0 };

      const quantity = parseInt(match[1].split(",")[0], 10);
      const price = parseFloat(match[2].replace(",", "."));
      return { quantity, price };
    };

    // 5️⃣ Construir objetos NfeItem com code único
    const items: NfeItem[] = listProds.map((row, index) => {
      const { code, name } = parseName(row[0]);
      const { quantity, price } = row[2]
        ? parseQuantityPrice(row[2])
        : { quantity: 0, price: 0 };
      const systemCode = `EXT-BOT-${code}`; // único por item

      return new NfeItem({
        code: systemCode,
        name,
        quantity,
        price,
        unit: "UN",
      });
    });

    return items;
  }
}
