import { BusinessRuleError } from "./BusinessRuleError";

/** Exportação com mais linhas que o limite (422). */
export class ExportTooLargeError extends BusinessRuleError {
  constructor() {
    super("Muitos registros para exportar. Refine os filtros.", "EXPORT_TOO_LARGE");
  }
}
