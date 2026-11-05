import { Company } from '../../domain/entities/Company.js';

export interface CreateCompanyRecord {
  cnpj: string;
  tradeName: string;
}

export interface ICompanyRepository {
  findByCnpj(cnpj: string): Promise<Company | null>;
  findById(id: number): Promise<Company | null>;
  create(data: CreateCompanyRecord): Promise<Company>;
}
