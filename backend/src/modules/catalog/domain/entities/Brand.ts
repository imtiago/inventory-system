import { BaseEntity } from "@shared/domain/entities/BaseEntity";

// backend/src/modules/catalog/domain/entities/Brand.ts
export class Brand extends BaseEntity {
  private _name: string;

  constructor(props: { id?: string; name: string; createdAt?: Date }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._name = props.name;
  }

  get name(): string {
    return this._name;
  }

  rename(name: string): void {
    this._name = name;
  }
}
