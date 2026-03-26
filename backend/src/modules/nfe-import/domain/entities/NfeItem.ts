// src/modules/nfe-import/domain/entities/NfeItem.ts
export class NfeItem {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;

  constructor(props: {
    code: string;
    name: string;
    quantity?: number;
    unit: string;
    price?: number;
  }) {
    this.code = props.code;
    this.name = props.name;
    this.quantity = props.quantity ?? 0;
    this.unit = props.unit;
    this.price = props.price ?? 0;
  }
}
