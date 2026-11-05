import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { InMemoryCatalogRepository } from '../infra/database/in-memory/InMemoryCatalogRepository.js';
import { InMemoryClientRepository } from '../infra/database/in-memory/InMemoryClientRepository.js';
import { InMemoryCompanyRepository } from '../infra/database/in-memory/InMemoryCompanyRepository.js';
import { InMemoryProductRepository } from '../infra/database/in-memory/InMemoryProductRepository.js';
import { InMemoryQuoteRepository } from '../infra/database/in-memory/InMemoryQuoteRepository.js';
import { InMemoryUserRepository } from '../infra/database/in-memory/InMemoryUserRepository.js';
import { InMemoryVehicleRepository } from '../infra/database/in-memory/InMemoryVehicleRepository.js';
import { MysqlCatalogRepository } from '../infra/database/mysql/MysqlCatalogRepository.js';
import { MysqlClientRepository } from '../infra/database/mysql/MysqlClientRepository.js';
import { MysqlCompanyRepository } from '../infra/database/mysql/MysqlCompanyRepository.js';
import { createMysqlPool } from '../infra/database/mysql/MysqlConnectionPool.js';
import { MysqlProductRepository } from '../infra/database/mysql/MysqlProductRepository.js';
import { MysqlQuoteRepository } from '../infra/database/mysql/MysqlQuoteRepository.js';
import { MysqlUserRepository } from '../infra/database/mysql/MysqlUserRepository.js';
import { MysqlVehicleRepository } from '../infra/database/mysql/MysqlVehicleRepository.js';
import { seedDemoData } from '../infra/database/seedDemoData.js';
import { FakeMailService } from '../infra/mail/FakeMailService.js';
import { NodemailerSmtpService } from '../infra/mail/NodemailerSmtpService.js';
import { JwtTokenService } from '../infra/security/JwtTokenService.js';
import { ScryptPasswordHasher } from '../infra/security/ScryptPasswordHasher.js';
import { AppDependencies, buildApp } from './app.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';
  const jwtSecret = process.env['JWT_SECRET'] ?? 'soil-dev-secret-change-in-prod-2026';
  const useInMemory = process.env['USE_IN_MEMORY_DB'] === 'true';

  const passwordHasher = new ScryptPasswordHasher();
  const tokenService = new JwtTokenService(jwtSecret);

  const mailService = process.env['SMTP_HOST']
    ? new NodemailerSmtpService({
        host: process.env['SMTP_HOST'],
        port: Number(process.env['SMTP_PORT'] ?? 587),
        secure: process.env['SMTP_SECURE'] === 'true',
        user: process.env['SMTP_USER'] ?? '',
        pass: process.env['SMTP_PASS'] ?? '',
        from: process.env['SMTP_FROM'] ?? 'Orcamentos Soil <noreply@engine.lat>',
      })
    : new FakeMailService();

  let deps: AppDependencies;

  if (useInMemory) {
    deps = {
      companyRepo: new InMemoryCompanyRepository(),
      userRepo: new InMemoryUserRepository(),
      clientRepo: new InMemoryClientRepository(),
      vehicleRepo: new InMemoryVehicleRepository(),
      catalogRepo: new InMemoryCatalogRepository(),
      productRepo: new InMemoryProductRepository(),
      quoteRepo: new InMemoryQuoteRepository(),
      passwordHasher,
      tokenService,
      mailService,
    };
    await seedDemoData(deps);
  } else {
    const pool = createMysqlPool({
      host: process.env['DB_HOST'] ?? '127.0.0.1',
      port: Number(process.env['DB_PORT'] ?? 3306),
      user: process.env['DB_USER'] ?? 'dev',
      password: process.env['DB_PASSWORD'] ?? '',
      database: process.env['DB_NAME'] ?? 'soil',
    });

    deps = {
      companyRepo: new MysqlCompanyRepository(pool),
      userRepo: new MysqlUserRepository(pool),
      clientRepo: new MysqlClientRepository(pool),
      vehicleRepo: new MysqlVehicleRepository(pool),
      catalogRepo: new MysqlCatalogRepository(pool),
      productRepo: new MysqlProductRepository(pool),
      quoteRepo: new MysqlQuoteRepository(pool),
      passwordHasher,
      tokenService,
      mailService,
    };
  }

  const app = buildApp(deps);

  await app.register(cors, { origin: true });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.listen({ port, host });
  process.stdout.write(`Soil API listening on http://${host}:${port}\n`);
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(`Fatal error starting Soil API: ${String(err)}\n`);
  process.exit(1);
});
