export class ProductVariant {
  id: string;
  productId: string;
  code: string; // código da NF ou SKU
  barcode: string; // ✅ código de barras
  unit: string;
  stock: number;
  price?: number;
  createdAt: Date;

  constructor(props: {
    id: string;
    productId: string;
    code: string;
    barcode: string; // obrigatório
    unit: string;
    stock?: number;
    price?: number;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.productId = props.productId;
    this.code = props.code;
    this.barcode = props.barcode; // salva o código de barras
    this.unit = props.unit;
    this.stock = props.stock ?? 0;
    this.price = props.price;
    this.createdAt = props.createdAt ?? new Date();
  }
}
