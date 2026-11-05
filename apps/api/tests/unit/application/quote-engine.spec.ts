import { CatalogCategory, CatalogSubtype, QuoteProfile, QuoteStatus, UserRole } from '@soil/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AssignTechnicalSpecUseCase,
  CreateCatalogItemUseCase,
  CreateVehicleUseCase,
} from '../../../src/application/use-cases/CatalogAndVehicleAdminUseCases.js';
import { CreateClientUseCase } from '../../../src/application/use-cases/ClientManagementUseCases.js';
import { CreateProductUseCase } from '../../../src/application/use-cases/ProductAndLookupUseCases.js';
import {
  CreateOrUpdateQuoteUseCase,
  GenerateQuoteOptionsUseCase,
  SendQuoteEmailUseCase,
} from '../../../src/application/use-cases/QuoteEngineUseCases.js';
import { InMemoryCatalogRepository } from '../../../src/infra/database/in-memory/InMemoryCatalogRepository.js';
import { InMemoryClientRepository } from '../../../src/infra/database/in-memory/InMemoryClientRepository.js';
import { InMemoryProductRepository } from '../../../src/infra/database/in-memory/InMemoryProductRepository.js';
import { InMemoryQuoteRepository } from '../../../src/infra/database/in-memory/InMemoryQuoteRepository.js';
import { InMemoryVehicleRepository } from '../../../src/infra/database/in-memory/InMemoryVehicleRepository.js';
import { FakeMailService } from '../../../src/infra/mail/FakeMailService.js';

