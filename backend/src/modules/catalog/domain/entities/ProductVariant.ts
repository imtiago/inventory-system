export interface ProductVariantProps {
  id?: string;
  name: string;
  sku: string;
  productId: string;
  createdAt?: Date;
}

export class ProductVariant {
  id?: string;
  name: string;
  sku: string;
  productId: string;
  createdAt: Date;

  constructor(props: ProductVariantProps) {
    this.id = props.id;
    this.name = props.name;
    this.sku = props.sku;
    this.productId = props.productId;
    this.createdAt = props.createdAt ?? new Date();
  }
}
