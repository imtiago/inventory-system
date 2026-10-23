import { nfeImportNotFound } from "@nfe-import/domain/errors/nfeImportErrors";
import { NfeImportReadRepository } from "../../contracts/NfeImportReadRepository";
import { NfeImportDTO } from "../../dto/NfeImportDTO";
import { NfeImportMapper } from "../../mappers/NfeImportMapper";
import { NfeSuggestionService } from "../../services/NfeSuggestionService";

/** Detalhe com sugestões de fornecedor e de itens recalculadas a cada leitura. */
export class GetNfeImportUseCase {
  constructor(
    private readRepo: NfeImportReadRepository,
    private suggestions: NfeSuggestionService,
  ) {}

  async execute(id: string): Promise<NfeImportDTO> {
    const record = await this.readRepo.getById(id);
    if (!record) throw nfeImportNotFound();
    return NfeImportMapper.toDTO(record, await this.suggestions.suggest(record.document));
  }
}
