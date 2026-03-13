// backend/src/modules/catalog/domain/entities/Category.ts
export interface CategoryProps {
  id: string;
  name: string;
  createdAt?: Date;
}

export class Category {
  id: string;
  name: string;
  createdAt: Date;

  constructor(props: CategoryProps) {
    this.id = props.id;
    this.name = props.name;
    this.createdAt = props.createdAt ?? new Date();
  }
}
