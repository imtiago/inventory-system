
export interface NumberRangeRepository {
  getNextValue(name: string): Promise<number>;
}
