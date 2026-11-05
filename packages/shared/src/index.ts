import { z } from 'zod';

/**
 * Categorias e subtipos dos 6 itens técnicos obrigatórios de cada veículo:
 * - OLEO: MOTOR, FREIO, CAMBIO
 * - FILTRO: OLEO, COMBUSTIVEL, AR
 */
export const CatalogCategory = {
  OLEO: 'OLEO',
  FILTRO: 'FILTRO',
} as const;

export type CatalogCategory = (typeof CatalogCategory)[keyof typeof CatalogCategory];

export const CatalogSubtype = {
  MOTOR: 'MOTOR',
  FREIO: 'FREIO',
  CAMBIO: 'CAMBIO',
  OLEO: 'OLEO',
  COMBUSTIVEL: 'COMBUSTIVEL',
  AR: 'AR',
} as const;

export type CatalogSubtype = (typeof CatalogSubtype)[keyof typeof CatalogSubtype];

export const ALLOWED_SUBTYPES_BY_CATEGORY: Readonly<Record<CatalogCategory, readonly CatalogSubtype[]>> = {
  OLEO: [CatalogSubtype.MOTOR, CatalogSubtype.FREIO, CatalogSubtype.CAMBIO],
  FILTRO: [CatalogSubtype.OLEO, CatalogSubtype.COMBUSTIVEL, CatalogSubtype.AR],
} as const;

export const MANDATORY_SIX_SLOTS = [
  { category: CatalogCategory.OLEO, subtype: CatalogSubtype.MOTOR, label: 'Óleo de Motor' },
  { category: CatalogCategory.OLEO, subtype: CatalogSubtype.FREIO, label: 'Óleo de Freio' },
  { category: CatalogCategory.OLEO, subtype: CatalogSubtype.CAMBIO, label: 'Óleo de Câmbio' },
  { category: CatalogCategory.FILTRO, subtype: CatalogSubtype.OLEO, label: 'Filtro de Óleo' },
  { category: CatalogCategory.FILTRO, subtype: CatalogSubtype.COMBUSTIVEL, label: 'Filtro de Combustível' },
  { category: CatalogCategory.FILTRO, subtype: CatalogSubtype.AR, label: 'Filtro de Ar' },
] as const;

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AccountStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const QuoteProfile = {
  CHEAPEST: 'CHEAPEST',
  MOST_EXPENSIVE: 'MOST_EXPENSIVE',
  BEST_QUALITY: 'BEST_QUALITY',
  CUSTOM: 'CUSTOM',
} as const;

export type QuoteProfile = (typeof QuoteProfile)[keyof typeof QuoteProfile];

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
} as const;

export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const CompanyRegisterSchema = z.object({
  cnpj: z.string().min(14),
  tradeName: z.string().trim().min(2).max(150),
});

export const UserRegisterSchema = z.object({
  cnpj: z.string().min(14),
  name: z.string().trim().min(2).max(150),
  login: z.string().trim().min(3).max(60),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(10).max(20),
  password: z.string().min(8).max(128),
});
