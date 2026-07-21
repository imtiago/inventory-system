export interface NumberGenerator {
  generate(range: string, prefix: string): Promise<string>;
}
