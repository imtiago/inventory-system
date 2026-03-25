// src/modules/catalog/domain/entities/Product.ts
export class Product {
  id: string;
  name: string;
  code: string; // ✅ código do produto (cProd da NF)
  description?: string | null; // <- aceitar null
  brandId: string;
  categoryId: string;
  createdAt: Date;

  constructor(props: {
    id: string;
    code: string; // ✅ código do produto (cProd da NF)
    name: string;
    description?: string | null; // <- aceitar null
    brandId: string;
    categoryId: string;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.description = props.description ?? null; // garante null
    this.brandId = props.brandId;
    this.categoryId = props.categoryId;
    this.createdAt = props.createdAt ?? new Date();
  }
}
