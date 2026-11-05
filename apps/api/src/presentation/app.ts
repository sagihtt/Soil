import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccountStatus,
  CatalogCategory,
  CatalogSubtype,
  QuoteProfile,
  UserRole,
} from '@soil/shared';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, z } from 'zod';
import { ICatalogRepository } from '../application/ports/ICatalogRepository.js';
import { IClientRepository } from '../application/ports/IClientRepository.js';
import { ICompanyRepository } from '../application/ports/ICompanyRepository.js';
import { IMailService } from '../application/ports/IMailService.js';
import { IPasswordHasher } from '../application/ports/IPasswordHasher.js';
import { IProductRepository } from '../application/ports/IProductRepository.js';
import { IQuoteRepository } from '../application/ports/IQuoteRepository.js';
import { IUserRepository } from '../application/ports/IUserRepository.js';
import { IVehicleRepository } from '../application/ports/IVehicleRepository.js';
import { AuthenticateUserUseCase } from '../application/use-cases/AuthenticateUserUseCase.js';
import {
  AssignTechnicalSpecUseCase,
  CreateCatalogItemUseCase,
  CreateVehicleUseCase,
  DeleteCatalogItemUseCase,
  DeleteVehicleUseCase,
  UpdateCatalogItemUseCase,
  UpdateVehicleUseCase,
} from '../application/use-cases/CatalogAndVehicleAdminUseCases.js';
import {
  CreateClientUseCase,
  DeleteClientUseCase,
  ListCompanyClientsUseCase,
  UpdateClientUseCase,
} from '../application/use-cases/ClientManagementUseCases.js';
import {
  BatchUpsertProductsUseCase,
  CreateProductUseCase,
  DeleteProductUseCase,
  LookupVehicleSpecsUseCase,
  SearchVehiclesForDisambiguationUseCase,
  UpdateProductUseCase,
} from '../application/use-cases/ProductAndLookupUseCases.js';
import {
  CreateOrUpdateQuoteUseCase,
  DeleteQuoteUseCase,
  GenerateQuoteOptionsUseCase,
  SendQuoteEmailUseCase,
} from '../application/use-cases/QuoteEngineUseCases.js';
import { RegisterCompanyUseCase } from '../application/use-cases/RegisterCompanyUseCase.js';
import { RegisterUserUseCase } from '../application/use-cases/RegisterUserUseCase.js';
import { ReviewUserAccountUseCase } from '../application/use-cases/ReviewUserAccountUseCase.js';
import {
  DomainError,
  ForbiddenOperationError,
  UnauthorizedOperationError,
} from '../domain/errors/DomainErrors.js';
import { LruCache } from '../infra/cache/LruCache.js';
import { AuthTokenPayload, JwtTokenService } from '../infra/security/JwtTokenService.js';
import { RateLimiter } from '../infra/security/RateLimiter.js';

