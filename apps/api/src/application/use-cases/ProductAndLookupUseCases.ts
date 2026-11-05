import { CatalogCategory, CatalogSubtype } from '@soil/shared';
import { Product } from '../../domain/entities/Product.js';
import { Vehicle } from '../../domain/entities/Vehicle.js';
import { ResourceNotFoundError } from '../../domain/errors/DomainErrors.js';
import { Money } from '../../domain/value-objects/Money.js';
import { ICatalogRepository } from '../ports/ICatalogRepository.js';
import { IProductRepository } from '../ports/IProductRepository.js';
import { IVehicleRepository } from '../ports/IVehicleRepository.js';

export class CreateProductUseCase {
  public constructor(
    private readonly catalogRepository: ICatalogRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  public async execute(input: {
    companyId: number;
    userId: number;
    catalogId: number;
    name: string;
    manufacturer: string;
    sku?: string | null;
    price: number;
    isBestQuality?: boolean;
  }): Promise<Product> {
    const price = Money.fromPositiveDecimal(input.price);

    const catalog = await this.catalogRepository.findById(input.catalogId);
    if (catalog === null) {
      throw new ResourceNotFoundError('Especificação de catálogo não encontrada.');
    }

    Product.create({
      id: 1,
      companyId: input.companyId,
      userId: input.userId,
      catalogId: input.catalogId,
      name: input.name,
      manufacturer: input.manufacturer,
      sku: input.sku ?? null,
      price,
      isBestQuality: input.isBestQuality ?? false,
    });

    return this.productRepository.create({
      companyId: input.companyId,
      userId: input.userId,
      catalogId: input.catalogId,
      name: input.name.trim(),
      manufacturer: input.manufacturer.trim(),
      sku: input.sku?.trim() ?? null,
      priceCents: price.cents,
      isBestQuality: input.isBestQuality ?? false,
    });
  }
}

export class DeleteProductUseCase {
  public constructor(private readonly productRepository: IProductRepository) {}

  public async execute(params: { companyId: number; productId: number }): Promise<void> {
    const deleted = await this.productRepository.deleteByIdAndCompany(
      params.productId,
      params.companyId,
    );
    if (!deleted) {
      throw new ResourceNotFoundError('Produto não encontrado no estoque desta empresa.');
    }
  }
}

export class UpdateProductUseCase {
  public constructor(
    private readonly catalogRepository: ICatalogRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  public async execute(input: {
    productId: number;
    companyId: number;
    catalogId: number;
    name: string;
    manufacturer: string;
    sku?: string | null;
    price: number;
    isBestQuality?: boolean;
  }): Promise<Product> {
    const price = Money.fromPositiveDecimal(input.price);

    const catalog = await this.catalogRepository.findById(input.catalogId);
    if (catalog === null) {
      throw new ResourceNotFoundError('Especificação de catálogo não encontrada.');
    }

    Product.create({
      id: input.productId,
      companyId: input.companyId,
      userId: 1,
      catalogId: input.catalogId,
      name: input.name,
      manufacturer: input.manufacturer,
      sku: input.sku ?? null,
      price,
      isBestQuality: input.isBestQuality ?? false,
    });

    const updated = await this.productRepository.update({
      id: input.productId,
      companyId: input.companyId,
      catalogId: input.catalogId,
      name: input.name.trim(),
      manufacturer: input.manufacturer.trim(),
      sku: input.sku?.trim() ?? null,
      priceCents: price.cents,
      isBestQuality: input.isBestQuality ?? false,
    });

    if (updated === null) {
      throw new ResourceNotFoundError('Produto não encontrado no estoque desta empresa.');
    }

    return updated;
  }
}

export interface BatchProductItemInput {
  id?: number | null;
  catalogId: number;
  manufacturer: string;
  sku?: string | null;
  name: string;
  price: number;
  isBestQuality?: boolean;
}

export class BatchUpsertProductsUseCase {
  public constructor(
    private readonly catalogRepository: ICatalogRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  public async execute(input: {
    companyId: number;
    userId: number;
    items: BatchProductItemInput[];
  }): Promise<{ createdCount: number; updatedCount: number; products: Product[] }> {
    let createdCount = 0;
    let updatedCount = 0;
    const products: Product[] = [];

    for (const item of input.items) {
      const price = Money.fromPositiveDecimal(item.price);
      const catalog = await this.catalogRepository.findById(item.catalogId);
      if (catalog === null) {
        throw new ResourceNotFoundError(
          `Especificação de catálogo #${item.catalogId} não encontrada.`,
        );
      }

      Product.create({
        id: item.id && item.id > 0 ? item.id : 1,
        companyId: input.companyId,
        userId: input.userId,
        catalogId: item.catalogId,
        name: item.name,
        manufacturer: item.manufacturer,
        sku: item.sku ?? null,
        price,
        isBestQuality: item.isBestQuality ?? false,
      });

      if (item.id && item.id > 0) {
        const updated = await this.productRepository.update({
          id: item.id,
          companyId: input.companyId,
          catalogId: item.catalogId,
          name: item.name.trim(),
          manufacturer: item.manufacturer.trim(),
          sku: item.sku?.trim() || null,
          priceCents: price.cents,
          isBestQuality: item.isBestQuality ?? false,
        });
        if (updated !== null) {
          updatedCount += 1;
          products.push(updated);
          continue;
        }
      }

      const created = await this.productRepository.create({
        companyId: input.companyId,
        userId: input.userId,
        catalogId: item.catalogId,
        name: item.name.trim(),
        manufacturer: item.manufacturer.trim(),
        sku: item.sku?.trim() || null,
        priceCents: price.cents,
        isBestQuality: item.isBestQuality ?? false,
      });
      createdCount += 1;
      products.push(created);
    }

    return { createdCount, updatedCount, products };
  }
}

export class SearchVehiclesForDisambiguationUseCase {
  public constructor(private readonly vehicleRepository: IVehicleRepository) {}

