import { CategoryDTO } from "../dto/CategoryDTO";

export class CategoryReadMapper {
  static toDTO(row: { id: string; name: string; productsCount: number; targetMarginBps?: number | null }): CategoryDTO {
    const dto: CategoryDTO = { id: row.id, name: row.name, productsCount: row.productsCount };
    if (row.targetMarginBps !== undefined) dto.targetMarginBps = row.targetMarginBps;
    return dto;
  }
}
