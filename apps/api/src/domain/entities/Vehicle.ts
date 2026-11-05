import { DomainValidationError } from '../errors/DomainErrors.js';
import { YearRange } from '../value-objects/YearRange.js';

export interface VehicleProps {
  id: number;
  manufacturer: string;
  model: string;
  version: string | null;
  type: string;
  yearRange: YearRange;
}

export class Vehicle {
  public readonly id: number;
  public readonly manufacturer: string;
  public readonly model: string;
  public readonly version: string | null;
  public readonly type: string;
  public readonly yearRange: YearRange;

  private constructor(props: VehicleProps) {
    this.id = props.id;
    this.manufacturer = props.manufacturer;
    this.model = props.model;
    this.version = props.version;
    this.type = props.type;
    this.yearRange = props.yearRange;
  }

  public static create(params: {
    id: number;
    manufacturer: string;
    model: string;
    version?: string | null;
    type: string;
    yearRange: YearRange;
  }): Vehicle {
    const manufacturer = params.manufacturer.trim();
    const model = params.model.trim();
    const type = params.type.trim().toUpperCase();
    const version = params.version?.trim() ? params.version.trim() : null;

    if (!manufacturer || !model || !type) {
      throw new DomainValidationError('Fabricante, modelo e tipo do veículo são obrigatórios.');
    }

    return new Vehicle({
      id: params.id,
      manufacturer,
      model,
      version,
      type,
      yearRange: params.yearRange,
    });
  }

  public get fullLabel(): string {
    return [this.manufacturer, this.model, this.version].filter(Boolean).join(' ');
  }
}
