import { BaseEntity } from "@shared/domain/entities/BaseEntity";

// src/modules/catalog/domain/entities/Product.ts
export class Product extends BaseEntity {
  private _name: string;
  private _code: string;
  private _description: string | null;
  private _brandId: string;
  private _categoryId: string;

  constructor(props: {
    id?: string;
    name: string;
    code: string;
    description?: string | null; // <- aceitar null
    brandId: string;
    categoryId: string;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._name = props.name;
    this._code = props.code;
    this._description = props.description ?? null; // garante null
    this._brandId = props.brandId;
    this._categoryId = props.categoryId;
  }

  get name() {
    return this._name;
  }

  get code() {
    return this._code;
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
}
