import { v4 as uuid } from "uuid";

// backend/src/modules/catalog/domain/entities/Category.ts
export class Category {
  id: string;
  name: string;
  createdAt: Date;

  constructor(props: { id?: string; name: string; createdAt?: Date }) {
    this.id = props.id ?? uuid();
    this.name = props.name;
    this.createdAt = props.createdAt ?? new Date();
  }
}
