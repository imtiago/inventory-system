import { v4 as uuid } from "uuid";

// src/modules/catalog/domain/entities/Product.ts
export class Product {
  private _id: string;
  private _name: string;
  private _description: string | null;
  private _brandId: string;
  private _categoryId: string;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    description?: string | null; // <- aceitar null
    brandId: string;
    categoryId: string;
    createdAt?: Date;
  }) {
    this._id = props.id || uuid();
    this._name = props.name;
    this._description = props.description ?? null; // garante null
    this._brandId = props.brandId;
    this._categoryId = props.categoryId;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  get description() {
    return this._description;
  }

  get brandId() {
    return this._brandId;
  }

  get categoryId() {
    return this._categoryId;
  }

  get createdAt() {
    return this._createdAt;
  }
}
