import { DomainValidationError } from '../errors/DomainErrors.js';

export interface TechnicalSpecificationProps {
  id: number;
  vehicleId: number;
  catalogId: number;
  capacityLiters: number | null;
  intervalKm: number | null;
  notes: string | null;
}

export class TechnicalSpecification {
  public readonly id: number;
  public readonly vehicleId: number;
  public readonly catalogId: number;
  public readonly capacityLiters: number | null;
  public readonly intervalKm: number | null;
  public readonly notes: string | null;

  private constructor(props: TechnicalSpecificationProps) {
    this.id = props.id;
    this.vehicleId = props.vehicleId;
    this.catalogId = props.catalogId;
    this.capacityLiters = props.capacityLiters;
    this.intervalKm = props.intervalKm;
    this.notes = props.notes;
  }

  public static create(params: {
    id: number;
    vehicleId: number;
    catalogId: number;
    capacityLiters?: number | null;
    intervalKm?: number | null;
    notes?: string | null;
  }): TechnicalSpecification {
    if (params.capacityLiters !== undefined && params.capacityLiters !== null && params.capacityLiters <= 0) {
      throw new DomainValidationError('A capacidade em litros deve ser maior que zero.');
    }

    if (params.intervalKm !== undefined && params.intervalKm !== null && params.intervalKm <= 0) {
      throw new DomainValidationError('O intervalo em quilômetros deve ser maior que zero.');
    }

    return new TechnicalSpecification({
      id: params.id,
      vehicleId: params.vehicleId,
      catalogId: params.catalogId,
      capacityLiters: params.capacityLiters ?? null,
      intervalKm: params.intervalKm ?? null,
      notes: params.notes?.trim() ?? null,
    });
  }
}