export interface AppDependencies {
  companyRepo: ICompanyRepository;
  userRepo: IUserRepository;
  clientRepo: IClientRepository;
  vehicleRepo: IVehicleRepository;
  catalogRepo: ICatalogRepository;
  productRepo: IProductRepository;
  quoteRepo: IQuoteRepository;
  passwordHasher: IPasswordHasher;
  tokenService: JwtTokenService;
  mailService: IMailService;
  rateLimitMaxRequests?: number;
}

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const lookupCache = new LruCache<unknown>({ maxEntries: 250, ttlMs: 5 * 60 * 1000 });
  const publicRateLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: deps.rateLimitMaxRequests ?? 300,
  });

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    return payload;
  });

  function enforceRateLimit(req: FastifyRequest, reply: FastifyReply, bucketScope: string): boolean {
    const key = `${bucketScope}:${req.ip || 'local'}`;
    const status = publicRateLimiter.consume(key);
    reply.header('X-RateLimit-Remaining', String(status.remaining));
    if (!status.allowed) {
      reply
        .header('Retry-After', String(status.retryAfterSeconds))
        .status(429)
        .send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas em sequência. Aguarde alguns segundos antes de tentar novamente.',
          },
        });
      return false;
    }
    return true;
  }

  const registerCompany = new RegisterCompanyUseCase(deps.companyRepo);
  const registerUser = new RegisterUserUseCase(
    deps.companyRepo,
    deps.userRepo,
    deps.passwordHasher,
  );
  const authenticateUser = new AuthenticateUserUseCase(deps.userRepo, deps.passwordHasher);
  const reviewAccount = new ReviewUserAccountUseCase(deps.userRepo);

  const createClient = new CreateClientUseCase(deps.clientRepo);
  const updateClient = new UpdateClientUseCase(deps.clientRepo);
  const listClients = new ListCompanyClientsUseCase(deps.clientRepo);
  const deleteClient = new DeleteClientUseCase(deps.clientRepo);

  const createVehicle = new CreateVehicleUseCase(deps.vehicleRepo);
  const updateVehicle = new UpdateVehicleUseCase(deps.vehicleRepo);
  const deleteVehicle = new DeleteVehicleUseCase(deps.vehicleRepo);
  const createCatalog = new CreateCatalogItemUseCase(deps.catalogRepo);
  const updateCatalog = new UpdateCatalogItemUseCase(deps.catalogRepo);
  const deleteCatalog = new DeleteCatalogItemUseCase(deps.catalogRepo);
  const assignSpec = new AssignTechnicalSpecUseCase(deps.vehicleRepo, deps.catalogRepo);

  const createProduct = new CreateProductUseCase(deps.catalogRepo, deps.productRepo);
  const updateProduct = new UpdateProductUseCase(deps.catalogRepo, deps.productRepo);
  const batchUpsertProducts = new BatchUpsertProductsUseCase(deps.catalogRepo, deps.productRepo);
  const deleteProduct = new DeleteProductUseCase(deps.productRepo);
  const searchDisambiguation = new SearchVehiclesForDisambiguationUseCase(deps.vehicleRepo);
  const lookupSpecs = new LookupVehicleSpecsUseCase(
    deps.vehicleRepo,
    deps.catalogRepo,
    deps.productRepo,
  );

  const generateQuoteOptions = new GenerateQuoteOptionsUseCase(
    deps.vehicleRepo,
    deps.catalogRepo,
    deps.productRepo,
  );
  const saveQuote = new CreateOrUpdateQuoteUseCase(
    deps.quoteRepo,
    deps.productRepo,
    deps.clientRepo,
    deps.vehicleRepo,
  );
  const sendQuoteEmail = new SendQuoteEmailUseCase(
    deps.quoteRepo,
    deps.clientRepo,
    deps.vehicleRepo,
    deps.mailService,
  );
  const deleteQuote = new DeleteQuoteUseCase(deps.quoteRepo);

  async function requireAuth(req: FastifyRequest): Promise<AuthTokenPayload> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedOperationError('Token Bearer ausente no cabeçalho Authorization.');
    }
    const token = authHeader.slice(7).trim();
    const payload = await deps.tokenService.verify(token);
    if (payload.status !== AccountStatus.APPROVED && payload.role !== UserRole.ADMIN) {
      throw new ForbiddenOperationError('Sua conta ainda aguarda aprovação do administrador.');
    }
    return payload;
  }

  async function optionalAuth(req: FastifyRequest): Promise<AuthTokenPayload | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    try {
      const token = authHeader.slice(7).trim();
      if (!token) return null;
      const payload = await deps.tokenService.verify(token);
      if (payload.status !== AccountStatus.APPROVED && payload.role !== UserRole.ADMIN) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  app.setErrorHandler((error: Error, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof DomainError) {
      return reply.status(error.httpStatus).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de entrada inválidos.',
          issues: error.issues,
        },
      });
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno inesperado no servidor.',
      },
    });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'soil-api' }));

  // RF11: Rotas do Portal Web (/principal, /help, /index) e arquivos estáticos
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const webPublicDir = resolve(currentDir, '../../../web/public');

  const serveSpaHtml = async (_req: FastifyRequest, reply: FastifyReply) => {
    const html = await readFile(resolve(webPublicDir, 'index.html'), 'utf-8');
    return reply
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .type('text/html; charset=utf-8')
      .send(html);
  };

  app.get('/', serveSpaHtml);
  app.get('/index', serveSpaHtml);
  app.get('/principal', serveSpaHtml);
  app.get('/oficina', serveSpaHtml);
  app.get('/admin', serveSpaHtml);
  app.get('/auth', serveSpaHtml);
  app.get('/help', serveSpaHtml);

  app.get('/styles.css', async (_req, reply) => {
    const css = await readFile(resolve(webPublicDir, 'styles.css'), 'utf-8');
    return reply
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .type('text/css; charset=utf-8')
      .send(css);
  });

  app.get('/app.js', async (_req, reply) => {
    const js = await readFile(resolve(webPublicDir, 'app.js'), 'utf-8');
    return reply
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .type('application/javascript; charset=utf-8')
      .send(js);
  });

  app.get('/logo-soil3.png', async (_req, reply) => {
    const png = await readFile(resolve(webPublicDir, 'logo-soil3.png'));
    return reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(png);
  });

  app.get('/logo-soil.svg', async (_req, reply) => {
    const svg = await readFile(resolve(webPublicDir, 'logo-soil.svg'), 'utf-8');
    return reply
      .type('image/svg+xml; charset=utf-8')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .send(svg);
  });

  app.get('/favicon.svg', async (_req, reply) => {
    const svg = await readFile(resolve(webPublicDir, 'favicon.svg'), 'utf-8');
    return reply
      .type('image/svg+xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=86400')
      .send(svg);
  });

  app.get('/favicon.ico', async (_req, reply) => {
    const ico = await readFile(resolve(webPublicDir, 'favicon.ico'));
    return reply
      .type('image/x-icon')
      .header('Cache-Control', 'public, max-age=86400')
      .send(ico);
  });

  for (const pngFile of [
    'favicon-96x96.png',
    'apple-touch-icon.png',
    'web-app-manifest-192x192.png',
    'web-app-manifest-512x512.png',
  ]) {
    app.get(`/${pngFile}`, async (_req, reply) => {
      const png = await readFile(resolve(webPublicDir, pngFile));
      return reply
        .type('image/png')
        .header('Cache-Control', 'public, max-age=86400')
        .send(png);
    });
  }

  app.get('/site.webmanifest', async (_req, reply) => {
    const manifest = await readFile(resolve(webPublicDir, 'site.webmanifest'), 'utf-8');
    return reply
      .type('application/manifest+json; charset=utf-8')
      .header('Cache-Control', 'public, max-age=86400')
      .send(manifest);
  });

  // RF01: Cadastrar Empresa (CNPJ)
  app.post('/api/companies', async (req, reply) => {
    if (!enforceRateLimit(req, reply, 'companies')) return;
    const body = z
      .object({
        cnpj: z.string(),
        tradeName: z.string(),
      })
      .parse(req.body);

    const company = await registerCompany.execute(body);
    return reply.status(201).send({
      id: company.id,
      cnpj: company.cnpj.value,
      cnpjFormatted: company.cnpj.formatted,
      tradeName: company.tradeName,
      status: company.status,
    });
  });

  // RF02: Cadastrar Usuário vinculado ao CNPJ
  app.post('/api/auth/signup', async (req, reply) => {
    if (!enforceRateLimit(req, reply, 'signup')) return;
    const body = z
      .object({
        cnpj: z.string(),
        name: z.string(),
        login: z.string(),
        email: z.string(),
        phone: z.string(),
        password: z.string(),
      })
      .parse(req.body);

    const user = await registerUser.execute(body);
    return reply.status(201).send({
      id: user.id,
      companyId: user.companyId,
      cnpj: user.cnpj.value,
      name: user.name,
      login: user.login,
      email: user.email.value,
      status: user.status,
    });
  });

  // RF03: Login JWT
  app.post('/api/auth/login', async (req, reply) => {
    if (!enforceRateLimit(req, reply, 'login')) return;
    const body = z
      .object({
        loginOrEmail: z.string(),
        password: z.string(),
      })
      .parse(req.body);

    const { user } = await authenticateUser.execute(body);
    const company = await deps.companyRepo.findById(user.companyId);
    const accessToken = await deps.tokenService.sign({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      status: user.status,
    });

    return reply.status(200).send({
      accessToken,
      user: {
        id: user.id,
        companyId: user.companyId,
        companyTradeName: company?.tradeName ?? 'Oficina Parceira',
        cnpjFormatted: user.cnpj.formatted,
        name: user.name,
        login: user.login,
        email: user.email.value,
        role: user.role,
        status: user.status,
      },
    });
  });

  // RF03: Curadoria Admin de Contas
  app.get('/api/admin/users', async (req, reply) => {
    const actor = await requireAuth(req);
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenOperationError('Apenas administradores podem consultar a fila de aprovação.');
    }
    const query = z
      .object({
        status: z
          .enum(['ALL', AccountStatus.PENDING, AccountStatus.APPROVED, AccountStatus.REJECTED])
          .optional(),
      })
      .parse(req.query);

    const statusFilter = query.status ?? AccountStatus.PENDING;
    const rawUsers =
      statusFilter === AccountStatus.PENDING
        ? await deps.userRepo.listPendingUsers()
        : await deps.userRepo.listAllUsers();

    const filteredUsers =
      statusFilter === 'ALL'
        ? rawUsers
        : rawUsers.filter((u) => u.status === statusFilter);

    const enriched = await Promise.all(
      filteredUsers.map(async (u) => {
        const company = await deps.companyRepo.findById(u.companyId);
        return {
          id: u.id,
          companyId: u.companyId,
          companyTradeName: company?.tradeName ?? 'Oficina Parceira',
          cnpj: u.cnpj.value,
          cnpjFormatted: u.cnpj.formatted,
          name: u.name,
          login: u.login,
          email: u.email.value,
          phone: u.phone.value,
          role: u.role,
          status: u.status,
        };
      }),
    );

    return reply.status(200).send(enriched);
  });

  app.post('/api/admin/users/:id/review', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = z
      .object({
        decision: z.enum([AccountStatus.APPROVED, AccountStatus.REJECTED]),
      })
      .parse(req.body);

    const updated = await reviewAccount.execute({
      actorRole: actor.role,
      targetUserId: params.id,
      decision: body.decision,
    });

    return reply.status(200).send({
      id: updated.id,
      status: updated.status,
    });
  });

  // RF04: Veículos (Admin CRUD + Busca de Desambiguação antes de /:id)
  app.get('/api/vehicles/disambiguate', async (req, reply) => {
    await optionalAuth(req);
    const query = z
      .object({
        q: z.string().default(''),
        year: z.coerce.number().int().optional(),
      })
      .parse(req.query);

    const searchParams: { query: string; year?: number } = { query: query.q };
    if (query.year !== undefined) {
      searchParams.year = query.year;
    }

    const result = await searchDisambiguation.execute(searchParams);
    return reply.status(200).send({
      requiresDisambiguation: result.requiresDisambiguation,
      candidates: result.candidates.map((v) => ({
        id: v.id,
        manufacturer: v.manufacturer,
        model: v.model,
        version: v.version,
        type: v.type,
        manufYearStart: v.yearRange.start,
        manufYearEnd: v.yearRange.end,
        fullLabel: v.fullLabel,
      })),
    });
  });

  app.post('/api/vehicles', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        manufacturer: z.string(),
        model: z.string(),
        version: z.string().nullable().optional(),
        type: z.string(),
        manufYearStart: z.number().int(),
        manufYearEnd: z.number().int(),
      })
      .parse(req.body);

    const vehicle = await createVehicle.execute({
      actorRole: actor.role,
      manufacturer: body.manufacturer,
      model: body.model,
      version: body.version ?? null,
      type: body.type,
      manufYearStart: body.manufYearStart,
      manufYearEnd: body.manufYearEnd,
    });

    return reply.status(201).send({
      id: vehicle.id,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      version: vehicle.version,
      type: vehicle.type,
      manufYearStart: vehicle.yearRange.start,
      manufYearEnd: vehicle.yearRange.end,
    });
  });

  app.patch('/api/vehicles/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = z
      .object({
        manufacturer: z.string(),
        model: z.string(),
        version: z.string().nullable().optional(),
        type: z.string(),
        manufYearStart: z.number().int(),
        manufYearEnd: z.number().int(),
      })
      .parse(req.body);

    const updated = await updateVehicle.execute({
      actorRole: actor.role,
      vehicleId: params.id,
      manufacturer: body.manufacturer,
      model: body.model,
      version: body.version ?? null,
      type: body.type,
      manufYearStart: body.manufYearStart,
      manufYearEnd: body.manufYearEnd,
    });

    lookupCache.clear();
    return reply.status(200).send({
      id: updated.id,
      manufacturer: updated.manufacturer,
      model: updated.model,
      version: updated.version,
      type: updated.type,
      manufYearStart: updated.yearRange.start,
      manufYearEnd: updated.yearRange.end,
      fullLabel: updated.fullLabel,
    });
  });

  app.delete('/api/vehicles/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await deleteVehicle.execute({ actorRole: actor.role, vehicleId: params.id });
    lookupCache.clear();
    return reply.status(204).send();
  });

  // RF05: Catálogo Técnico dos 6 Itens e Vínculo com Veículo
  app.get('/api/catalogs', async (req, reply) => {
    await requireAuth(req);
    const items = await deps.catalogRepo.listAll();
    return reply.status(200).send(
      items.map((item) => ({
        id: item.id,
        category: item.category,
        subtype: item.subtype,
        name: item.name,
        specification: item.specification,
      })),
    );
  });

  app.post('/api/catalogs', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        category: z.enum([CatalogCategory.OLEO, CatalogCategory.FILTRO]),
        subtype: z.enum([
          CatalogSubtype.MOTOR,
          CatalogSubtype.FREIO,
          CatalogSubtype.CAMBIO,
          CatalogSubtype.OLEO,
          CatalogSubtype.COMBUSTIVEL,
          CatalogSubtype.AR,
        ]),
        name: z.string(),
        specification: z.string(),
      })
      .parse(req.body);

    const item = await createCatalog.execute({
      actorRole: actor.role,
      ...body,
    });

    lookupCache.clear();
    return reply.status(201).send(item);
  });

  app.patch('/api/catalogs/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = z
      .object({
        category: z.enum([CatalogCategory.OLEO, CatalogCategory.FILTRO]),
        subtype: z.enum([
          CatalogSubtype.MOTOR,
          CatalogSubtype.FREIO,
          CatalogSubtype.CAMBIO,
          CatalogSubtype.OLEO,
          CatalogSubtype.COMBUSTIVEL,
          CatalogSubtype.AR,
        ]),
        name: z.string(),
        specification: z.string(),
      })
      .parse(req.body);

    const updated = await updateCatalog.execute({
      actorRole: actor.role,
      catalogId: params.id,
      ...body,
    });

    lookupCache.clear();
    return reply.status(200).send(updated);
  });

  app.delete('/api/catalogs/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await deleteCatalog.execute({ actorRole: actor.role, catalogId: params.id });
    lookupCache.clear();
    return reply.status(204).send();
  });

  app.post('/api/technical-specifications', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        vehicleId: z.number().int().positive(),
        catalogId: z.number().int().positive(),
        capacityLiters: z.number().positive().nullable().optional(),
        intervalKm: z.number().int().positive().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(req.body);

    const spec = await assignSpec.execute({
      actorRole: actor.role,
      vehicleId: body.vehicleId,
      catalogId: body.catalogId,
      capacityLiters: body.capacityLiters ?? null,
      intervalKm: body.intervalKm ?? null,
      notes: body.notes ?? null,
    });

    lookupCache.clear();
    return reply.status(201).send(spec);
  });

  // RF06: Produtos por Empresa (companyId extraído do JWT - proteção total contra IDOR)
  app.get('/api/products', async (req, reply) => {
    const actor = await requireAuth(req);
    const products = await deps.productRepo.listByCompany(actor.companyId);
    return reply.status(200).send(
      products.map((product) => ({
        id: product.id,
        companyId: product.companyId,
        catalogId: product.catalogId,
        name: product.name,
        manufacturer: product.manufacturer,
        sku: product.sku,
        price: product.price.toDecimal(),
        isBestQuality: product.isBestQuality,
      })),
    );
  });

  app.post('/api/products', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        catalogId: z.number().int().positive(),
        name: z.string(),
        manufacturer: z.string(),
        sku: z.string().nullable().optional(),
        price: z.number(),
        isBestQuality: z.boolean().optional(),
      })
      .parse(req.body);

    const productInput: {
      companyId: number;
      userId: number;
      catalogId: number;
      name: string;
      manufacturer: string;
      sku?: string | null;
      price: number;
      isBestQuality?: boolean;
    } = {
      companyId: actor.companyId,
      userId: actor.userId,
      catalogId: body.catalogId,
      name: body.name,
      manufacturer: body.manufacturer,
      sku: body.sku ?? null,
      price: body.price,
    };

    if (body.isBestQuality !== undefined) {
      productInput.isBestQuality = body.isBestQuality;
    }

    const product = await createProduct.execute(productInput);
    lookupCache.invalidateByPrefix(`${actor.companyId}:`);

    return reply.status(201).send({
      id: product.id,
      companyId: product.companyId,
      catalogId: product.catalogId,
      name: product.name,
      manufacturer: product.manufacturer,
      sku: product.sku,
      price: product.price.toDecimal(),
      isBestQuality: product.isBestQuality,
    });
  });

  app.patch('/api/products/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = z
      .object({
        catalogId: z.number().int().positive(),
        name: z.string(),
        manufacturer: z.string(),
        sku: z.string().nullable().optional(),
        price: z.number().positive(),
        isBestQuality: z.boolean().optional(),
      })
      .parse(req.body);

    const updateInput: {
      productId: number;
      companyId: number;
      catalogId: number;
      name: string;
      manufacturer: string;
      sku?: string | null;
      price: number;
      isBestQuality?: boolean;
    } = {
      productId: params.id,
      companyId: actor.companyId,
      catalogId: body.catalogId,
      name: body.name,
      manufacturer: body.manufacturer,
      sku: body.sku ?? null,
      price: body.price,
    };

    if (body.isBestQuality !== undefined) {
      updateInput.isBestQuality = body.isBestQuality;
    }

    const updated = await updateProduct.execute(updateInput);
    lookupCache.invalidateByPrefix(`${actor.companyId}:`);

    return reply.status(200).send({
      id: updated.id,
      companyId: updated.companyId,
      catalogId: updated.catalogId,
      name: updated.name,
      manufacturer: updated.manufacturer,
      sku: updated.sku,
      price: updated.price.toDecimal(),
      isBestQuality: updated.isBestQuality,
    });
  });

  app.delete('/api/products/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await deleteProduct.execute({ companyId: actor.companyId, productId: params.id });
    lookupCache.invalidateByPrefix(`${actor.companyId}:`);
    return reply.status(204).send();
  });

  app.post('/api/products/batch', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        items: z
          .array(
            z.object({
              id: z.number().int().positive().nullable().optional(),
              catalogId: z.number().int().positive(),
              name: z.string(),
              manufacturer: z.string(),
              sku: z.string().nullable().optional(),
              price: z.number().positive(),
              isBestQuality: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(req.body);

    const result = await batchUpsertProducts.execute({
      companyId: actor.companyId,
      userId: actor.userId,
      items: body.items.map((item) => {
        const mapped: {
          id?: number | null;
          catalogId: number;
          name: string;
          manufacturer: string;
          sku?: string | null;
          price: number;
          isBestQuality?: boolean;
        } = {
          id: item.id ?? null,
          catalogId: item.catalogId,
          name: item.name,
          manufacturer: item.manufacturer,
          sku: item.sku ?? null,
          price: item.price,
        };
        if (item.isBestQuality !== undefined) {
          mapped.isBestQuality = item.isBestQuality;
        }
        return mapped;
      }),
    });

    lookupCache.invalidateByPrefix(`${actor.companyId}:`);

    return reply.status(200).send({
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      totalProcessed: result.products.length,
    });
  });

  // RF07: Carteira de Clientes por CNPJ
  app.post('/api/clients', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        name: z.string(),
        phone: z.string(),
        email: z.string(),
      })
      .parse(req.body);

    const client = await createClient.execute({
      companyId: actor.companyId,
      ...body,
    });

    return reply.status(201).send({
      id: client.id,
      companyId: client.companyId,
      name: client.name,
      phone: client.phone.value,
      email: client.email.value,
    });
  });

  app.get('/api/clients', async (req, reply) => {
    const actor = await requireAuth(req);
    const clients = await listClients.execute(actor.companyId);
    return reply.status(200).send(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone.value,
        email: c.email.value,
      })),
    );
  });

  app.patch('/api/clients/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = z
      .object({
        name: z.string(),
        phone: z.string(),
        email: z.string(),
      })
      .parse(req.body);

    const updated = await updateClient.execute({
      clientId: params.id,
      companyId: actor.companyId,
      name: body.name,
      phone: body.phone,
      email: body.email,
    });

    return reply.status(200).send({
      id: updated.id,
      companyId: updated.companyId,
      name: updated.name,
      phone: updated.phone.value,
      email: updated.email.value,
    });
  });

  app.delete('/api/clients/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await deleteClient.execute({ companyId: actor.companyId, clientId: params.id });
    return reply.status(204).send();
  });

  // RF08: Consulta Técnica dos 6 Itens + Produtos do CNPJ (Com Cache LRU RNF01)
  app.get('/api/lookup/:vehicleId', async (req, reply) => {
    const actor = await optionalAuth(req);
    const companyId = actor?.companyId ?? 0;
    const params = z
      .object({ vehicleId: z.coerce.number().int().positive() })
      .parse(req.params);

    const cacheKey = `${companyId}:${params.vehicleId}`;
    const cached = lookupCache.get(cacheKey);
    if (cached !== undefined) {
      return reply.header('X-Cache', 'HIT').status(200).send(cached);
    }

    const lookup = await lookupSpecs.execute({
      vehicleId: params.vehicleId,
      companyId,
    });

    const responsePayload = {
      vehicle: {
        id: lookup.vehicle.id,
        manufacturer: lookup.vehicle.manufacturer,
        model: lookup.vehicle.model,
        version: lookup.vehicle.version,
        type: lookup.vehicle.type,
        fullLabel: lookup.vehicle.fullLabel,
        manufYearStart: lookup.vehicle.yearRange.start,
        manufYearEnd: lookup.vehicle.yearRange.end,
      },
      specifications: lookup.specifications.map((s) => ({
        catalogId: s.catalogId,
        category: s.category,
        subtype: s.subtype,
        name: s.name,
        specification: s.specification,
        capacityLiters: s.capacityLiters,
        intervalKm: s.intervalKm,
        notes: s.notes,
        availableProducts: s.availableProducts.map((p) => ({
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          sku: p.sku,
          price: p.price.toDecimal(),
          isBestQuality: p.isBestQuality,
        })),
      })),
    };

    lookupCache.set(cacheKey, responsePayload);
    return reply.header('X-Cache', 'MISS').status(200).send(responsePayload);
  });

  // RF09: Opções Automáticas de Orçamento (Mais Barato, Melhor Qualidade, Mais Caro)
  app.get('/api/quotes/options/:vehicleId', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z
      .object({ vehicleId: z.coerce.number().int().positive() })
      .parse(req.params);

    const options = await generateQuoteOptions.execute({
      companyId: actor.companyId,
      vehicleId: params.vehicleId,
    });

    return reply.status(200).send(options);
  });

  // RF09: Criar, Listar ou Manipular Orçamento
  app.get('/api/quotes', async (req, reply) => {
    const actor = await requireAuth(req);
    const quotes = await deps.quoteRepo.listByCompany(actor.companyId);
    return reply.status(200).send(
      quotes.map((quote) => ({
        id: quote.id,
        companyId: quote.companyId,
        vehicleId: quote.vehicleId,
        clientId: quote.clientId,
        profile: quote.profile,
        status: quote.status,
        sentAt: quote.sentAt,
        totalAmount: quote.totalAmount.toDecimal(),
        items: quote.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          manufacturer: item.manufacturer,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toDecimal(),
          subtotal: item.subtotal.toDecimal(),
        })),
      })),
    );
  });

  app.post('/api/quotes', async (req, reply) => {
    const actor = await requireAuth(req);
    const body = z
      .object({
        quoteId: z.number().int().positive().optional(),
        vehicleId: z.number().int().positive(),
        clientId: z.number().int().positive().nullable().optional(),
        profile: z
          .enum([
            QuoteProfile.CHEAPEST,
            QuoteProfile.MOST_EXPENSIVE,
            QuoteProfile.BEST_QUALITY,
            QuoteProfile.CUSTOM,
          ])
          .default(QuoteProfile.CUSTOM),
        items: z
          .array(
            z.object({
              productId: z.number().int().positive(),
              quantity: z.number().positive(),
              unitPrice: z.number().positive().optional(),
            }),
          )
          .min(1),
      })
      .parse(req.body);

    const quoteInput: {
      quoteId?: number;
      companyId: number;
      userId: number;
      vehicleId: number;
      clientId: number | null;
      profile: QuoteProfile;
      items: Array<{ productId: number; quantity: number; unitPrice?: number }>;
    } = {
      companyId: actor.companyId,
      userId: actor.userId,
      vehicleId: body.vehicleId,
      clientId: body.clientId ?? null,
      profile: body.profile,
      items: body.items.map((i) => {
        const mapped: { productId: number; quantity: number; unitPrice?: number } = {
          productId: i.productId,
          quantity: i.quantity,
        };
        if (i.unitPrice !== undefined) {
          mapped.unitPrice = i.unitPrice;
        }
        return mapped;
      }),
    };

    if (body.quoteId !== undefined) {
      quoteInput.quoteId = body.quoteId;
    }

    const quote = await saveQuote.execute(quoteInput);

    return reply.status(201).send({
      id: quote.id,
      companyId: quote.companyId,
      vehicleId: quote.vehicleId,
      clientId: quote.clientId,
      profile: quote.profile,
      status: quote.status,
      totalAmount: quote.totalAmount.toDecimal(),
      items: quote.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        manufacturer: item.manufacturer,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toDecimal(),
        subtotal: item.subtotal.toDecimal(),
      })),
    });
  });

  // RF10: Enviar Orçamento por E-mail
  app.post('/api/quotes/:id/send-email', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);

    const sent = await sendQuoteEmail.execute({
      companyId: actor.companyId,
      quoteId: params.id,
    });

    return reply.status(200).send({
      id: sent.id,
      status: sent.status,
      sentAt: sent.sentAt,
      totalAmount: sent.totalAmount.toDecimal(),
    });
  });

  app.delete('/api/quotes/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await deleteQuote.execute({
      companyId: actor.companyId,
      quoteId: params.id,
    });
    return reply.status(204).send();
  });

  return app;
}
