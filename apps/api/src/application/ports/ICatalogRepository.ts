import { CatalogCategory, CatalogSubtype } from '@soil/shared';
import { CatalogItem } from '../../domain/entities/CatalogItem.js';
import { TechnicalSpecification } from '../../domain/entities/TechnicalSpecification.js';

export interface CreateCatalogItemRecord {
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
}

export interface UpdateCatalogItemRecord {
  id: number;
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
}

export interface AssignTechSpecRecord {
  vehicleId: number;
  catalogId: number;
  capacityLiters: number | null;
  intervalKm: number | null;
  notes: string | null;
}

export interface ICatalogRepository {
  findById(id: number): Promise<CatalogItem | null>;
  listAll(): Promise<CatalogItem[]>;
  create(data: CreateCatalogItemRecord): Promise<CatalogItem>;
  update(data: UpdateCatalogItemRecord): Promise<CatalogItem | null>;
  deleteById(id: number): Promise<boolean>;
  assignToVehicle(data: AssignTechSpecRecord): Promise<TechnicalSpecification>;
  listSpecsForVehicle(vehicleId: number): Promise<
    Array<{
      spec: TechnicalSpecification;
      catalog: CatalogItem;
    }>
  >;
}
