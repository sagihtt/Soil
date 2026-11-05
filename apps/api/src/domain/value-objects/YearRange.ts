import { DomainValidationError } from '../errors/DomainErrors.js';

export class YearRange {
  public readonly start: number;
  public readonly end: number;

  private constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }

  public static create(start: number, end: number): YearRange {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new DomainValidationError('Os anos de fabricação devem ser números inteiros.');
    }

    if (start < 1900 || end > 2100) {
      throw new DomainValidationError('Os anos de fabricação devem estar entre 1900 e 2100.');
    }

    if (start > end) {
      throw new DomainValidationError('O ano inicial de fabricação não pode ser maior que o ano final.');
    }

    return new YearRange(start, end);
  }

  public contains(year: number): boolean {
    return year >= this.start && year <= this.end;
  }
}
