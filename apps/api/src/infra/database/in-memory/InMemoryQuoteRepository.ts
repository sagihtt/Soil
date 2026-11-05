import { IQuoteRepository } from '../../../application/ports/IQuoteRepository.js';
import { Quote } from '../../../domain/entities/Quote.js';

export class InMemoryQuoteRepository implements IQuoteRepository {
  private readonly quotes: Quote[] = [];
  private nextId = 1;

  public async findByIdAndCompany(id: number, companyId: number): Promise<Quote | null> {
    return this.quotes.find((q) => q.id === id && q.companyId === companyId) ?? null;
  }

  public async save(quote: Quote): Promise<Quote> {
    if (quote.id === 0) {
      const created = new Quote({
        id: this.nextId++,
        companyId: quote.companyId,
        userId: quote.userId,
        vehicleId: quote.vehicleId,
        clientId: quote.clientId,
        profile: quote.profile,
        items: [...quote.items],
        status: quote.status,
        sentAt: quote.sentAt,
      });
      this.quotes.push(created);
      return created;
    }

    const idx = this.quotes.findIndex((q) => q.id === quote.id);
    if (idx !== -1) {
      this.quotes[idx] = quote;
    } else {
      this.quotes.push(quote);
    }
    return quote;
  }

  public async listByCompany(companyId: number): Promise<Quote[]> {
    return this.quotes.filter((q) => q.companyId === companyId);
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const idx = this.quotes.findIndex((q) => q.id === id && q.companyId === companyId);
    if (idx === -1) return false;
    this.quotes.splice(idx, 1);
    return true;
  }
}
