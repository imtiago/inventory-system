import { v4 as uuid } from "uuid";

export class ProductVariant {
  id: string;
  productId: string;
  code: string; // SKU ou código NF
  name: string;
  barcode: string | null;
  unit: string;
  stock: number;
  price: number | null;
  createdAt: Date;

  constructor(props: {
    id?: string;
    productId: string;
    code: string;
    name?: string;
    barcode?: string | null;
    unit: string;
    stock?: number;
    price?: number | null;
    createdAt?: Date;
  }) {
    this.id = props.id ?? uuid();
    this.productId = props.productId;
    this.code = props.code;
    this.name = props.name ?? "Padrão";
    this.barcode = props.barcode ?? null;
    this.unit = props.unit;
    this.stock = props.stock ?? 0;
    this.price = props.price ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}
