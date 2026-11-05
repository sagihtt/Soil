import { AccountStatus, CatalogCategory, CatalogSubtype, QuoteProfile, QuoteStatus, UserRole } from '@soil/shared';
import { Pool, PoolConnection } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { Quote, QuoteItem } from '../../../src/domain/entities/Quote.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { MysqlCatalogRepository } from '../../../src/infra/database/mysql/MysqlCatalogRepository.js';
import { MysqlClientRepository } from '../../../src/infra/database/mysql/MysqlClientRepository.js';
import { MysqlCompanyRepository } from '../../../src/infra/database/mysql/MysqlCompanyRepository.js';
import { MysqlProductRepository } from '../../../src/infra/database/mysql/MysqlProductRepository.js';
import { MysqlQuoteRepository } from '../../../src/infra/database/mysql/MysqlQuoteRepository.js';
import { MysqlUserRepository } from '../../../src/infra/database/mysql/MysqlUserRepository.js';
import { MysqlVehicleRepository } from '../../../src/infra/database/mysql/MysqlVehicleRepository.js';

describe('MySQL Repositories Adapter Unit Tests (Prepared Statements & ACID Transactions)', () => {
  it('MysqlCompanyRepository deve buscar e inserir empresa com CNPJ higienizado via Prepared Statement', async () => {
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce([[{ id: 1, cnpj: '11222333000181', trade_name: 'Oficina 1', status: 'APPROVED', created_at: new Date() }], []])
      .mockResolvedValueOnce([{ insertId: 2 }, []]);

    const fakePool = { execute: executeMock } as unknown as Pool;
    const repo = new MysqlCompanyRepository(fakePool);

    const found = await repo.findByCnpj('11.222.333/0001-81');
    expect(found?.id).toBe(1);
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE cnpj = ?'),
      ['11222333000181'],
    );

    const created = await repo.create({
      cnpj: '11.444.777/0001-61',
      tradeName: 'Oficina 2',
    });
    expect(created.id).toBe(2);
    expect(created.cnpj.value).toBe('11444777000161');
  });

  it('MysqlUserRepository deve criar usuário e senha em transação atômica e dar rollback se falhar', async () => {
    const connExecuteMock = vi
      .fn()
      .mockResolvedValueOnce([{ insertId: 10 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const beginTransaction = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn();

    const fakeConn = {
      execute: connExecuteMock,
      beginTransaction,
      commit,
      rollback,
      release,
    } as unknown as PoolConnection;

    const fakePool = {
      getConnection: vi.fn().mockResolvedValue(fakeConn),
    } as unknown as Pool;

    const repo = new MysqlUserRepository(fakePool);
    const user = await repo.create({
      companyId: 1,
      cnpj: '11222333000181',
      name: 'Operador',
      login: 'operador1',
      email: 'op@oficina.com.br',
      phone: '11988887777',
      passwordHash: 'scrypt:salt:hash',
      role: UserRole.USER,
      status: AccountStatus.APPROVED,
    });

    expect(user.id).toBe(10);
    expect(beginTransaction).toHaveBeenCalledTimes(1);
    expect(connExecuteMock).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('MysqlVehicleRepository, MysqlCatalogRepository, MysqlProductRepository, MysqlClientRepository e MysqlQuoteRepository devem executar queries parametrizadas', async () => {
    const executeMock = vi.fn().mockResolvedValue([[], []]);
    const connExecuteMock = vi.fn().mockResolvedValue([{ insertId: 55 }, []]);
    const fakeConn = {
      execute: connExecuteMock,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolConnection;

    const fakePool = {
      execute: executeMock,
      getConnection: vi.fn().mockResolvedValue(fakeConn),
    } as unknown as Pool;

    const vehicleRepo = new MysqlVehicleRepository(fakePool);
    await vehicleRepo.searchApproximate('Compass', 2023);
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('BETWEEN manuf_year_start AND manuf_year_end'),
      ['%Compass%', '%Compass%', '%Compass%', '%Compass%', 2023],
    );

    const catalogRepo = new MysqlCatalogRepository(fakePool);
    executeMock.mockResolvedValueOnce([{ insertId: 7 }, []]);
    const cat = await catalogRepo.create({
      category: CatalogCategory.FILTRO,
      subtype: CatalogSubtype.COMBUSTIVEL,
      name: 'Filtro Combustível',
      specification: 'KL 582',
    });
    expect(cat.id).toBe(7);

    const productRepo = new MysqlProductRepository(fakePool);
    executeMock.mockResolvedValueOnce([{ insertId: 9 }, []]);
    const prod = await productRepo.create({
      companyId: 1,
      userId: 1,
      catalogId: 7,
      name: 'Filtro Mahle KL 582',
      manufacturer: 'Mahle',
      sku: 'KL582',
      priceCents: 4590,
      isBestQuality: true,
    });
    expect(prod.price.toDecimal()).toBe(45.9);

    executeMock.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    executeMock.mockResolvedValueOnce([
      [
        {
          id: 9,
          company_id: 1,
          user_id: 1,
          catalog_id: 7,
          name: 'Filtro Mahle KL 582 Atualizado',
          manufacturer: 'Mahle',
          sku: 'KL582-V2',
          price_cents: 4990,
          is_best_quality: 1,
          is_available: 1,
        },
      ],
      [],
    ]);
    const updatedProd = await productRepo.update({
      id: 9,
      companyId: 1,
      catalogId: 7,
      name: 'Filtro Mahle KL 582 Atualizado',
      manufacturer: 'Mahle',
      sku: 'KL582-V2',
      priceCents: 4990,
      isBestQuality: true,
    });
    expect(updatedProd?.price.toDecimal()).toBe(49.9);
    expect(updatedProd?.sku).toBe('KL582-V2');

    const clientRepo = new MysqlClientRepository(fakePool);
    executeMock.mockResolvedValueOnce([{ insertId: 12 }, []]);
    const client = await clientRepo.create({
      companyId: 1,
      name: 'Cliente Teste',
      phone: '11988887777',
      email: 'cliente@teste.com.br',
    });
    expect(client.id).toBe(12);

    const quoteRepo = new MysqlQuoteRepository(fakePool);
    const savedQuote = await quoteRepo.save(
      new Quote({
        id: 0,
        companyId: 1,
        userId: 1,
        vehicleId: 1,
        clientId: 12,
        profile: QuoteProfile.BEST_QUALITY,
        status: QuoteStatus.DRAFT,
        items: [
          new QuoteItem({
            productId: 9,
            productName: 'Filtro Mahle KL 582',
            manufacturer: 'Mahle',
            quantity: 1,
            unitPrice: Money.fromPositiveCents(4590),
          }),
        ],
      }),
    );
    expect(savedQuote.id).toBe(55);
  });
});
