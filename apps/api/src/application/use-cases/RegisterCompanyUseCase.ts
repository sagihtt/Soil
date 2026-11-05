import { Company } from '../../domain/entities/Company.js';
import { DuplicateResourceError } from '../../domain/errors/DomainErrors.js';
import { Cnpj } from '../../domain/value-objects/Cnpj.js';
import { ICompanyRepository } from '../ports/ICompanyRepository.js';

export interface RegisterCompanyInput {
  cnpj: string;
  tradeName: string;
}

export class RegisterCompanyUseCase {
  public constructor(private readonly companyRepository: ICompanyRepository) {}

  public async execute(input: RegisterCompanyInput): Promise<Company> {
    const cnpj = Cnpj.create(input.cnpj);

    const existing = await this.companyRepository.findByCnpj(cnpj.value);
    if (existing !== null) {
      throw new DuplicateResourceError('Já existe uma empresa cadastrada com este CNPJ.');
    }

    // Valida regras de domínio da entidade antes de persistir
    Company.create({
      id: 1,
      cnpj,
      tradeName: input.tradeName,
    });

    return this.companyRepository.create({
      cnpj: cnpj.value,
      tradeName: input.tradeName.trim(),
    });
  }
}
