import { PrismaNumberRangeRepository } from "../repositories/PrismaNumberRangeRepository";
import { SequentialNumberGenerator } from "@shared/application/services/SequentialNumberGenerator";

export function makeSequentialNumberGenerator() {
  const repository = new PrismaNumberRangeRepository();

  return new SequentialNumberGenerator(repository);
}
