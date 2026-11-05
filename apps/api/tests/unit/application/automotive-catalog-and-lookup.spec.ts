import { CatalogCategory, CatalogSubtype, UserRole } from '@soil/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AssignTechnicalSpecUseCase,
  CreateCatalogItemUseCase,
  CreateVehicleUseCase,
  DeleteCatalogItemUseCase,
  DeleteVehicleUseCase,
} from '../../../src/application/use-cases/CatalogAndVehicleAdminUseCases.js';
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  LookupVehicleSpecsUseCase,
  SearchVehiclesForDisambiguationUseCase,
  UpdateProductUseCase,
} from '../../../src/application/use-cases/ProductAndLookupUseCases.js';
import {
  DomainValidationError,
  ForbiddenOperationError,
  ResourceNotFoundError,
} from '../../../src/domain/errors/DomainErrors.js';
import { InMemoryCatalogRepository } from '../../../src/infra/database/in-memory/InMemoryCatalogRepository.js';
import { InMemoryProductRepository } from '../../../src/infra/database/in-memory/InMemoryProductRepository.js';
import { InMemoryVehicleRepository } from '../../../src/infra/database/in-memory/InMemoryVehicleRepository.js';

describe('Automotive Catalog (6 Mandatory Specs), Disambiguation & Multi-Tenant Products (TDD Cycles 5 & 6)', () => {
  let vehicleRepo: InMemoryVehicleRepository;
  let catalogRepo: InMemoryCatalogRepository;
  let productRepo: InMemoryProductRepository;

  let createVehicle: CreateVehicleUseCase;
  let deleteVehicle: DeleteVehicleUseCase;
  let createCatalog: CreateCatalogItemUseCase;
  let deleteCatalog: DeleteCatalogItemUseCase;
  let assignSpec: AssignTechnicalSpecUseCase;
  let createProduct: CreateProductUseCase;
  let updateProduct: UpdateProductUseCase;
  let deleteProduct: DeleteProductUseCase;
  let searchDisambiguation: SearchVehiclesForDisambiguationUseCase;
  let lookupVehicleSpecs: LookupVehicleSpecsUseCase;

  beforeEach(() => {
    vehicleRepo = new InMemoryVehicleRepository();
    catalogRepo = new InMemoryCatalogRepository();
    productRepo = new InMemoryProductRepository();

    createVehicle = new CreateVehicleUseCase(vehicleRepo);
    deleteVehicle = new DeleteVehicleUseCase(vehicleRepo);
    createCatalog = new CreateCatalogItemUseCase(catalogRepo);
    deleteCatalog = new DeleteCatalogItemUseCase(catalogRepo);
    assignSpec = new AssignTechnicalSpecUseCase(vehicleRepo, catalogRepo);
    createProduct = new CreateProductUseCase(catalogRepo, productRepo);
    updateProduct = new UpdateProductUseCase(catalogRepo, productRepo);
    deleteProduct = new DeleteProductUseCase(productRepo);
    searchDisambiguation = new SearchVehiclesForDisambiguationUseCase(vehicleRepo);
    lookupVehicleSpecs = new LookupVehicleSpecsUseCase(vehicleRepo, catalogRepo, productRepo);
  });

  describe('RF04 & RF05 - Restrição de Admin e Invariante dos 6 Itens Técnicos', () => {
    it('deve bloquear criação e exclusão de veículos ou catálogo por usuários comuns (não-ADMIN)', async () => {
      await expect(
        createVehicle.execute({
          actorRole: UserRole.USER,
          manufacturer: 'Volkswagen',
          model: 'Gol',
          version: '1.6 MSI',
          type: 'CARRO',
          manufYearStart: 2018,
          manufYearEnd: 2022,
        }),
      ).rejects.toThrow(ForbiddenOperationError);

      const vehicle = await createVehicle.execute({
        actorRole: UserRole.ADMIN,
        manufacturer: 'Volkswagen',
        model: 'Gol',
        version: '1.6 MSI',
        type: 'CARRO',
        manufYearStart: 2018,
        manufYearEnd: 2022,
      });

      await expect(
        deleteVehicle.execute({ actorRole: UserRole.USER, vehicleId: vehicle.id }),
      ).rejects.toThrow(ForbiddenOperationError);

      await expect(
        createCatalog.execute({
          actorRole: UserRole.USER,
          category: CatalogCategory.OLEO,
          subtype: CatalogSubtype.MOTOR,
          name: 'Óleo Sintético 5W-40',
          specification: 'SAE 5W-40 VW 508.88',
        }),
      ).rejects.toThrow(ForbiddenOperationError);
    });

    it('deve aceitar apenas os 6 pares válidos de Categoria/Subtipo e rejeitar combinações inválidas', async () => {
      // Par inválido: OLEO + AR
      await expect(
        createCatalog.execute({
          actorRole: UserRole.ADMIN,
          category: CatalogCategory.OLEO,
          subtype: CatalogSubtype.AR,
          name: 'Invalido',
          specification: 'Invalido',
        }),
      ).rejects.toThrow(DomainValidationError);

      // Par inválido: FILTRO + MOTOR
      await expect(
        createCatalog.execute({
          actorRole: UserRole.ADMIN,
          category: CatalogCategory.FILTRO,
          subtype: CatalogSubtype.MOTOR,
          name: 'Invalido',
          specification: 'Invalido',
        }),
      ).rejects.toThrow(DomainValidationError);

      // Pares válidos (ex: Filtro de Combustível e Óleo de Câmbio)
      const filtroComb = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.FILTRO,
        subtype: CatalogSubtype.COMBUSTIVEL,
        name: 'Filtro Combustível Linha Flex',
        specification: 'FCI 1660 / WK 58',
      });

      expect(filtroComb.category).toBe(CatalogCategory.FILTRO);
      expect(filtroComb.subtype).toBe(CatalogSubtype.COMBUSTIVEL);
    });
  });

  describe('RF06 & RF08 - Desambiguação de Veículos, 6 Especificações e Isolamento de Produtos', () => {
    it('deve sinalizar desambiguação quando mais de um veículo corresponder à busca', async () => {
      await createVehicle.execute({
        actorRole: UserRole.ADMIN,
        manufacturer: 'Chevrolet',
        model: 'Onix',
        version: '1.0 8V Joy (Correia Seca)',
        type: 'CARRO',
        manufYearStart: 2017,
        manufYearEnd: 2021,
      });

      await createVehicle.execute({
        actorRole: UserRole.ADMIN,
        manufacturer: 'Chevrolet',
        model: 'Onix',
        version: '1.0 12V Turbo (Correia Banhada a Óleo)',
        type: 'CARRO',
        manufYearStart: 2020,
        manufYearEnd: 2025,
      });

      const searchAmbiguous = await searchDisambiguation.execute({
        query: 'Onix',
        year: 2020,
      });

      expect(searchAmbiguous.requiresDisambiguation).toBe(true);
      expect(searchAmbiguous.candidates).toHaveLength(2);

      const searchExact = await searchDisambiguation.execute({
        query: 'Turbo',
        year: 2023,
      });

      expect(searchExact.requiresDisambiguation).toBe(false);
      expect(searchExact.candidates).toHaveLength(1);
    });

    it('deve retornar os 6 itens técnicos do veículo e filtrar produtos estritamente pelo CNPJ logado', async () => {
      const vehicle = await createVehicle.execute({
        actorRole: UserRole.ADMIN,
        manufacturer: 'Toyota',
        model: 'Corolla',
        version: '2.0 Dynamic Force',
        type: 'CARRO',
        manufYearStart: 2020,
        manufYearEnd: 2025,
      });

      const oleoMotor = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.OLEO,
        subtype: CatalogSubtype.MOTOR,
        name: 'Óleo Motor 0W-20',
        specification: 'SAE 0W-20 API SP ILSAC GF-6A',
      });
      const oleoFreio = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.OLEO,
        subtype: CatalogSubtype.FREIO,
        name: 'Fluido de Freio DOT 4',
        specification: 'FMVSS 116 DOT 4',
      });
      const oleoCambio = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.OLEO,
        subtype: CatalogSubtype.CAMBIO,
        name: 'Fluido CVT FE',
        specification: 'Toyota Genuine CVT Fluid FE',
      });
      const filtroOleo = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.FILTRO,
        subtype: CatalogSubtype.OLEO,
        name: 'Filtro de Óleo Blindado',
        specification: 'W 68/80 / PSL135',
      });
      const filtroComb = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.FILTRO,
        subtype: CatalogSubtype.COMBUSTIVEL,
        name: 'Filtro de Combustível Flex',
        specification: 'GI04/7',
      });
      const filtroAr = await createCatalog.execute({
        actorRole: UserRole.ADMIN,
        category: CatalogCategory.FILTRO,
        subtype: CatalogSubtype.AR,
        name: 'Filtro de Ar do Motor',
        specification: 'C 24 005 / ARL2205',
      });

      await assignSpec.execute({
        actorRole: UserRole.ADMIN,
        vehicleId: vehicle.id,
        catalogId: oleoMotor.id,
        capacityLiters: 4.3,
        intervalKm: 10000,
        notes: 'Com troca de filtro',
      });
      await assignSpec.execute({ actorRole: UserRole.ADMIN, vehicleId: vehicle.id, catalogId: oleoFreio.id, capacityLiters: 0.5 });
      await assignSpec.execute({ actorRole: UserRole.ADMIN, vehicleId: vehicle.id, catalogId: oleoCambio.id, capacityLiters: 7.5 });
      await assignSpec.execute({ actorRole: UserRole.ADMIN, vehicleId: vehicle.id, catalogId: filtroOleo.id });
      await assignSpec.execute({ actorRole: UserRole.ADMIN, vehicleId: vehicle.id, catalogId: filtroComb.id });
      await assignSpec.execute({ actorRole: UserRole.ADMIN, vehicleId: vehicle.id, catalogId: filtroAr.id });

      // Empresa 1 cadastra produto
      const prodCompany1 = await createProduct.execute({
        companyId: 1,
        userId: 10,
        catalogId: oleoMotor.id,
        name: 'Mobil Super 0W-20 1L',
        manufacturer: 'Mobil',
        sku: 'MOB-0W20-1L',
        price: 58.9,
        isBestQuality: true,
      });

      // Empresa 2 cadastra produto mais barato para o mesmo catálogo
      const prodCompany2 = await createProduct.execute({
        companyId: 2,
        userId: 20,
        catalogId: oleoMotor.id,
        name: 'Lubrax Valora 0W-20 1L',
        manufacturer: 'Vibra',
        sku: 'LUB-0W20',
        price: 42.0,
        isBestQuality: false,
      });

      // Empresa 2 não pode deletar nem atualizar produto da Empresa 1
      await expect(
        deleteProduct.execute({ companyId: 2, productId: prodCompany1.id }),
      ).rejects.toThrow(ResourceNotFoundError);

      await expect(
        updateProduct.execute({
          productId: prodCompany1.id,
          companyId: 2,
          catalogId: oleoMotor.id,
          name: 'Tentativa Invasao',
          manufacturer: 'Mobil',
          sku: 'MOB-0W20-1L',
          price: 10.0,
          isBestQuality: false,
        }),
      ).rejects.toThrow(ResourceNotFoundError);

      // Empresa 1 pode atualizar o preço e código de seu próprio produto in-place
      const updatedProd1 = await updateProduct.execute({
        productId: prodCompany1.id,
        companyId: 1,
        catalogId: oleoMotor.id,
        name: 'Mobil Super 0W-20 Sintético 1L',
        manufacturer: 'Mobil',
        sku: 'MOB-0W20-PRO',
        price: 62.5,
        isBestQuality: true,
      });
      expect(updatedProd1.id).toBe(prodCompany1.id);
      expect(updatedProd1.price.toDecimal()).toBe(62.5);
      expect(updatedProd1.sku).toBe('MOB-0W20-PRO');

      // Lookup para Empresa 1 deve retornar os 6 itens técnicos e apenas os produtos da Empresa 1
      const lookup1 = await lookupVehicleSpecs.execute({
        vehicleId: vehicle.id,
        companyId: 1,
      });

      expect(lookup1.specifications).toHaveLength(6);
      const motorSlot = lookup1.specifications.find(
        (s) => s.category === CatalogCategory.OLEO && s.subtype === CatalogSubtype.MOTOR,
      );
      expect(motorSlot?.capacityLiters).toBe(4.3);
      expect(motorSlot?.availableProducts).toHaveLength(1);
      expect(motorSlot?.availableProducts[0]?.id).toBe(prodCompany1.id);
      expect(motorSlot?.availableProducts[0]?.id).not.toBe(prodCompany2.id);
    });
  });
});
