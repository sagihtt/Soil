import {
  AssignTechSpecRecord,
  CreateCatalogItemRecord,
  ICatalogRepository,
  UpdateCatalogItemRecord,
} from '../../../application/ports/ICatalogRepository.js';
import { CatalogItem } from '../../../domain/entities/CatalogItem.js';
import { TechnicalSpecification } from '../../../domain/entities/TechnicalSpecification.js';

export class InMemoryCatalogRepository implements ICatalogRepository {
  private readonly items: CatalogItem[] = [];
  private readonly itemById = new Map<number, CatalogItem>();
  private readonly specs: TechnicalSpecification[] = [];
  private readonly specsByVehicleId = new Map<number, TechnicalSpecification[]>();
  private nextCatalogId = 1;
  private nextSpecId = 1;

  public async findById(id: number): Promise<CatalogItem | null> {
    return this.itemById.get(id) ?? null;
  }

  public async listAll(): Promise<CatalogItem[]> {
    return [...this.items];
  }

  public async create(data: CreateCatalogItemRecord): Promise<CatalogItem> {
    const item = CatalogItem.create({
      id: this.nextCatalogId++,
      category: data.category,
      subtype: data.subtype,
      name: data.name,
      specification: data.specification,
    });
    this.items.push(item);
    this.itemById.set(item.id, item);
    return item;
  }

  public async update(data: UpdateCatalogItemRecord): Promise<CatalogItem | null> {
    const idx = this.items.findIndex((i) => i.id === data.id);
    if (idx === -1) return null;
    const updated = CatalogItem.create({
      id: data.id,
      category: data.category,
      subtype: data.subtype,
      name: data.name,
      specification: data.specification,
    });
    this.items[idx] = updated;
    this.itemById.set(updated.id, updated);
    return updated;
  }

  public async deleteById(id: number): Promise<boolean> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    const [removed] = this.items.splice(idx, 1);
    if (removed) {
      this.itemById.delete(removed.id);
    }
    return true;
  }

  public async assignToVehicle(data: AssignTechSpecRecord): Promise<TechnicalSpecification> {
    const targetCatalog = this.itemById.get(data.catalogId);
    const list = this.specsByVehicleId.get(data.vehicleId) ?? [];
    const existingIdx = list.findIndex((s) => {
      if (s.catalogId === data.catalogId) return true;
      const cat = this.itemById.get(s.catalogId);
      return Boolean(
        cat &&
          targetCatalog &&
          cat.category === targetCatalog.category &&
          cat.subtype === targetCatalog.subtype,
      );
    });

    const spec = TechnicalSpecification.create({
      id: existingIdx >= 0 ? list[existingIdx]!.id : this.nextSpecId++,
      vehicleId: data.vehicleId,
      catalogId: data.catalogId,
      capacityLiters: data.capacityLiters,
      intervalKm: data.intervalKm,
      notes: data.notes,
    });

    if (existingIdx >= 0) {
      list[existingIdx] = spec;
      this.specsByVehicleId.set(data.vehicleId, list);
      const globalIdx = this.specs.findIndex((s) => s.id === spec.id);
      if (globalIdx >= 0) {
        this.specs[globalIdx] = spec;
      }
    } else {
      this.specs.push(spec);
      list.push(spec);
      this.specsByVehicleId.set(data.vehicleId, list);
    }
    return spec;
  }

  public async listSpecsForVehicle(vehicleId: number): Promise<
    Array<{
      spec: TechnicalSpecification;
      catalog: CatalogItem;
    }>
  > {
    const vehicleSpecs = this.specsByVehicleId.get(vehicleId) ?? [];
    const result: Array<{ spec: TechnicalSpecification; catalog: CatalogItem }> = [];
    for (const spec of vehicleSpecs) {
      const catalog = this.itemById.get(spec.catalogId);
      if (catalog) {
        result.push({ spec, catalog });
      }
    }
    return result;
  }
}
