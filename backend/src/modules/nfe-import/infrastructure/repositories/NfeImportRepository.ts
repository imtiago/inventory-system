import { NfeItem } from "../../domain/entities/NfeItem";

interface NfeImportRecord {
  filePath: string;
  items: NfeItem[];
  createdAt: Date;
}

export class NfeImportRepository {
  private imports: NfeImportRecord[] = [];

  async save(filePath: string, items: NfeItem[]): Promise<void> {
    this.imports.push({
      filePath,
      items,
      createdAt: new Date(),
    });
    console.log(`NF-e imported from file: ${filePath}`);
  }

  async getAll(): Promise<NfeImportRecord[]> {
    return this.imports;
  }
}
