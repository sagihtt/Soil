import { QuoteProfile } from '@soil/shared';
import { Product } from '../../domain/entities/Product.js';
import { Quote, QuoteItem } from '../../domain/entities/Quote.js';
import {
  DomainValidationError,
  ResourceNotFoundError,
} from '../../domain/errors/DomainErrors.js';
import { Money } from '../../domain/value-objects/Money.js';
import { ICatalogRepository } from '../ports/ICatalogRepository.js';
import { IClientRepository } from '../ports/IClientRepository.js';
import { IMailService } from '../ports/IMailService.js';
import { IProductRepository } from '../ports/IProductRepository.js';
import { IQuoteRepository } from '../ports/IQuoteRepository.js';
import { IVehicleRepository } from '../ports/IVehicleRepository.js';

export interface QuoteOptionTierItem {
  catalogId: number;
  productId: number;
  productName: string;
  manufacturer: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface QuoteOptionTierSummary {
  profile: QuoteProfile;
  items: QuoteOptionTierItem[];
  totalAmount: number;
}

export interface IQuoteSelectionStrategy {
  readonly profile: QuoteProfile;
  selectProduct(candidates: readonly Product[]): Product | null;
}

class CheapestQuoteStrategy implements IQuoteSelectionStrategy {
  public readonly profile = QuoteProfile.CHEAPEST;

  public selectProduct(candidates: readonly Product[]): Product | null {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => a.price.cents - b.price.cents)[0] ?? null;
  }
}

class MostExpensiveQuoteStrategy implements IQuoteSelectionStrategy {
  public readonly profile = QuoteProfile.MOST_EXPENSIVE;

  public selectProduct(candidates: readonly Product[]): Product | null {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.price.cents - a.price.cents)[0] ?? null;
  }
}

class BestQualityQuoteStrategy implements IQuoteSelectionStrategy {
  public readonly profile = QuoteProfile.BEST_QUALITY;

  public selectProduct(candidates: readonly Product[]): Product | null {
    if (candidates.length === 0) return null;
    return (
      [...candidates].sort((a, b) => {
        if (a.isBestQuality !== b.isBestQuality) {
          return a.isBestQuality ? -1 : 1;
        }
        return b.price.cents - a.price.cents;
      })[0] ?? null
    );
  }
}

export class GenerateQuoteOptionsUseCase {
  private readonly cheapestStrategy = new CheapestQuoteStrategy();
  private readonly mostExpensiveStrategy = new MostExpensiveQuoteStrategy();
  private readonly bestQualityStrategy = new BestQualityQuoteStrategy();

  public constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly catalogRepository: ICatalogRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  public async execute(params: { companyId: number; vehicleId: number }): Promise<{
    cheapest: QuoteOptionTierSummary;
    bestQuality: QuoteOptionTierSummary;
    mostExpensive: QuoteOptionTierSummary;
  }> {
    const vehicle = await this.vehicleRepository.findById(params.vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('Veículo não encontrado para cálculo de orçamento.');
    }

    const specs = await this.catalogRepository.listSpecsForVehicle(vehicle.id);
    const catalogIds = specs.map((s) => s.catalog.id);
    const products = await this.productRepository.listByCompanyAndCatalogIds(
      params.companyId,
      catalogIds,
    );

    const buildTier = (strategy: IQuoteSelectionStrategy): QuoteOptionTierSummary => {
      const items: QuoteOptionTierItem[] = [];
      let total = Money.zero();

      for (const { spec, catalog } of specs) {
        const candidates = products.filter(
          (p) => p.catalogId === catalog.id && p.isAvailable,
        );
        const chosen = strategy.selectProduct(candidates);
        if (!chosen) continue;

        const quantity = spec.capacityLiters ?? 1;
        const subtotal = chosen.price.multiply(quantity);
        total = total.add(subtotal);

        items.push({
          catalogId: catalog.id,
          productId: chosen.id,
          productName: chosen.name,
          manufacturer: chosen.manufacturer,
          quantity,
          unitPrice: chosen.price.toDecimal(),
          subtotal: subtotal.toDecimal(),
        });
      }

      return {
        profile: strategy.profile,
        items,
        totalAmount: total.toDecimal(),
      };
    };

    return {
      cheapest: buildTier(this.cheapestStrategy),
      bestQuality: buildTier(this.bestQualityStrategy),
      mostExpensive: buildTier(this.mostExpensiveStrategy),
    };
  }
}

