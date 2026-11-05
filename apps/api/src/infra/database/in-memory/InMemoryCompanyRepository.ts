import { Company } from '../../../domain/entities/Company.js';
import { Cnpj } from '../../../domain/value-objects/Cnpj.js';
import {
  CreateCompanyRecord,
  ICompanyRepository,
} from '../../../application/ports/ICompanyRepository.js';

export class InMemoryCompanyRepository implements ICompanyRepository {
  private readonly companies: Company[] = [];
  private nextId = 1;

  public async findByCnpj(cnpj: string): Promise<Company | null> {
    const cleaned = cnpj.replace(/\D/g, '');
    return this.companies.find((c) => c.cnpj.value === cleaned) ?? null;
  }

  public async findById(id: number): Promise<Company | null> {
    return this.companies.find((c) => c.id === id) ?? null;
  }

  public async create(data: CreateCompanyRecord): Promise<Company> {
    const company = Company.create({
      id: this.nextId++,
      cnpj: Cnpj.create(data.cnpj),
      tradeName: data.tradeName,
    });
    this.companies.push(company);
    return company;
  }
}
