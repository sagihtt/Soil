import { Vehicle } from '../../domain/entities/Vehicle.js';

export interface CreateVehicleRecord {
  manufacturer: string;
  model: string;
  version: string | null;
  type: string;
  manufYearStart: number;
  manufYearEnd: number;
}

export interface UpdateVehicleRecord {
  id: number;
  manufacturer: string;
  model: string;
  version: string | null;
  type: string;
  manufYearStart: number;
  manufYearEnd: number;
}

export interface IVehicleRepository {
  findById(id: number): Promise<Vehicle | null>;
  searchApproximate(query: string, year?: number): Promise<Vehicle[]>;
  listManufacturers(): Promise<string[]>;
  create(data: CreateVehicleRecord): Promise<Vehicle>;
  update(data: UpdateVehicleRecord): Promise<Vehicle | null>;
  deleteById(id: number): Promise<boolean>;
}
