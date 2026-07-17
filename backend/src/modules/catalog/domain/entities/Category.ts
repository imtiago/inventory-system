import { v4 as uuid } from "uuid";

export class Category {
  private _id: string;
  private _name: string;
  private _createdAt: Date;

  constructor(props: { id?: string; name: string; createdAt?: Date }) {
    this._id = props.id ?? uuid();
    this._name = props.name;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  rename(name: string): void {
    this._name = name;
  }
}
