import { describe, expect, it } from 'vitest';
import { InMemoryCatalogRepository } from '../../src/infra/database/in-memory/InMemoryCatalogRepository.js';
import { InMemoryClientRepository } from '../../src/infra/database/in-memory/InMemoryClientRepository.js';
import { InMemoryCompanyRepository } from '../../src/infra/database/in-memory/InMemoryCompanyRepository.js';
import { InMemoryProductRepository } from '../../src/infra/database/in-memory/InMemoryProductRepository.js';
import { InMemoryQuoteRepository } from '../../src/infra/database/in-memory/InMemoryQuoteRepository.js';
import { InMemoryUserRepository } from '../../src/infra/database/in-memory/InMemoryUserRepository.js';
import { InMemoryVehicleRepository } from '../../src/infra/database/in-memory/InMemoryVehicleRepository.js';
import { seedDemoData } from '../../src/infra/database/seedDemoData.js';
import { FakeMailService } from '../../src/infra/mail/FakeMailService.js';
import { JwtTokenService } from '../../src/infra/security/JwtTokenService.js';
import { ScryptPasswordHasher } from '../../src/infra/security/ScryptPasswordHasher.js';
import { buildApp } from '../../src/presentation/app.js';

describe('Web Portal Routes (/principal, /help, /index), Zero-Blue Theme & Demo Fleet Seeder', () => {
  it('deve servir /principal, /help, /index e garantir paleta Material 3 Âmbar/Grafite sem cor azul', async () => {
    const deps = {
      companyRepo: new InMemoryCompanyRepository(),
      userRepo: new InMemoryUserRepository(),
      clientRepo: new InMemoryClientRepository(),
      vehicleRepo: new InMemoryVehicleRepository(),
      catalogRepo: new InMemoryCatalogRepository(),
      productRepo: new InMemoryProductRepository(),
      quoteRepo: new InMemoryQuoteRepository(),
      passwordHasher: new ScryptPasswordHasher(),
      tokenService: new JwtTokenService('soil-test-secret'),
      mailService: new FakeMailService(),
    };

    await seedDemoData(deps);
    const app = buildApp(deps);

    for (const route of ['/', '/index', '/oficina', '/admin', '/principal', '/auth', '/help']) {
      const res = await app.inject({ method: 'GET', url: route });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('quote-drawer');
      expect(res.body).toContain('omnibox-bar');
      expect(res.body).toContain('/logo-soil3.png');
      expect(res.body).toContain('Google+Sans+Flex');
      expect(res.body).toContain('Google+Sans+Code');
      expect(res.body).toContain('agy-particles-canvas');
      expect(res.body).toContain('view-oficina');
      expect(res.body).toContain('view-admin');
      expect(res.body).toContain('view-auth');
      expect(res.body).toContain('visitor-actions');
      expect(res.body).toContain('logged-actions');
      expect(res.body).toContain('filter-category');
      expect(res.body).toContain('filter-manufacturer');
      expect(res.body).toContain('filter-model');
      expect(res.body).toContain('filter-year');
      expect(res.body).toContain('toast-viewport');
      expect(res.body).toContain('omnibox-suggestions');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body).toContain('/logo-soil.svg');
      expect(res.body).toContain('oficina-kpi-strip');
      expect(res.body).toContain('admin-kpi-strip');
      expect(res.body).toContain('prod-subtype-pills');
      expect(res.body).toContain('btn-toggle-bottle-rounding');
      expect(res.body).not.toContain('persona-switcher');
      expect(res.body).not.toContain('brand-subtitle');
      expect(res.body).not.toContain('theme-toggle');
      // Garante que a Omnibox não vem poluída com valores mock pré-preenchidos nem jargão técnico
      expect(res.body).not.toContain('value="Compass"');
      expect(res.body).not.toContain('POST /api/');
      expect(res.body).not.toContain('GET /api/');
      expect(res.body).not.toContain('(/admin)');
      expect(res.body).not.toContain('(/index)');
    }

    const logoRes = await app.inject({ method: 'GET', url: '/logo-soil3.png' });
    expect(logoRes.statusCode).toBe(200);
    expect(logoRes.headers['content-type']).toBe('image/png');
    expect(logoRes.rawPayload.subarray(0, 4).toString('hex')).toBe('89504e47');

    const favSvgRes = await app.inject({ method: 'GET', url: '/favicon.svg' });
    expect(favSvgRes.statusCode).toBe(200);
    expect(favSvgRes.headers['content-type']).toContain('image/svg+xml');
    expect(favSvgRes.body).toContain('soil-fav-gold');

    const favIcoRes = await app.inject({ method: 'GET', url: '/favicon.ico' });
    expect(favIcoRes.statusCode).toBe(200);
    expect(favIcoRes.headers['content-type']).toContain('image/x-icon');

    const favPngRes = await app.inject({ method: 'GET', url: '/favicon-96x96.png' });
    expect(favPngRes.statusCode).toBe(200);
    expect(favPngRes.headers['content-type']).toBe('image/png');

    const appleIconRes = await app.inject({ method: 'GET', url: '/apple-touch-icon.png' });
    expect(appleIconRes.statusCode).toBe(200);
    expect(appleIconRes.headers['content-type']).toBe('image/png');

    const manifestRes = await app.inject({ method: 'GET', url: '/site.webmanifest' });
    expect(manifestRes.statusCode).toBe(200);
    expect(manifestRes.headers['content-type']).toContain('application/manifest+json');
    expect(manifestRes.body).toContain('web-app-manifest-512x512.png');

    const svgLogoRes = await app.inject({ method: 'GET', url: '/logo-soil.svg' });
    expect(svgLogoRes.statusCode).toBe(200);
    expect(svgLogoRes.headers['content-type']).toContain('image/svg+xml');
    expect(svgLogoRes.body).toContain('<svg');

    const cssRes = await app.inject({ method: 'GET', url: '/styles.css' });
    expect(cssRes.statusCode).toBe(200);
    expect(cssRes.body).toContain('--palette-grey-1200: #0a0b0e');
    expect(cssRes.body).toContain('--shape-corner-xl: 36px');
    expect(cssRes.body).toContain('Google Sans Flex');
    expect(cssRes.body).toContain('.subtype-filter-bar');
    expect(cssRes.body).toContain('.custom-select-search-input');
    expect(cssRes.body.toLowerCase()).not.toContain('#1a73e8');
    expect(cssRes.body.toLowerCase()).not.toContain('#3279f9');
    expect(cssRes.body.toLowerCase()).not.toContain('#3b82f6');
    expect(cssRes.body.toLowerCase()).not.toContain('#0000ff');

    // Valida que /index pode consultar a frota nacional sanitizada do TecDoc (3.300+ veículos, 65 montadoras)
    const publicDisambigRes = await app.inject({
      method: 'GET',
      url: '/api/vehicles/disambiguate?q=',
    });
    expect(publicDisambigRes.statusCode).toBe(200);
    expect(publicDisambigRes.json<{ candidates: unknown[] }>().candidates.length).toBeGreaterThan(3300);

    const publicLookupRes = await app.inject({
      method: 'GET',
      url: '/api/lookup/250',
    });
    expect(publicLookupRes.statusCode).toBe(200);
    expect(publicLookupRes.json<{ specifications: unknown[] }>().specifications).toHaveLength(6);

    // Valida que o seedDemoData populou os 6 itens obrigatórios e as 3 faixas de orçamento
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'Oficina@2026!' },
    });
    expect(loginRes.statusCode).toBe(200);
    const token = loginRes.json<{ accessToken: string }>().accessToken;

    const lookupRes = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(lookupRes.statusCode).toBe(200);
    const lookupBody = lookupRes.json<{ specifications: unknown[] }>();
    expect(lookupBody.specifications).toHaveLength(6);

    const optionsRes = await app.inject({
      method: 'GET',
      url: '/api/quotes/options/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(optionsRes.statusCode).toBe(200);
    const options = optionsRes.json<{
      cheapest: { totalAmount: number };
      bestQuality: { totalAmount: number };
      mostExpensive: { totalAmount: number };
    }>();

    expect(options.cheapest.totalAmount).toBeLessThan(options.bestQuality.totalAmount);
    expect(options.bestQuality.totalAmount).toBeLessThan(options.mostExpensive.totalAmount);

    // Valida endpoints de listagem usados pelas rotas /oficina e /admin
    const productsRes = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(productsRes.statusCode).toBe(200);
    expect(productsRes.json<unknown[]>().length).toBeGreaterThan(0);

    const catalogsRes = await app.inject({
      method: 'GET',
      url: '/api/catalogs',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(catalogsRes.statusCode).toBe(200);
    expect(catalogsRes.json<unknown[]>().length).toBeGreaterThanOrEqual(6);

    const quotesRes = await app.inject({
      method: 'GET',
      url: '/api/quotes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(quotesRes.statusCode).toBe(200);
    expect(quotesRes.json<unknown[]>().length).toBeGreaterThanOrEqual(2);

    // Admin curadoria GET /api/admin/users deve bloquear USER comum (403) e liberar ADMIN (200)
    const forbiddenAdminRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(forbiddenAdminRes.statusCode).toBe(403);

    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'thiago.admin', password: 'Soil@2026!' },
    });
    expect(adminLoginRes.statusCode).toBe(200);
    const adminToken = adminLoginRes.json<{ accessToken: string }>().accessToken;

    const adminUsersRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminUsersRes.statusCode).toBe(200);
  });

  it('deve aplicar cache LRU em memória com invalidação automática (RNF01) e headers/rate-limiting (RNF02)', async () => {
    const deps = {
      companyRepo: new InMemoryCompanyRepository(),
      userRepo: new InMemoryUserRepository(),
      clientRepo: new InMemoryClientRepository(),
      vehicleRepo: new InMemoryVehicleRepository(),
      catalogRepo: new InMemoryCatalogRepository(),
      productRepo: new InMemoryProductRepository(),
      quoteRepo: new InMemoryQuoteRepository(),
      passwordHasher: new ScryptPasswordHasher(),
      tokenService: new JwtTokenService('soil-test-secret'),
      mailService: new FakeMailService(),
      rateLimitMaxRequests: 3,
      rateLimitWindowMs: 60_000,
    };

    await seedDemoData(deps);
    const app = buildApp(deps);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'Oficina@2026!' },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.headers['x-content-type-options']).toBe('nosniff');
    expect(loginRes.headers['x-frame-options']).toBe('DENY');

    const loginBody = loginRes.json<{
      accessToken: string;
      user: { companyTradeName: string | null; cnpjFormatted: string | null };
    }>();
    expect(loginBody.user.companyTradeName).toContain('Auto Center Paulista');
    expect(loginBody.user.cnpjFormatted).toBeTruthy();

    const token = loginBody.accessToken;

    // 1ª consulta: Cache MISS
    const firstLookup = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(firstLookup.statusCode).toBe(200);
    expect(firstLookup.headers['x-cache']).toBe('MISS');

    // 2ª consulta seguida: Cache HIT
    const secondLookup = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(secondLookup.statusCode).toBe(200);
    expect(secondLookup.headers['x-cache']).toBe('HIT');

    // Mutação de estoque invalida o cache do tenant automaticamente
    const createProd = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        catalogId: 1,
        manufacturer: 'Castrol',
        name: 'Magnatec Stop-Start 0W-20',
        sku: 'CAS-0W20',
        price: 74.9,
        isBestQuality: false,
      },
    });
    expect(createProd.statusCode).toBe(201);

    const createdProdId = createProd.json<{ id: number }>().id;

    const thirdLookup = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(thirdLookup.statusCode).toBe(200);
    expect(thirdLookup.headers['x-cache']).toBe('MISS');

    // 4ª consulta seguida: Cache HIT
    const fourthLookup = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(fourthLookup.statusCode).toBe(200);
    expect(fourthLookup.headers['x-cache']).toBe('HIT');

    // Atualização in-place de produto (PATCH /api/products/:id) atualiza preço e invalida cache LRU do CNPJ
    const patchProd = await app.inject({
      method: 'PATCH',
      url: `/api/products/${createdProdId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        catalogId: 1,
        manufacturer: 'Castrol',
        name: 'Magnatec Stop-Start 0W-20 (Atualizado)',
        sku: 'CAS-0W20-V2',
        price: 79.9,
        isBestQuality: true,
      },
    });
    expect(patchProd.statusCode).toBe(200);
    expect(patchProd.json<{ price: number; sku: string; isBestQuality: boolean }>()).toMatchObject({
      price: 79.9,
      sku: 'CAS-0W20-V2',
      isBestQuality: true,
    });

    const fifthLookup = await app.inject({
      method: 'GET',
      url: '/api/lookup/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(fifthLookup.statusCode).toBe(200);
    expect(fifthLookup.headers['x-cache']).toBe('MISS');

    // Rate limiting (RNF02): após 3 tentativas no mesmo IP/rota, bloqueia com 429
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'wrong' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'wrong' },
    });
    const rateLimitedRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'wrong' },
    });
    expect(rateLimitedRes.statusCode).toBe(429);
    expect(rateLimitedRes.headers['retry-after']).toBeDefined();
  });

  it('deve garantir precisão OEM no teste cego entre marcas e cobertura nas 4 categorias (CARRO, UTILITARIO, CAMINHAO, MOTO)', async () => {
    const deps = {
      companyRepo: new InMemoryCompanyRepository(),
      userRepo: new InMemoryUserRepository(),
      clientRepo: new InMemoryClientRepository(),
      vehicleRepo: new InMemoryVehicleRepository(),
      catalogRepo: new InMemoryCatalogRepository(),
      productRepo: new InMemoryProductRepository(),
      quoteRepo: new InMemoryQuoteRepository(),
      passwordHasher: new ScryptPasswordHasher(),
      tokenService: new JwtTokenService('soil-test-secret'),
      mailService: new FakeMailService(),
    };

    await seedDemoData(deps);
    const app = buildApp(deps);

    const allRes = await app.inject({ method: 'GET', url: '/api/vehicles/disambiguate?q=' });
    expect(allRes.statusCode).toBe(200);
    const allVehicles = allRes.json<{
      candidates: Array<{
        id: number;
        manufacturer: string;
        model: string;
        version: string;
        type: string;
        manufYearStart: number;
        manufYearEnd: number;
      }>;
    }>().candidates;

    // 1. Cobertura nas 4 categorias do seletor de /index
    const types = new Set(allVehicles.map((v) => v.type));
    expect(types.has('CARRO')).toBe(true);
    expect(types.has('UTILITARIO')).toBe(true);
    expect(types.has('CAMINHAO')).toBe(true);
    expect(types.has('MOTO')).toBe(true);

    // 2. Nenhum veículo 100% elétrico sem motor a combustão (ex: 500e) deve constar na base de troca de óleo
    const bev500e = allVehicles.find((v) => /\b500e\b/i.test(`${v.model} ${v.version}`));
    expect(bev500e).toBeUndefined();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { loginOrEmail: 'marcos.paulista', password: 'Oficina@2026!' },
    });
    const token = loginRes.json<{ accessToken: string }>().accessToken;

    // 3. Teste cego em modelos icônicos: Honda Civic G10, Toyota Hilux Diesel, VW Gol G5, Honda CG 160, Mercedes Sprinter
    const civic = allVehicles.find(
      (v) => v.manufacturer === 'Honda' && v.model === 'Civic' && v.manufYearStart >= 2016,
    );
    expect(civic).toBeDefined();
    const civicLookup = await app.inject({
      method: 'GET',
      url: `/api/lookup/${civic!.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(civicLookup.statusCode).toBe(200);
    const civicSpecs = civicLookup.json<{
      specifications: Array<{
        category: string;
        subtype: string;
        name: string;
        specification: string;
        notes: string;
        availableProducts: Array<{ name: string; sku: string }>;
      }>;
    }>().specifications;
    const civicOil = civicSpecs.find((s) => s.category === 'OLEO' && s.subtype === 'MOTOR')!;
    const civicOilFilter = civicSpecs.find((s) => s.category === 'FILTRO' && s.subtype === 'OLEO')!;
    expect(civicOil.specification).toContain('0W-20');
    expect(civicOil.specification).not.toContain('Fiat');
    expect(civicOilFilter.specification).not.toContain('W 712/95');
    expect(civicOilFilter.specification).not.toContain('LIFE-TIME-FILTER');
    expect(civicOilFilter.availableProducts.some((p) => /610|JFO-0410|OC 617/i.test(p.sku))).toBe(true);

    const hilux = allVehicles.find(
      (v) => v.manufacturer === 'Toyota' && v.model === 'Hilux' && /2\.8|D-4D|Diesel/i.test(v.version),
    );
    expect(hilux).toBeDefined();
    const hiluxLookup = await app.inject({ method: 'GET', url: `/api/lookup/${hilux!.id}` });
    const hiluxSpecs = hiluxLookup.json<{
      specifications: Array<{ category: string; subtype: string; name: string; specification: string }>;
    }>().specifications;
    const hiluxTrans = hiluxSpecs.find((s) => s.category === 'OLEO' && s.subtype === 'CAMBIO')!;
    expect(hiluxTrans.name).not.toContain('CVT');

    const cg160 = allVehicles.find((v) => v.manufacturer === 'Honda' && v.model === 'CG 160');
    expect(cg160).toBeDefined();
    expect(cg160!.type).toBe('MOTO');
    const cgLookup = await app.inject({ method: 'GET', url: `/api/lookup/${cg160!.id}` });
    const cgSpecs = cgLookup.json<{
      specifications: Array<{ category: string; subtype: string; specification: string }>;
    }>().specifications;
    const cgOil = cgSpecs.find((s) => s.category === 'OLEO' && s.subtype === 'MOTOR')!;
    expect(cgOil.specification).toContain('10W-30');
    expect(cgOil.specification).toContain('JASO MA2');
  });
});
