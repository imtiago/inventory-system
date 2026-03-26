import { v4 as uuid } from "uuid";

export class ProductVariant {
  id: string;
  productId: string;
  code: string; // código da NF ou SKU
  name: string; // código da NF ou SKU
  barcode: string; // ✅ código de barras
  unit: string;
  stock: number;
  price?: number;
  createdAt: Date;

  constructor(props: {
    id?: string;
    productId: string;
    code: string;
    name?: string;
    barcode?: string;
    unit: string;
    stock?: number;
    price?: number;
    createdAt?: Date;
  }) {
    this.id = props.id || uuid();
    this.productId = props.productId;
    this.code = props.code;
    this.name = props.name || "Padrão";
    this.barcode = props.barcode || ""; // salva o código de barras
    this.unit = props.unit;
    this.stock = props.stock ?? 0;
    this.price = props.price;
    this.createdAt = props.createdAt ?? new Date();
  }
}
