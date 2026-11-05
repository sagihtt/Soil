import { AccountStatus, CatalogCategory, CatalogSubtype, UserRole } from '@soil/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryCatalogRepository } from '../../src/infra/database/in-memory/InMemoryCatalogRepository.js';
import { InMemoryClientRepository } from '../../src/infra/database/in-memory/InMemoryClientRepository.js';
import { InMemoryCompanyRepository } from '../../src/infra/database/in-memory/InMemoryCompanyRepository.js';
import { InMemoryProductRepository } from '../../src/infra/database/in-memory/InMemoryProductRepository.js';
import { InMemoryQuoteRepository } from '../../src/infra/database/in-memory/InMemoryQuoteRepository.js';
import { InMemoryUserRepository } from '../../src/infra/database/in-memory/InMemoryUserRepository.js';
import { InMemoryVehicleRepository } from '../../src/infra/database/in-memory/InMemoryVehicleRepository.js';
import { FakeMailService } from '../../src/infra/mail/FakeMailService.js';
import { JwtTokenService } from '../../src/infra/security/JwtTokenService.js';
import { ScryptPasswordHasher } from '../../src/infra/security/ScryptPasswordHasher.js';
import { buildApp } from '../../src/presentation/app.js';

describe('HTTP REST API Integration (TDD Cycle 8 - Full E2E Journey)', () => {
  const cnpjAngaran = '11.222.333/0001-81';
  const cnpjOficina = '11.444.777/0001-61';

  let companyRepo: InMemoryCompanyRepository;
  let userRepo: InMemoryUserRepository;
  let clientRepo: InMemoryClientRepository;
  let vehicleRepo: InMemoryVehicleRepository;
  let catalogRepo: InMemoryCatalogRepository;
  let productRepo: InMemoryProductRepository;
  let quoteRepo: InMemoryQuoteRepository;
  let passwordHasher: ScryptPasswordHasher;
  let tokenService: JwtTokenService;
  let mailService: FakeMailService;

  beforeEach(() => {
    companyRepo = new InMemoryCompanyRepository();
    userRepo = new InMemoryUserRepository();
    clientRepo = new InMemoryClientRepository();
    vehicleRepo = new InMemoryVehicleRepository();
    catalogRepo = new InMemoryCatalogRepository();
    productRepo = new InMemoryProductRepository();
    quoteRepo = new InMemoryQuoteRepository();
    passwordHasher = new ScryptPasswordHasher();
    tokenService = new JwtTokenService('soil-super-secret-test-key-2026');
    mailService = new FakeMailService();
  });

  it('deve executar o fluxo completo: Cadastro de CNPJ -> Login -> Curadoria Admin -> Desambiguação -> 6 Itens -> 3 Opções de Orçamento -> Envio de E-mail', async () => {
    const app = buildApp({
      companyRepo,
      userRepo,
      clientRepo,
      vehicleRepo,
      catalogRepo,
      productRepo,
      quoteRepo,
      passwordHasher,
      tokenService,
      mailService,
    });

    // 1. Cria empresa Angaran (Admin) e Oficina Cliente
    const resCompAdmin = await app.inject({
      method: 'POST',
      url: '/api/companies',
      payload: { cnpj: cnpjAngaran, tradeName: 'Angaran Tecnologia' },
    });
    expect(resCompAdmin.statusCode).toBe(201);

    const resCompOficina = await app.inject({
      method: 'POST',
      url: '/api/companies',
      payload: { cnpj: cnpjOficina, tradeName: 'Oficina Mecânica Troca Certa' },
    });
    expect(resCompOficina.statusCode).toBe(201);

    // Semeia usuário ADMIN da plataforma
    const adminHash = await passwordHasher.hash('Admin@2026!');
    await userRepo.create({
      companyId: 1,
      cnpj: '11222333000181',
      name: 'Thiago Admin',
      login: 'thiago.admin',
      email: 'thiago@engine.lat',
      phone: '11999990000',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: AccountStatus.APPROVED,
    });

    // 2. Operador da oficina faz signup (inicia como PENDING)
    const resSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        cnpj: cnpjOficina,
        name: 'Marcos Balconista',
        login: 'marcos.oficina',
        email: 'marcos@trocacerta.com.br',
        phone: '(11) 98888-1234',
        password: 'Oficina@2026!',
      },
    });
    expect(resSignup.statusCode).toBe(201);
    const operatorId = resSignup.json<{ id: number }>().id;

    // 3. Admin faz login e aprova a conta do operador
    const resAdminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'thiago.admin', password: 'Admin@2026!' },
    });
    expect(resAdminLogin.statusCode).toBe(200);
    const adminToken = resAdminLogin.json<{ accessToken: string }>().accessToken;

    const resApprove = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${operatorId}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decision: AccountStatus.APPROVED },
    });
    expect(resApprove.statusCode).toBe(200);

    // 4. Admin cadastra 2 versões de Jeep Compass (para testar desambiguação) e especificações
    const resVeh1 = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        manufacturer: 'Jeep',
        model: 'Compass',
        version: '1.3 Turbo Flex T270',
        type: 'UTILITARIO',
        manufYearStart: 2022,
        manufYearEnd: 2026,
      },
    });
    expect(resVeh1.statusCode).toBe(201);
    const compassFlexId = resVeh1.json<{ id: number }>().id;

    await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        manufacturer: 'Jeep',
        model: 'Compass',
        version: '2.0 Turbodiesel TD350',
        type: 'UTILITARIO',
        manufYearStart: 2022,
        manufYearEnd: 2025,
      },
    });

    const resCatOleo = await app.inject({
      method: 'POST',
      url: '/api/catalogs',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        category: CatalogCategory.OLEO,
        subtype: CatalogSubtype.MOTOR,
        name: 'Óleo 0W-30 C2',
        specification: 'SAE 0W-30 ACEA C2 Fiat 9.55535-GS1',
      },
    });
    const catalogOleoId = resCatOleo.json<{ id: number }>().id;

    await app.inject({
      method: 'POST',
      url: '/api/technical-specifications',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vehicleId: compassFlexId,
        catalogId: catalogOleoId,
        capacityLiters: 4.5,
        intervalKm: 10000,
      },
    });

    // 5. Operador aprovado faz login e cadastra produtos e cliente da oficina
    const resOpLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.oficina', password: 'Oficina@2026!' },
    });
    expect(resOpLogin.statusCode).toBe(200);
    const opToken = resOpLogin.json<{ accessToken: string }>().accessToken;

    const resProd1 = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${opToken}` },
      payload: {
        catalogId: catalogOleoId,
        name: 'Selenia Forward 0W-30 1L',
        manufacturer: 'Petronas',
        sku: 'SEL-0W30',
        price: 68.0,
        isBestQuality: true,
      },
    });
    expect(resProd1.statusCode).toBe(201);
    const productId = resProd1.json<{ id: number }>().id;

    const resClient = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { authorization: `Bearer ${opToken}` },
      payload: {
        name: 'Roberto Cliente',
        phone: '(11) 97777-8888',
        email: 'roberto@cliente.com.br',
      },
    });
    expect(resClient.statusCode).toBe(201);
    const clientId = resClient.json<{ id: number }>().id;

    // 6. Operador pesquisa "Compass" -> recebe lista de desambiguação
    const resDisambiguate = await app.inject({
      method: 'GET',
      url: '/api/vehicles/disambiguate?q=Compass&year=2023',
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(resDisambiguate.statusCode).toBe(200);
    expect(resDisambiguate.json<{ requiresDisambiguation: boolean }>().requiresDisambiguation).toBe(
      true,
    );

    // 7. Operador consulta as 3 opções de orçamento para o Compass T270 (4.5L * R$ 68,00 = R$ 306,00)
    const resOptions = await app.inject({
      method: 'GET',
      url: `/api/quotes/options/${compassFlexId}`,
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(resOptions.statusCode).toBe(200);
    expect(resOptions.json<{ bestQuality: { totalAmount: number } }>().bestQuality.totalAmount).toBe(
      306.0,
    );

    // 8. Operador salva e envia o orçamento por e-mail
    const resCreateQuote = await app.inject({
      method: 'POST',
      url: '/api/quotes',
      headers: { authorization: `Bearer ${opToken}` },
      payload: {
        vehicleId: compassFlexId,
        clientId,
        profile: 'BEST_QUALITY',
        items: [{ productId, quantity: 4.5, unitPrice: 68.0 }],
      },
    });
    expect(resCreateQuote.statusCode).toBe(201);
    const quoteId = resCreateQuote.json<{ id: number }>().id;

    const resSendEmail = await app.inject({
      method: 'POST',
      url: `/api/quotes/${quoteId}/send-email`,
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(resSendEmail.statusCode).toBe(200);
    expect(resSendEmail.json<{ status: string }>().status).toBe('SENT');
    expect(mailService.sentEmails).toHaveLength(1);
    expect(mailService.sentEmails[0]?.to).toBe('roberto@cliente.com.br');

    // 9. Operador atualiza dados do cliente via PATCH /api/clients/:id
    const resPatchClient = await app.inject({
      method: 'PATCH',
      url: `/api/clients/${clientId}`,
      headers: { authorization: `Bearer ${opToken}` },
      payload: {
        name: 'Roberto Cliente VIP',
        phone: '(11) 96666-5555',
        email: 'roberto.vip@cliente.com.br',
      },
    });
    expect(resPatchClient.statusCode).toBe(200);
    expect(resPatchClient.json<{ name: string; email: string }>()).toMatchObject({
      name: 'Roberto Cliente VIP',
      email: 'roberto.vip@cliente.com.br',
    });

    // 10. Operador processa importação/atualização em lote de estoque via POST /api/products/batch
    const resBatchProducts = await app.inject({
      method: 'POST',
      url: '/api/products/batch',
      headers: { authorization: `Bearer ${opToken}` },
      payload: {
        items: [
          {
            id: productId,
            catalogId: catalogOleoId,
            name: 'Selenia Forward 0W-30 1L (Reajuste)',
            manufacturer: 'Petronas',
            sku: 'SEL-0W30',
            price: 72.0,
            isBestQuality: true,
          },
          {
            catalogId: catalogOleoId,
            name: 'Lubrax Valora 0W-30 1L',
            manufacturer: 'Vibra',
            sku: 'LUB-0W30',
            price: 49.9,
            isBestQuality: false,
          },
        ],
      },
    });
    expect(resBatchProducts.statusCode).toBe(200);
    expect(
      resBatchProducts.json<{ createdCount: number; updatedCount: number; totalProcessed: number }>(),
    ).toEqual({
      createdCount: 1,
      updatedCount: 1,
      totalProcessed: 2,
    });

    // 11. Operador exclui orçamento do histórico via DELETE /api/quotes/:id
    const resDeleteQuote = await app.inject({
      method: 'DELETE',
      url: `/api/quotes/${quoteId}`,
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(resDeleteQuote.statusCode).toBe(204);

    const resQuotesAfterDelete = await app.inject({
      method: 'GET',
      url: '/api/quotes',
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(resQuotesAfterDelete.statusCode).toBe(200);
    expect(resQuotesAfterDelete.json<unknown[]>()).toHaveLength(0);

    // 12. Admin edita veículo in-place (PATCH /api/vehicles/:id), catálogo (PATCH /api/catalogs/:id) e lista todas as contas (GET /api/admin/users?status=ALL)
    const resPatchVehicle = await app.inject({
      method: 'PATCH',
      url: `/api/vehicles/${compassFlexId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        manufacturer: 'Jeep',
        model: 'Compass',
        version: '1.3 Turbo Flex T270 Série S',
        type: 'UTILITARIO',
        manufYearStart: 2022,
        manufYearEnd: 2026,
      },
    });
    expect(resPatchVehicle.statusCode).toBe(200);
    expect(resPatchVehicle.json<{ version: string }>().version).toBe('1.3 Turbo Flex T270 Série S');

    const resPatchCatalog = await app.inject({
      method: 'PATCH',
      url: `/api/catalogs/${catalogOleoId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        category: CatalogCategory.OLEO,
        subtype: CatalogSubtype.MOTOR,
        name: 'Óleo 0W-30 C2 Revisado',
        specification: 'SAE 0W-30 API SP ACEA C2 Fiat 9.55535-GS1 (Revisado)',
      },
    });
    expect(resPatchCatalog.statusCode).toBe(200);
    expect(resPatchCatalog.json<{ specification: string }>().specification).toContain('(Revisado)');

    const resListAllUsers = await app.inject({
      method: 'GET',
      url: '/api/admin/users?status=ALL',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resListAllUsers.statusCode).toBe(200);
    expect(resListAllUsers.json<Array<{ login: string; companyTradeName: string }>>()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          login: 'marcos.oficina',
          companyTradeName: 'Oficina Mecânica Troca Certa',
        }),
      ]),
    );
  });
});
