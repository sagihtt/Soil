import { Quote } from '../../domain/entities/Quote.js';

export interface IQuoteRepository {
  findByIdAndCompany(id: number, companyId: number): Promise<Quote | null>;
  save(quote: Quote): Promise<Quote>;
  listByCompany(companyId: number): Promise<Quote[]>;
  deleteByIdAndCompany(id: number, companyId: number): Promise<boolean>;
}
