export interface ProductProps {
  id?: string;
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
  createdAt?: Date;
}

export class Product {
  id?: string;
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
  createdAt: Date;

  constructor(props: ProductProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.brandId = props.brandId;
    this.categoryId = props.categoryId;
    this.createdAt = props.createdAt ?? new Date();
  }
}
