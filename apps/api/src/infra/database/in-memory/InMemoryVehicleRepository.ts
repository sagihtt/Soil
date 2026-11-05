import {
  CreateVehicleRecord,
  IVehicleRepository,
  UpdateVehicleRecord,
} from '../../../application/ports/IVehicleRepository.js';
import { Vehicle } from '../../../domain/entities/Vehicle.js';
import { YearRange } from '../../../domain/value-objects/YearRange.js';

export class InMemoryVehicleRepository implements IVehicleRepository {
  private readonly vehicles: Vehicle[] = [];
  private readonly vehicleById = new Map<number, Vehicle>();
  private nextId = 1;

  public async findById(id: number): Promise<Vehicle | null> {
    return this.vehicleById.get(id) ?? null;
  }

  public async searchApproximate(query: string, year?: number): Promise<Vehicle[]> {
    const term = query.trim().toLowerCase();
    return this.vehicles.filter((v) => {
      const matchesText =
        !term ||
        v.manufacturer.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term) ||
        (v.version !== null && v.version.toLowerCase().includes(term)) ||
        v.fullLabel.toLowerCase().includes(term);

      const matchesYear = year === undefined || v.yearRange.contains(year);
      return matchesText && matchesYear;
    });
  }

  public async listManufacturers(): Promise<string[]> {
    const set = new Set(this.vehicles.map((v) => v.manufacturer));
    return [...set].sort();
  }

  public async create(data: CreateVehicleRecord): Promise<Vehicle> {
    const vehicle = Vehicle.create({
      id: this.nextId++,
      manufacturer: data.manufacturer,
      model: data.model,
      version: data.version,
      type: data.type,
      yearRange: YearRange.create(data.manufYearStart, data.manufYearEnd),
    });
    this.vehicles.push(vehicle);
    this.vehicleById.set(vehicle.id, vehicle);
    return vehicle;
  }

  public async update(data: UpdateVehicleRecord): Promise<Vehicle | null> {
    const idx = this.vehicles.findIndex((v) => v.id === data.id);
    if (idx === -1) return null;
    const updated = Vehicle.create({
      id: data.id,
      manufacturer: data.manufacturer,
      model: data.model,
      version: data.version,
      type: data.type,
      yearRange: YearRange.create(data.manufYearStart, data.manufYearEnd),
    });
    this.vehicles[idx] = updated;
    this.vehicleById.set(updated.id, updated);
    return updated;
  }

  public async deleteById(id: number): Promise<boolean> {
    const idx = this.vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return false;
    const [removed] = this.vehicles.splice(idx, 1);
    if (removed) {
      this.vehicleById.delete(removed.id);
    }
    return true;
  }
}
