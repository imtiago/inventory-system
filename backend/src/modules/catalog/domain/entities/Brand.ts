// backend/src/modules/catalog/domain/entities/Brand.ts
export interface BrandProps {
  id: string;
  name: string;
  createdAt?: Date;
}

export class Brand {
  id: string;
  name: string;
  createdAt: Date;

  constructor(props: BrandProps) {
    this.id = props.id;
    this.name = props.name;
    this.createdAt = props.createdAt ?? new Date();
  }
}