  public async execute(params: { query: string; year?: number }): Promise<{
    requiresDisambiguation: boolean;
    candidates: Vehicle[];
  }> {
    const candidates = await this.vehicleRepository.searchApproximate(
      params.query.trim(),
      params.year,
    );

    return {
      requiresDisambiguation: candidates.length > 1,
      candidates,
    };
  }
}

export interface VehicleSpecSlotOutput {
  catalogId: number;
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
  capacityLiters: number | null;
  intervalKm: number | null;
  notes: string | null;
  availableProducts: Product[];
}

export class LookupVehicleSpecsUseCase {
  public constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly catalogRepository: ICatalogRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  public async execute(params: { vehicleId: number; companyId: number }): Promise<{
    vehicle: Vehicle;
    specifications: VehicleSpecSlotOutput[];
  }> {
    const vehicle = await this.vehicleRepository.findById(params.vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('Veículo não encontrado.');
    }

    const specsWithCatalog = await this.catalogRepository.listSpecsForVehicle(vehicle.id);
    const catalogIds = specsWithCatalog.map((item) => item.catalog.id);

    const companyProducts = await this.productRepository.listByCompanyAndCatalogIds(
      params.companyId,
      catalogIds,
    );

    const specifications: VehicleSpecSlotOutput[] = specsWithCatalog.map(({ spec, catalog }) => {
      const tecdocRef =
        catalog.category === CatalogCategory.FILTRO &&
        spec.notes?.startsWith('Ref. TecDoc Homologada: ')
          ? spec.notes.replace(/^Ref\.\s*TecDoc\s*Homologada:\s*/i, '').trim()
          : null;

      return {
        catalogId: catalog.id,
        category: catalog.category,
        subtype: catalog.subtype,
        name: catalog.name,
        specification: tecdocRef || catalog.specification,
        capacityLiters: spec.capacityLiters,
        intervalKm: spec.intervalKm,
        notes: spec.notes,
        availableProducts: companyProducts
          .filter((p) => p.catalogId === catalog.id && p.isAvailable)
          .sort((a, b) => a.price.cents - b.price.cents),
      };
    });

    return {
      vehicle,
      specifications,
    };
  }
}
