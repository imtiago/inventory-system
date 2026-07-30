import { v4 as uuid } from "uuid";

export interface BaseEntityProps {
  id?: string;
  createdAt?: Date;
}

export abstract class BaseEntity {
  protected readonly _id: string;

  protected readonly _createdAt: Date;

  constructor(props: BaseEntityProps = {}) {
    this._id = props.id ?? uuid();

    this._createdAt = props.createdAt ?? new Date();
  }

  public get id(): string {
    return this._id;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }
}
