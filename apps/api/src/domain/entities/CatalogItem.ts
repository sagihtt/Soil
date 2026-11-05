import {
  ALLOWED_SUBTYPES_BY_CATEGORY,
  CatalogCategory,
  CatalogSubtype,
} from '@soil/shared';
import { DomainValidationError } from '../errors/DomainErrors.js';

export interface CatalogItemProps {
  id: number;
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
}

export class CatalogItem {
  public readonly id: number;
  public readonly category: CatalogCategory;
  public readonly subtype: CatalogSubtype;
  public readonly name: string;
  public readonly specification: string;

  private constructor(props: CatalogItemProps) {
    this.id = props.id;
    this.category = props.category;
    this.subtype = props.subtype;
    this.name = props.name;
    this.specification = props.specification;
  }

  public static create(params: CatalogItemProps): CatalogItem {
    const allowedSubtypes = ALLOWED_SUBTYPES_BY_CATEGORY[params.category];
    if (!allowedSubtypes || !allowedSubtypes.includes(params.subtype)) {
      throw new DomainValidationError(
        `Combinação inválida de categoria (${params.category}) e subtipo (${params.subtype}).`,
      );
    }

    const name = params.name.trim();
    const specification = params.specification.trim();

    if (!name || !specification) {
      throw new DomainValidationError('Nome e especificação técnica do catálogo são obrigatórios.');
    }

    return new CatalogItem({
      id: params.id,
      category: params.category,
      subtype: params.subtype,
      name,
      specification,
    });
  }
}
