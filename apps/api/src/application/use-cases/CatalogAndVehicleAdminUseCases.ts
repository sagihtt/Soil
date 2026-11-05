import { CatalogCategory, CatalogSubtype, UserRole } from '@soil/shared';
import { CatalogItem } from '../../domain/entities/CatalogItem.js';
import { TechnicalSpecification } from '../../domain/entities/TechnicalSpecification.js';
import { Vehicle } from '../../domain/entities/Vehicle.js';
import {
  ForbiddenOperationError,
  ResourceNotFoundError,
} from '../../domain/errors/DomainErrors.js';
import { YearRange } from '../../domain/value-objects/YearRange.js';
import { ICatalogRepository } from '../ports/ICatalogRepository.js';
import { IVehicleRepository } from '../ports/IVehicleRepository.js';

function assertAdmin(role: UserRole): void {
  if (role !== UserRole.ADMIN) {
    throw new ForbiddenOperationError(
      'Operação restrita aos administradores técnicos (Angaran/Soil).',
    );
  }
}

export class CreateVehicleUseCase {
  public constructor(private readonly vehicleRepository: IVehicleRepository) {}

  public async execute(input: {
    actorRole: UserRole;
    manufacturer: string;
    model: string;
    version?: string | null;
    type: string;
    manufYearStart: number;
    manufYearEnd: number;
  }): Promise<Vehicle> {
    assertAdmin(input.actorRole);
    const yearRange = YearRange.create(input.manufYearStart, input.manufYearEnd);

    Vehicle.create({
      id: 1,
      manufacturer: input.manufacturer,
      model: input.model,
      version: input.version ?? null,
      type: input.type,
      yearRange,
    });

    return this.vehicleRepository.create({
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      version: input.version?.trim() ?? null,
      type: input.type.trim().toUpperCase(),
      manufYearStart: yearRange.start,
      manufYearEnd: yearRange.end,
    });
  }
}

export class DeleteVehicleUseCase {
  public constructor(private readonly vehicleRepository: IVehicleRepository) {}

  public async execute(input: { actorRole: UserRole; vehicleId: number }): Promise<void> {
    assertAdmin(input.actorRole);
    const deleted = await this.vehicleRepository.deleteById(input.vehicleId);
    if (!deleted) {
      throw new ResourceNotFoundError('Veículo não encontrado.');
    }
  }
}

export class UpdateVehicleUseCase {
  public constructor(private readonly vehicleRepository: IVehicleRepository) {}

  public async execute(input: {
    actorRole: UserRole;
    vehicleId: number;
    manufacturer: string;
    model: string;
    version?: string | null;
    type: string;
    manufYearStart: number;
    manufYearEnd: number;
  }): Promise<Vehicle> {
    assertAdmin(input.actorRole);
    const yearRange = YearRange.create(input.manufYearStart, input.manufYearEnd);

    Vehicle.create({
      id: input.vehicleId,
      manufacturer: input.manufacturer,
      model: input.model,
      version: input.version ?? null,
      type: input.type,
      yearRange,
    });

    const updated = await this.vehicleRepository.update({
      id: input.vehicleId,
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      version: input.version?.trim() ?? null,
      type: input.type.trim().toUpperCase(),
      manufYearStart: yearRange.start,
      manufYearEnd: yearRange.end,
    });

    if (updated === null) {
      throw new ResourceNotFoundError('Veículo não encontrado.');
    }

    return updated;
  }
}

export class CreateCatalogItemUseCase {
  public constructor(private readonly catalogRepository: ICatalogRepository) {}

  public async execute(input: {
    actorRole: UserRole;
    category: CatalogCategory;
    subtype: CatalogSubtype;
    name: string;
    specification: string;
  }): Promise<CatalogItem> {
    assertAdmin(input.actorRole);

    CatalogItem.create({
      id: 1,
      category: input.category,
      subtype: input.subtype,
      name: input.name,
      specification: input.specification,
    });

    return this.catalogRepository.create({
      category: input.category,
      subtype: input.subtype,
      name: input.name.trim(),
      specification: input.specification.trim(),
    });
  }
}

export class DeleteCatalogItemUseCase {
  public constructor(private readonly catalogRepository: ICatalogRepository) {}

  public async execute(input: { actorRole: UserRole; catalogId: number }): Promise<void> {
    assertAdmin(input.actorRole);
    const deleted = await this.catalogRepository.deleteById(input.catalogId);
    if (!deleted) {
      throw new ResourceNotFoundError('Item de catálogo não encontrado.');
    }
  }
}

export class UpdateCatalogItemUseCase {
  public constructor(private readonly catalogRepository: ICatalogRepository) {}

  public async execute(input: {
    actorRole: UserRole;
    catalogId: number;
    category: CatalogCategory;
    subtype: CatalogSubtype;
    name: string;
    specification: string;
  }): Promise<CatalogItem> {
    assertAdmin(input.actorRole);

    CatalogItem.create({
      id: input.catalogId,
      category: input.category,
      subtype: input.subtype,
      name: input.name,
      specification: input.specification,
    });

    const updated = await this.catalogRepository.update({
      id: input.catalogId,
      category: input.category,
      subtype: input.subtype,
      name: input.name.trim(),
      specification: input.specification.trim(),
    });

    if (updated === null) {
      throw new ResourceNotFoundError('Item de catálogo não encontrado.');
    }

    return updated;
  }
}

export class AssignTechnicalSpecUseCase {
  public constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  public async execute(input: {
    actorRole: UserRole;
    vehicleId: number;
    catalogId: number;
    capacityLiters?: number | null;
    intervalKm?: number | null;
    notes?: string | null;
  }): Promise<TechnicalSpecification> {
    assertAdmin(input.actorRole);

    const vehicle = await this.vehicleRepository.findById(input.vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('Veículo não encontrado.');
    }

    const catalog = await this.catalogRepository.findById(input.catalogId);
    if (catalog === null) {
      throw new ResourceNotFoundError('Item de catálogo não encontrado.');
    }

    TechnicalSpecification.create({
      id: 1,
      vehicleId: input.vehicleId,
      catalogId: input.catalogId,
      capacityLiters: input.capacityLiters ?? null,
      intervalKm: input.intervalKm ?? null,
      notes: input.notes ?? null,
    });

    return this.catalogRepository.assignToVehicle({
      vehicleId: input.vehicleId,
      catalogId: input.catalogId,
      capacityLiters: input.capacityLiters ?? null,
      intervalKm: input.intervalKm ?? null,
      notes: input.notes?.trim() ?? null,
    });
  }
}