describe('Quote Engine: 3 Tiers, Interactive Manipulation & Email Dispatch (TDD Cycle 7 - RF09 & RF10)', () => {
  let vehicleRepo: InMemoryVehicleRepository;
  let catalogRepo: InMemoryCatalogRepository;
  let productRepo: InMemoryProductRepository;
  let clientRepo: InMemoryClientRepository;
  let quoteRepo: InMemoryQuoteRepository;
  let mailService: FakeMailService;

  let createVehicle: CreateVehicleUseCase;
  let createCatalog: CreateCatalogItemUseCase;
  let assignSpec: AssignTechnicalSpecUseCase;
  let createProduct: CreateProductUseCase;
  let createClient: CreateClientUseCase;
  let generateOptions: GenerateQuoteOptionsUseCase;
  let saveQuote: CreateOrUpdateQuoteUseCase;
  let sendQuoteEmail: SendQuoteEmailUseCase;

  beforeEach(() => {
    vehicleRepo = new InMemoryVehicleRepository();
    catalogRepo = new InMemoryCatalogRepository();
    productRepo = new InMemoryProductRepository();
    clientRepo = new InMemoryClientRepository();
    quoteRepo = new InMemoryQuoteRepository();
    mailService = new FakeMailService();

    createVehicle = new CreateVehicleUseCase(vehicleRepo);
    createCatalog = new CreateCatalogItemUseCase(catalogRepo);
    assignSpec = new AssignTechnicalSpecUseCase(vehicleRepo, catalogRepo);
    createProduct = new CreateProductUseCase(catalogRepo, productRepo);
    createClient = new CreateClientUseCase(clientRepo);
    generateOptions = new GenerateQuoteOptionsUseCase(vehicleRepo, catalogRepo, productRepo);
    saveQuote = new CreateOrUpdateQuoteUseCase(quoteRepo, productRepo, clientRepo, vehicleRepo);
    sendQuoteEmail = new SendQuoteEmailUseCase(quoteRepo, clientRepo, vehicleRepo, mailService);
  });

  it('deve calcular corretamente as 3 opções de orçamento (Mais Barato, Mais Caro, Melhor Qualidade)', async () => {
    const vehicle = await createVehicle.execute({
      actorRole: UserRole.ADMIN,
      manufacturer: 'Honda',
      model: 'Civic',
      version: '2.0 LXR',
      type: 'CARRO',
      manufYearStart: 2016,
      manufYearEnd: 2021,
    });

    const oleoMotor = await createCatalog.execute({
      actorRole: UserRole.ADMIN,
      category: CatalogCategory.OLEO,
      subtype: CatalogSubtype.MOTOR,
      name: 'Óleo 0W-20 Sintético',
      specification: 'SAE 0W-20 API SP',
    });

    const filtroOleo = await createCatalog.execute({
      actorRole: UserRole.ADMIN,
      category: CatalogCategory.FILTRO,
      subtype: CatalogSubtype.OLEO,
      name: 'Filtro de Óleo Honda',
      specification: 'W 610/6',
    });

    await assignSpec.execute({
      actorRole: UserRole.ADMIN,
      vehicleId: vehicle.id,
      catalogId: oleoMotor.id,
      capacityLiters: 4,
    });
    await assignSpec.execute({
      actorRole: UserRole.ADMIN,
      vehicleId: vehicle.id,
      catalogId: filtroOleo.id,
      capacityLiters: 1,
    });

    // 3 opções de óleo na Oficina 1:
    // 1. Econômico (R$ 35,00/L)
    await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: oleoMotor.id,
      name: 'Óleo Econômico 0W-20',
      manufacturer: 'Marca A',
      price: 35.0,
      isBestQuality: false,
    });
    // 2. Melhor Custo-Benefício / Qualidade Recomendada (R$ 52,00/L, isBestQuality = true)
    const oleoBest = await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: oleoMotor.id,
      name: 'Motul 8100 Eco-lite 0W-20',
      manufacturer: 'Motul',
      price: 52.0,
      isBestQuality: true,
    });
    // 3. Mais Caro Importado (R$ 75,00/L, isBestQuality = false)
    const oleoExpensive = await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: oleoMotor.id,
      name: 'Royal Purple 0W-20',
      manufacturer: 'Royal Purple',
      price: 75.0,
      isBestQuality: false,
    });

    // Filtro único (R$ 40,00)
    await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: filtroOleo.id,
      name: 'Filtro Mann W 610/6',
      manufacturer: 'Mann-Filter',
      price: 40.0,
      isBestQuality: true,
    });

    const options = await generateOptions.execute({
      companyId: 1,
      vehicleId: vehicle.id,
    });

    // CHEAPEST: (4L * R$ 35,00) + (1 * R$ 40,00) = R$ 180,00
    expect(options.cheapest.totalAmount).toBe(180.0);
    // BEST_QUALITY: (4L * R$ 52,00) + (1 * R$ 40,00) = R$ 248,00
    expect(options.bestQuality.totalAmount).toBe(248.0);
    expect(options.bestQuality.items[0]?.productId).toBe(oleoBest.id);
    // MOST_EXPENSIVE: (4L * R$ 75,00) + (1 * R$ 40,00) = R$ 340,00
    expect(options.mostExpensive.totalAmount).toBe(340.0);
    expect(options.mostExpensive.items[0]?.productId).toBe(oleoExpensive.id);
  });

  it('deve permitir manipular itens, sobrescrever preços, trocar o cliente e enviar o orçamento por e-mail', async () => {
    const vehicle = await createVehicle.execute({
      actorRole: UserRole.ADMIN,
      manufacturer: 'Fiat',
      model: 'Pulse',
      version: '1.0 Turbo T200',
      type: 'CARRO',
      manufYearStart: 2022,
      manufYearEnd: 2025,
    });

    const oleo = await createCatalog.execute({
      actorRole: UserRole.ADMIN,
      category: CatalogCategory.OLEO,
      subtype: CatalogSubtype.MOTOR,
      name: 'Óleo 0W-30 C2',
      specification: 'SAE 0W-30 ACEA C2 Fiat 9.55535-GS1',
    });

    const filtro = await createCatalog.execute({
      actorRole: UserRole.ADMIN,
      category: CatalogCategory.FILTRO,
      subtype: CatalogSubtype.OLEO,
      name: 'Filtro Óleo T200',
      specification: 'WL 10500',
    });

    const prodOleo = await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: oleo.id,
      name: 'Selenia Forward 0W-30',
      manufacturer: 'Petronas',
      price: 65.0,
      isBestQuality: true,
    });

    const prodFiltro = await createProduct.execute({
      companyId: 1,
      userId: 1,
      catalogId: filtro.id,
      name: 'Filtro Original Mopar',
      manufacturer: 'Mopar',
      price: 55.0,
      isBestQuality: true,
    });

    const client1 = await createClient.execute({
      companyId: 1,
      name: 'Pedro Oliveira',
      phone: '11988881111',
      email: 'pedro@cliente.com.br',
    });

    const client2 = await createClient.execute({
      companyId: 1,
      name: 'Ana Costa',
      phone: '11988882222',
      email: 'ana@cliente.com.br',
    });

    // Cria orçamento inicial com 4L de óleo + 1 filtro
    const draftQuote = await saveQuote.execute({
      companyId: 1,
      userId: 1,
      vehicleId: vehicle.id,
      clientId: client1.id,
      profile: QuoteProfile.BEST_QUALITY,
      items: [
        { productId: prodOleo.id, quantity: 4, unitPrice: 65.0 },
        { productId: prodFiltro.id, quantity: 1, unitPrice: 55.0 },
      ],
    });

    expect(draftQuote.totalAmount.toDecimal()).toBe(315.0);

    // Manipula o orçamento: remove o filtro, aplica desconto no óleo (R$ 60,00) e troca o destinatário para Ana Costa
    const updatedQuote = await saveQuote.execute({
      quoteId: draftQuote.id,
      companyId: 1,
      userId: 1,
      vehicleId: vehicle.id,
      clientId: client2.id,
      profile: QuoteProfile.CUSTOM,
      items: [{ productId: prodOleo.id, quantity: 4, unitPrice: 60.0 }],
    });

    expect(updatedQuote.totalAmount.toDecimal()).toBe(240.0);
    expect(updatedQuote.clientId).toBe(client2.id);

    // Envia orçamento por e-mail
    const sentQuote = await sendQuoteEmail.execute({
      companyId: 1,
      quoteId: updatedQuote.id,
    });

    expect(sentQuote.status).toBe(QuoteStatus.SENT);
    expect(mailService.sentEmails).toHaveLength(1);
    expect(mailService.sentEmails[0]?.to).toBe('ana@cliente.com.br');
    expect(mailService.sentEmails[0]?.html).toContain('Fiat Pulse');
    expect(mailService.sentEmails[0]?.html).toContain('Selenia Forward 0W-30');
    expect(mailService.sentEmails[0]?.html).toContain('240.00');
  });
});
