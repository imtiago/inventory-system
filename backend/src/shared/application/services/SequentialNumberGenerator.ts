import { NumberGenerator } from "./NumberGenerator";
import { NumberRangeRepository } from "@shared/domain/repositories/NumberRangeRepository";

export class SequentialNumberGenerator implements NumberGenerator {
  constructor(private repository: NumberRangeRepository) {}

  async generate(range: string, prefix: string): Promise<string> {
    const number = await this.repository.getNextValue(range);

    return `${prefix}${String(number).padStart(6, "0")}`;
  }
}
