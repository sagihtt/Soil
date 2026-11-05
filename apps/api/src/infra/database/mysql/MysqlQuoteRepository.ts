import { QuoteProfile, QuoteStatus } from '@soil/shared';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { IQuoteRepository } from '../../../application/ports/IQuoteRepository.js';
import { Quote, QuoteItem } from '../../../domain/entities/Quote.js';
import { Money } from '../../../domain/value-objects/Money.js';

interface QuoteRow extends RowDataPacket {
  id: number;
  company_id: number;
  user_id: number;
  client_id: number | null;
  vehicle_id: number;
  profile: QuoteProfile;
  total_cents: number;
  status: QuoteStatus;
  sent_at: Date | null;
}

interface QuoteItemRow extends RowDataPacket {
  quote_id: number;
  product_id: number;
  product_name: string;
  manufacturer: string;
  quantity: number;
  unit_price_cents: number;
}

export class MysqlQuoteRepository implements IQuoteRepository {
  public constructor(private readonly pool: Pool) {}

  private async loadItemsForQuote(quoteId: number): Promise<QuoteItem[]> {
    const [rows] = await this.pool.execute<QuoteItemRow[]>(
      `SELECT
         qi.quote_id,
         qi.product_id,
         p.name AS product_name,
         p.manufacturer,
         qi.quantity,
         qi.unit_price_cents
       FROM quote_item qi
       INNER JOIN product p ON p.id = qi.product_id
       WHERE qi.quote_id = ?
       ORDER BY qi.id ASC`,
      [quoteId],
    );

    return rows.map(
      (r) =>
        new QuoteItem({
          productId: r.product_id,
          productName: r.product_name,
          manufacturer: r.manufacturer,
          quantity: Number(r.quantity),
          unitPrice: Money.fromPositiveCents(r.unit_price_cents),
        }),
    );
  }

  public async findByIdAndCompany(id: number, companyId: number): Promise<Quote | null> {
    const [rows] = await this.pool.execute<QuoteRow[]>(
      'SELECT id, company_id, user_id, client_id, vehicle_id, profile, total_cents, status, sent_at FROM quote WHERE id = ? AND company_id = ? LIMIT 1',
      [id, companyId],
    );
    const first = rows[0];
    if (!first) return null;

    const items = await this.loadItemsForQuote(first.id);
    return new Quote({
      id: first.id,
      companyId: first.company_id,
      userId: first.user_id,
      vehicleId: first.vehicle_id,
      clientId: first.client_id,
      profile: first.profile,
      items,
      status: first.status,
      sentAt: first.sent_at ? new Date(first.sent_at) : null,
    });
  }

  public async save(quote: Quote): Promise<Quote> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      let quoteId = quote.id;

      if (quoteId === 0) {
        const [resQuote] = await conn.execute<ResultSetHeader>(
          'INSERT INTO quote (company_id, user_id, client_id, vehicle_id, profile, total_cents, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            quote.companyId,
            quote.userId,
            quote.clientId,
            quote.vehicleId,
            quote.profile,
            quote.totalAmount.cents,
            quote.status,
            quote.sentAt,
          ],
        );
        quoteId = resQuote.insertId;
      } else {
        await conn.execute(
          'UPDATE quote SET client_id = ?, profile = ?, total_cents = ?, status = ?, sent_at = ? WHERE id = ? AND company_id = ?',
          [
            quote.clientId,
            quote.profile,
            quote.totalAmount.cents,
            quote.status,
            quote.sentAt,
            quoteId,
            quote.companyId,
          ],
        );
        await conn.execute('DELETE FROM quote_item WHERE quote_id = ?', [quoteId]);
      }

      for (const item of quote.items) {
        await conn.execute(
          'INSERT INTO quote_item (quote_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)',
          [quoteId, item.productId, item.quantity, item.unitPrice.cents],
        );
      }

      await conn.commit();

      return new Quote({
        id: quoteId,
        companyId: quote.companyId,
        userId: quote.userId,
        vehicleId: quote.vehicleId,
        clientId: quote.clientId,
        profile: quote.profile,
        items: [...quote.items],
        status: quote.status,
        sentAt: quote.sentAt,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async listByCompany(companyId: number): Promise<Quote[]> {
    const [rows] = await this.pool.execute<QuoteRow[]>(
      'SELECT id, company_id, user_id, client_id, vehicle_id, profile, total_cents, status, sent_at FROM quote WHERE company_id = ? ORDER BY created_at DESC LIMIT 50',
      [companyId],
    );

    const quotes: Quote[] = [];
    for (const row of rows) {
      const items = await this.loadItemsForQuote(row.id);
      quotes.push(
        new Quote({
          id: row.id,
          companyId: row.company_id,
          userId: row.user_id,
          vehicleId: row.vehicle_id,
          clientId: row.client_id,
          profile: row.profile,
          items,
          status: row.status,
          sentAt: row.sent_at ? new Date(row.sent_at) : null,
        }),
      );
    }
    return quotes;
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM quote WHERE id = ? AND company_id = ?',
      [id, companyId],
    );
    return result.affectedRows > 0;
  }
}
