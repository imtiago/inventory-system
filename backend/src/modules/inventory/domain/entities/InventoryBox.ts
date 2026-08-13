import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export interface InventoryBoxProps {
  id?: string;
  code: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InventoryBox extends BaseEntity {
  private _code: string;
  private _updatedAt: Date;

  constructor(readonly props: InventoryBoxProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this._code = props.code;
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get code(): string {
    return this._code;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