export class CreateOrUpdateQuoteUseCase {
  public constructor(
    private readonly quoteRepository: IQuoteRepository,
    private readonly productRepository: IProductRepository,
    private readonly clientRepository: IClientRepository,
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  public async execute(input: {
    quoteId?: number;
    companyId: number;
    userId: number;
    vehicleId: number;
    clientId: number | null;
    profile: QuoteProfile;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice?: number;
    }>;
  }): Promise<Quote> {
    const vehicle = await this.vehicleRepository.findById(input.vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('Veículo não encontrado.');
    }

    if (input.clientId !== null) {
      const client = await this.clientRepository.findByIdAndCompany(
        input.clientId,
        input.companyId,
      );
      if (client === null) {
        throw new ResourceNotFoundError('Cliente destinatário não pertence a esta empresa.');
      }
    }

    const quoteItems: QuoteItem[] = [];
    for (const rawItem of input.items) {
      const product = await this.productRepository.findByIdAndCompany(
        rawItem.productId,
        input.companyId,
      );
      if (product === null) {
        throw new ResourceNotFoundError(
          `Produto #${rawItem.productId} não pertence ao estoque desta empresa.`,
        );
      }

      const unitPrice =
        rawItem.unitPrice !== undefined
          ? Money.fromPositiveDecimal(rawItem.unitPrice)
          : product.price;

      quoteItems.push(
        new QuoteItem({
          productId: product.id,
          productName: product.name,
          manufacturer: product.manufacturer,
          quantity: rawItem.quantity,
          unitPrice,
        }),
      );
    }

    if (input.quoteId !== undefined) {
      const existing = await this.quoteRepository.findByIdAndCompany(
        input.quoteId,
        input.companyId,
      );
      if (existing === null) {
        throw new ResourceNotFoundError('Orçamento não encontrado para esta empresa.');
      }
      existing.updateItems(quoteItems, input.profile, input.clientId);
      return this.quoteRepository.save(existing);
    }

    const draft = new Quote({
      id: 0,
      companyId: input.companyId,
      userId: input.userId,
      vehicleId: input.vehicleId,
      clientId: input.clientId,
      profile: input.profile,
      items: quoteItems,
    });

    return this.quoteRepository.save(draft);
  }
}

export class SendQuoteEmailUseCase {
  public constructor(
    private readonly quoteRepository: IQuoteRepository,
    private readonly clientRepository: IClientRepository,
    private readonly vehicleRepository: IVehicleRepository,
    private readonly mailService: IMailService,
  ) {}

  public async execute(params: { companyId: number; quoteId: number }): Promise<Quote> {
    const quote = await this.quoteRepository.findByIdAndCompany(
      params.quoteId,
      params.companyId,
    );
    if (quote === null) {
      throw new ResourceNotFoundError('Orçamento não encontrado.');
    }

    if (quote.clientId === null) {
      throw new DomainValidationError(
        'Selecione um cliente destinatário antes de enviar o orçamento por e-mail.',
      );
    }

    const client = await this.clientRepository.findByIdAndCompany(
      quote.clientId,
      params.companyId,
    );
    if (client === null) {
      throw new ResourceNotFoundError('Cliente destinatário não encontrado.');
    }

    const vehicle = await this.vehicleRepository.findById(quote.vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('Veículo do orçamento não encontrado.');
    }

    const rowsHtml = quote.items
      .map(
        (item) =>
          `<tr><td>${item.productName} (${item.manufacturer})</td><td>${item.quantity}</td><td>R$ ${item.unitPrice.toDecimal().toFixed(2)}</td><td>R$ ${item.subtotal.toDecimal().toFixed(2)}</td></tr>`,
      )
      .join('');

    const html = `
      <div>
        <h2>Orçamento de Troca de Óleo e Filtros - ${vehicle.fullLabel}</h2>
        <p>Olá, ${client.name}!</p>
        <table>
          <thead><tr><th>Produto</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p><strong>Total: R$ ${quote.totalAmount.toDecimal().toFixed(2)}</strong></p>
      </div>
    `;

    await this.mailService.sendEmail({
      to: client.email.value,
      subject: `Orçamento Troca de Óleo e Filtros - ${vehicle.fullLabel}`,
      html,
    });

    quote.markAsSent();
    return this.quoteRepository.save(quote);
  }
}

export class DeleteQuoteUseCase {
  public constructor(private readonly quoteRepository: IQuoteRepository) {}

  public async execute(params: { companyId: number; quoteId: number }): Promise<void> {
    const deleted = await this.quoteRepository.deleteByIdAndCompany(
      params.quoteId,
      params.companyId,
    );
    if (!deleted) {
      throw new ResourceNotFoundError('Orçamento não encontrado para esta empresa.');
    }
  }
}
