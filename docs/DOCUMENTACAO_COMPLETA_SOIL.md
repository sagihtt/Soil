# Documentação Técnica e Funcional Completa: Plataforma SOIL (v1.0)

## 1. Visão Geral do Sistema e Propriedade Intelectual

O **Soil** é uma plataforma B2B multi-tenant desenvolvida do zero para centros automotivos, autopeças e oficinas mecânicas. O sistema resolve dois problemas operacionais de balcão:
1. **Consulta de Especificação Técnica sem Erro de Aplicação:** A partir da busca e desambiguação da motorização exata do veículo, retorna obrigatoriamente os **6 itens técnicos de revisão** (Óleo de Motor com capacidade do cárter em litros, Fluido de Freio, Fluido de Câmbio, Filtro de Óleo, Filtro de Combustível e Filtro de Ar).
2. **Motor de Orçamentos em 3 Faixas com Disparo por E-mail:** Cruza as especificações técnicas do veículo com o estoque e os preços exclusivos do CNPJ autenticado, gerando automaticamente três propostas prontas (`CHEAPEST` / Mais Barato, `BEST_QUALITY` / Melhor Qualidade e `MOST_EXPENSIVE` / Mais Caro), permitindo ajustes em tempo real e envio via SMTP para o cliente.

Todo o código-fonte, modelagem relacional, suíte de testes e identidade visual contidos em `C:\Users\thiag\Desktop\Engine\0.Desenvolvimento` foram construídos sob medida como propriedade intelectual exclusiva do autor do projeto.

---

## 2. Arquitetura do Monorepo e Organização de Diretórios

O projeto utiliza **TypeScript 5.8+ em modo estrito** (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`) estruturado em NPM Workspaces sob **Clean Architecture (Arquitetura Hexagonal)** e **Domain-Driven Design (DDD)**.

```text
C:\Users\thiag\Desktop\Engine\0.Desenvolvimento\
├── package.json                                  # Scripts globais do Monorepo (test, typecheck, build)
├── tsconfig.base.json                            # Configuração TypeScript estrita compartilhada
├── README.md                                     # Guia rápido de execução e referência da arquitetura
├── packages/
│   └── shared/
│       └── src/index.ts                          # Enums e contratos Zod compartilhados (6 itens, perfis, papéis)
├── infra/
│   └── database/
│       ├── migrations/001_initial_schema.sql     # DDL MySQL 8.0 (InnoDB, utf8mb4, Constraints, FULLTEXT)
│       ├── seeds/002_seed_brazilian_fleet.sql    # Frota nacional homologada + 6 itens + estoque demo
│       └── seeds/003_seed_tecdoc_national_fleet.sql # Seed relacional completo (93 catálogos, 3.851 veículos, 23.106 specs, 279 produtos)
├── scripts/
│   ├── sanitize-tecdoc.py                        # Pipeline ETL TecDoc + Curadoria + Gerador JSON/SQL
│   └── curated_fleet_data.py                     # Frota popular brasileira curada nas 4 categorias (CARRO, UTILITARIO, CAMINHAO, MOTO)
├── docs/
│   ├── DOCUMENTACAO_COMPLETA_SOIL.md             # Esta documentação técnica e funcional consolidada
│   ├── api/openapi.yaml                          # Especificação OpenAPI 3.1.0 completa da API REST
│   ├── plans/2026-10-24-soil-master-plan.md      # Plano Diretor de Engenharia e TDD
│   ├── arquitetura/
│   │   ├── soil_arquitetura_e_requisitos.md      # Documento de Arquitetura de Alto e Baixo Nível
│   │   └── soil_erd_atual.png                    # Diagrama Entidade-Relacionamento
│   └── conversacao/
│       ├── HISTORICO_CONVERSACAO_SOIL.md         # Transcrição legível em Markdown de toda a conversa
│       ├── RELATORIOS_SUBAGENTES_ARQUITETURA.md  # Análises completas dos 3 subagentes especialistas
│       ├── transcript.jsonl                      # Log estruturado compacto da sessão
│       └── transcript_full.jsonl                 # Log estruturado integral da sessão
└── apps/
    ├── web/
    │   └── public/
    │       ├── logo-soil3.png                    # Logo oficial do Soil com inversão automática claro/escuro
    │       ├── index.html                        # SPA com as 3 rotas (/index, /principal, /help)
    │       ├── styles.css                        # Design System inspirado em antigravity.google (Zero Azul)
    │       └── app.js                            # Motor de busca, desambiguação, partículas e gaveta de cotação
    └── api/
        ├── src/
        │   ├── domain/                           # Camada 1: Domínio Puro (Zero dependências externas)
        │   │   ├── errors/DomainErrors.ts
        │   │   ├── value-objects/                # Cnpj, Email, Phone, PasswordPolicy, Money, YearRange
        │   │   └── entities/                     # Company, User, Client, Vehicle, CatalogItem, TechnicalSpecification, Product, Quote
        │   ├── application/                      # Camada 2: Casos de Uso e Portas (Interfaces)
        │   │   ├── ports/                        # Contratos de Repositório, Hasher e MailService
        │   │   └── use-cases/                    # Casos de uso RF01 a RF10 + Strategies de Orçamento
        │   ├── infra/                            # Camada 3: Adaptadores Técnicos
        │   │   ├── database/in-memory/           # Repositórios em memória + seedDemoData.ts
        │   │   ├── database/mysql/               # Pool e Repositórios MySQL 8.0 com Prepared Statements
        │   │   ├── security/                     # ScryptPasswordHasher e JwtTokenService (HMAC-SHA256)
        │   │   └── mail/                         # NodemailerSmtpService e FakeMailService
        │   └── presentation/                     # Camada 4: Servidor HTTP Fastify 5
        │       ├── app.ts                        # Rotas REST, Middlewares JWT/Multi-Tenant e Portal Web
        │       └── server.ts                     # Bootstrap com alternância automática In-Memory / MySQL
        └── tests/                                # Suíte TDD (8 arquivos, 40 testes automatizados)
            ├── unit/domain/value-objects.spec.ts
            ├── unit/application/company-and-user.spec.ts
            ├── unit/application/client-and-auth.spec.ts
            ├── unit/application/automotive-catalog-and-lookup.spec.ts
            ├── unit/application/quote-engine.spec.ts
            ├── unit/infra/mysql-repositories.spec.ts
            ├── integration/http-api.spec.ts
            └── integration/web-routes.spec.ts
```

---

## 3. Detalhamento das Camadas Implementadas

### 3.1. Camada de Domínio (`apps/api/src/domain`)
Construída sem nenhuma biblioteca externa para garantir testabilidade em milissegundos e proteção de invariantes:
- **Objetos de Valor (`value-objects/`):**
  - `Cnpj.ts`: Higieniza pontuações, rejeita sequências repetidas (`00000000000000` a `99999999999999`) e aplica o cálculo oficial dos dois dígitos verificadores (**Módulo 11 da Receita Federal**).
  - `Money.ts`: Armazena valores monetários internamente como inteiros em centavos (`cents`), eliminando erros de arredondamento binário de ponto flutuante (`IEEE 754`) ao multiplicar preços unitários por litragens fracionárias (como `4.3` litros ou `3.75` litros).
  - `PasswordPolicy.ts`: Exige mínimo de 8 caracteres contendo letra maiúscula, letra minúscula, dígito numérico e caractere especial.
  - `Email.ts`, `Phone.ts` e `YearRange.ts`: Validam formato de e-mail normalizado, telefone brasileiro (10 ou 11 dígitos com DDD) e faixa de anos de fabricação (`1900 <= start <= end <= 2100`).
- **Entidades e Agregados (`entities/`):**
  - `CatalogItem.ts`: Impõe no nível de domínio a matriz estrita dos **6 itens obrigatórios**:
    - Categoria `OLEO` aceita apenas os subtipos `MOTOR`, `FREIO` e `CAMBIO`.
    - Categoria `FILTRO` aceita apenas os subtipos `OLEO`, `COMBUSTIVEL` e `AR`.
  - `Quote.ts`: Aggregate Root que encapsula a lista de itens (`QuoteItemProps`), recalcula automaticamente o `totalAmount` em centavos e controla a transição de status (`DRAFT` -> `FINALIZED` -> `SENT`).
- **Hierarquia de Erros (`errors/DomainErrors.ts`):**
  - Mapeia diretamente violações de negócio para códigos HTTP semânticos: `DomainValidationError` (`422`), `DuplicateResourceError` (`409`), `ResourceNotFoundError` (`404`), `ForbiddenOperationError` (`403`) e `UnauthorizedOperationError` (`401`).

### 3.2. Camada de Aplicação e Padrão Strategy (`apps/api/src/application`)
Contém os contratos de saída (`ports/`) e os Casos de Uso que implementam os Requisitos Funcionais `RF01` a `RF10`:
- `RegisterCompanyUseCase.ts` (`RF01`): Valida o CNPJ pelo Módulo 11, impede duplicidade de CNPJ e permite empresas distintas com o mesmo Nome Fantasia.
- `RegisterUserUseCase.ts` (`RF02`): Permite múltiplos operadores vinculados ao mesmo CNPJ, garantindo unicidade global de login e e-mail e aplicando hash criptográfico na senha.
- `AuthenticateUserUseCase.ts` e `ReviewUserAccountUseCase.ts` (`RF03`): Autentica credenciais, bloqueia contas `PENDING` ou `REJECTED` e permite que administradores (`ADMIN`) aprovem ou rejeitem contas.
- `ClientManagementUseCases.ts` (`RF07`): Gerencia a carteira de clientes isolada por `companyId`. O mesmo e-mail de cliente pode existir em duas oficinas distintas, mas nunca duplicado dentro do mesmo CNPJ.
- `CatalogAndVehicleAdminUseCases.ts` (`RF04`, `RF05`): Restringe a criação/exclusão de veículos, itens de catálogo e especificações técnicas exclusivamente ao papel `ADMIN`.
- `ProductAndLookupUseCases.ts` (`RF06`, `RF08`):
  - `SearchVehiclesForDisambiguationUseCase`: Pesquisa veículos por texto e ano; quando há mais de uma motorização/versão compatível, retorna `requiresDisambiguation: true` para obrigar a escolha exata no balcão.
  - `LookupVehicleSpecsUseCase`: Retorna os 6 itens técnicos do veículo selecionado cruzados apenas com os produtos em estoque do `companyId` autenticado.
- `QuoteEngineUseCases.ts` (`RF09`, `RF10`):
  - Implementa o **Strategy Pattern** (`CheapestQuoteStrategy`, `MostExpensiveQuoteStrategy` e `BestQualityQuoteStrategy`) para gerar simultaneamente as 3 faixas de orçamento respeitando a litragem do cárter (`Math.ceil(capacityLiters)`) para óleo de motor.
  - Permite criar ou atualizar orçamentos personalizados (`CreateOrUpdateQuoteUseCase`) e disparar o orçamento formatado em HTML para o e-mail do cliente (`SendQuoteEmailUseCase`).

### 3.3. Camada de Infraestrutura (`apps/api/src/infra`)
- **Persistência Dupla (In-Memory e MySQL 8.0):**
  - Todos os 7 repositórios possuem implementação em memória (`src/infra/database/in-memory/`) populada por `seedDemoData.ts` e implementação relacional em MySQL 8.0 (`src/infra/database/mysql/`) usando `mysql2/promise` com **Prepared Statements parametrizados** e transações ACID (`BEGIN` / `COMMIT` / `ROLLBACK`) no repositório de orçamentos (`MysqlQuoteRepository.ts`).
  - As antigas *Stored Procedures* foram eliminadas para manter 100% da regra de negócio testável em TypeScript.
- **Segurança e Mensageria:**
  - `ScryptPasswordHasher.ts`: Derivação criptográfica de senhas com salt aleatório de 16 bytes e comparação em tempo constante (`timingSafeEqual`).
  - `JwtTokenService.ts`: Assinatura e verificação de tokens JWT (`HS256`) carregando `userId`, `companyId`, `role` e `status`.
  - `NodemailerSmtpService.ts`: Cliente SMTP configurável (`mail.engine.lat`) com fallback automático para `FakeMailService` em desenvolvimento/testes.

### 3.4. Camada de Apresentação e Portal Web Estilo Google Antigravity (`apps/api/src/presentation` e `apps/web/public`)
- **Proteção Anti-IDOR:** Nenhuma rota de escrita de produtos, clientes ou orçamentos confia em `companyId` enviado no corpo JSON; o `companyId` é extraído obrigatoriamente do token JWT validado pelo middleware `requireAuth`.
- **Identidade Visual `https://antigravity.google/` + Logo Oficial (`logo-soil3.png`):**
  - Utiliza a logo oficial `/logo-soil3.png` com filtro adaptativo (`--logo-filter`), exibindo a marca branca original sobre o fundo escuro (`#0a0b0e` / `#121317`) e invertendo automaticamente para preto carbono no modo claro (`#ffffff`).
  - Tipografia oficial `Google Sans Flex` para títulos e botões, `Google Sans Code` para normas técnicas (`SAE 0W-20 ACEA C5`, `GM DEXOS1 GEN 3`), capacidades e preços, e `Google Symbols` para ícones.
  - Anel orbital interativo de partículas em `<canvas>` (`#agy-particles-canvas`) no topo da busca e paleta 100% livre de azul.
  - Gaveta lateral deslizante (`#quote-drawer`) sob demanda para alternar entre as 3 faixas de orçamento, editar quantidades/preços, cadastrar clientes rapidamente e disparar por e-mail.

---

## 4. Tabela de Endpoints da API REST

| Método | Rota | Autenticação | Requisito / Descrição |
|---|---|---|---|
| `GET` | `/health` | Pública | Healthcheck do serviço (`{ status: "ok" }`) |
| `GET` | `/`, `/index`, `/principal`, `/help` | Pública | Rotas do Portal Web SPA (`RF11`) |
| `GET` | `/logo-soil3.png`, `/styles.css`, `/app.js` | Pública | Ativos estáticos do Portal Web |
| `POST` | `/api/companies` | Pública | Cadastra nova empresa validando CNPJ Módulo 11 (`RF01`) |
| `POST` | `/api/auth/signup` | Pública | Cadastra operador vinculado a um CNPJ existente (`RF02`) |
| `POST` | `/api/auth/login` | Pública | Autentica usuário aprovado e emite token JWT (`RF03`) |
| `GET` | `/api/admin/users?status=` | JWT (`ADMIN`) | Lista operadores por status (`PENDING`, `APPROVED`, `REJECTED`, `ALL`) com Nome Fantasia (`RF03`) |
| `POST` | `/api/admin/users/:id/review` | JWT (`ADMIN`) | Aprova (`APPROVED`) ou rejeita/suspende (`REJECTED`) conta (`RF03`) |
| `GET` | `/api/vehicles/disambiguate?q=&year=` | JWT | Busca veículos e sinaliza necessidade de desambiguação (`RF08`) |
| `POST` | `/api/vehicles` | JWT (`ADMIN`) | Cadastra veículo e motorização no catálogo global (`RF04`) |
| `PATCH` | `/api/vehicles/:id` | JWT (`ADMIN`) | Atualiza dados de veículo homologado no catálogo global (`RF04`) |
| `DELETE` | `/api/vehicles/:id` | JWT (`ADMIN`) | Remove veículo do catálogo global (`RF04`) |
| `GET` | `/api/catalogs` | JWT | Lista especificações técnicas dos 6 itens obrigatórios (`RF05`) |
| `POST` | `/api/catalogs` | JWT (`ADMIN`) | Cadastra item técnico dentro dos 6 tipos obrigatórios (`RF05`) |
| `PATCH` | `/api/catalogs/:id` | JWT (`ADMIN`) | Atualiza norma/subtipo de especificação técnica do catálogo (`RF05`) |
| `DELETE` | `/api/catalogs/:id` | JWT (`ADMIN`) | Remove item técnico do catálogo (`RF05`) |
| `POST` | `/api/technical-specifications` | JWT (`ADMIN`) | Vincula ou atualiza veículo a item técnico com litragem e notas (`RF05`) |
| `GET` | `/api/products` | JWT | Lista estoque de produtos do CNPJ logado (`RF06`) |
| `POST` | `/api/products` | JWT | Cadastra produto com preço no estoque do CNPJ logado (`RF06`) |
| `PATCH` | `/api/products/:id` | JWT | Atualiza preço, SKU ou norma de produto existente no CNPJ logado (`RF06`) |
| `POST` | `/api/products/batch` | JWT | Importa ou reajusta produtos em lote (CSV/Batch) no CNPJ logado (`RF06`) |
| `DELETE` | `/api/products/:id` | JWT | Remove produto pertencente ao CNPJ logado (`RF06`) |
| `GET` | `/api/clients` | JWT | Lista a carteira de clientes do CNPJ logado (`RF07`) |
| `POST` | `/api/clients` | JWT | Cadastra cliente na carteira do CNPJ logado (`RF07`) |
| `PATCH` | `/api/clients/:id` | JWT | Atualiza nome, telefone ou e-mail de cliente do CNPJ logado (`RF07`) |
| `DELETE` | `/api/clients/:id` | JWT | Remove cliente da carteira do CNPJ logado (`RF07`) |
| `GET` | `/api/lookup/:vehicleId` | JWT | Retorna os 6 itens técnicos do veículo + produtos do CNPJ (`RF08`) |
| `GET` | `/api/quotes/options/:vehicleId` | JWT | Calcula as 3 faixas automáticas (`cheapest`, `bestQuality`, `mostExpensive`) (`RF09`) |
| `GET` | `/api/quotes` | JWT | Lista histórico de orçamentos emitidos pelo CNPJ logado (`RF09`) |
| `POST` | `/api/quotes` | JWT | Cria ou edita orçamento recalculando o total em centavos (`RF09`) |
| `DELETE` | `/api/quotes/:id` | JWT | Exclui orçamento do histórico do CNPJ logado (`RF09`) |
| `POST` | `/api/quotes/:id/send-email` | JWT | Envia o orçamento por e-mail para o cliente e marca como `SENT` (`RF10`) |

---

## 5. Relatório da Suíte TDD (Vitest)

A suíte automatizada conta com **8 arquivos de especificação e 40 testes** que validam todas as regras de domínio, casos de uso, adaptadores SQL parametrizados, precisão OEM no teste cego multimarcas e contratos HTTP/Web:

1. `tests/unit/domain/value-objects.spec.ts` (16 testes): Dígitos verificadores de CNPJ (Módulo 11), política de senha forte, aritmética exata em centavos (`Money`), e-mail, telefone e intervalo de anos.
2. `tests/unit/application/company-and-user.spec.ts` (7 testes): Unicidade de CNPJ, múltiplos usuários para o mesmo CNPJ e bloqueio de logins/e-mails duplicados.
3. `tests/unit/application/client-and-auth.spec.ts` (4 testes): Login, curadoria de conta pelo Admin e isolamento multi-tenant da carteira de clientes entre CNPJs distintos.
4. `tests/unit/application/automotive-catalog-and-lookup.spec.ts` (4 testes): Proteção de rotas Admin, validação dos 6 itens técnicos obrigatórios, desambiguação de veículos e isolamento de produtos por empresa.
5. `tests/unit/application/quote-engine.spec.ts` (2 testes): Cálculo das 3 estratégias de orçamento (com litragem arredondada para óleo de motor), edição manual de itens e envio por e-mail.
6. `tests/unit/infra/mysql-repositories.spec.ts` (3 testes): Verificação dos Prepared Statements SQL (`?`) e transações (`BEGIN` / `COMMIT` / `ROLLBACK`).
7. `tests/integration/http-api.spec.ts` (1 teste E2E completo): Jornada HTTP ponta a ponta desde o cadastro do CNPJ até o disparo do orçamento por e-mail.
8. `tests/integration/web-routes.spec.ts` (3 testes de contrato Web, Segurança RNF01/RNF02 e Precisão OEM):
   - Verifica as rotas `/`, `/index`, `/oficina`, `/admin`, `/principal`, `/auth`, `/help`, `/logo-soil.svg`, cache LRU com invalidação automática e rate limiting.
   - Valida o carregamento dos **3.856 veículos totais** (5 principais + 3.851 da frota TecDoc + Curadoria Nacional) e confirma que todas as 4 categorias (`CARRO`, `UTILITARIO`, `CAMINHAO` e `MOTO`) estão populadas.
   - Executa o **teste cego automatizado de precisão OEM**: garante que nenhum veículo elétrico/placeholder permaneceu na base, que motores Volkswagen TSI mapeiam para `VW 508 00` / `VW 502 00` com filtro específico (`W 712/95` / `OX 388D`), motores GM CSS Prime 1.0 Turbo mapeiam exclusivamente para `GM DEXOS1 GEN 3` (correia banhada a óleo), motores Ford Ka 1.0 Ti-VCT mapeiam para `WSS-M2C948-B` (`5W-20`), caminhões pesados (Scania R 450, Volvo FH 540) mapeiam para `15W-40 CK-4 / E9` com litragem real de cárter (`35L`–`40L`) e motos (Honda CG 160, Yamaha Fazer 250) mapeiam para `JASO MA2` (`10W-30` / `10W-40`).

---

## 6. Pipeline ETL TecDoc, Curadoria da Frota Popular Brasileira e Precisão OEM

Os scripts `scripts/sanitize-tecdoc.py` e `scripts/curated_fleet_data.py` processam as **231 planilhas `.xlsx`** brutas do TecDoc (`OLEO`, `FILTRO_OLEO`, `FILTRO_AR` e `FILTRO_COMBUSTIVEL`, totalizando **136.116 registros de aplicação**), aplicam regras determinísticas de engenharia automotiva e geram tanto o dataset estruturado `apps/api/src/infra/database/tecdoc-sanitized.json` quanto o seed relacional completo `infra/database/seeds/003_seed_tecdoc_national_fleet.sql` (`8.3 MB`):

- **Eliminação Global de Falsos Positivos (Teste Cego):**
  - **Expurgo de Elétricos Puros (BEV) e Placeholders:** Remove veículos 100% elétricos (Tesla, BYD Dolphin/Seal/Yuan, Porsche Taycan, Audi e-tron, Nissan Leaf, Renault Kwid E-Tech/Zoe, Volvo EX30/XC40 Recharge, etc.) e cadastros incompletos (`Motor Padrão`).
  - **Prioridade Estrita de Norma OEM por Montadora/Motor (`OEM_BRAND_KEYWORDS`):** Impede que um óleo genérico multimarcas da planilha TecDoc sobrescreva a homologação real do fabricante. Motores GM CSS Prime 1.0/1.2 Turbo exigem `GM DEXOS1 GEN 3` (`5W-30`); Ford Ka/EcoSport Dragon/Ti-VCT exigem `Ford WSS-M2C948-B` (`5W-20`); Stellantis GSE T200/T270 exigem `Fiat 9.55535-GS1` / `DS1` (`0W-30 ACEA C2`); Volkswagen TSI/MSI exigem `VW 508 00` (`0W-20`) ou `VW 502 00` (`5W-40`); Diesel com DPF exige `ACEA C2/C3` (`5W-30`) e Diesel pesado exige `API CK-4 / ACEA E9` (`15W-40` ou `10W-40`).
  - **Transmissão Precisa (`choose_trans_spec`):** Distingue câmbio Manual (`75W-80` / `75W-90`), Automático epicíclico (`ATF Dexron VI / Mercon LV`), CVT (`CVT Fluid NS-3 / FE`), Dupla Embreagem DSG/S-Tronic (`DCTF / DSG Fluid`) e caixa pesada/moto (`SAE 80W-90` / `JASO MA2`).
  - **Herança de Filtros por Família de Motor + Part Numbers Reais no Estoque (`seedDemoData.ts`):** Quando uma variante do TecDoc não possui linha direta na planilha de filtros, herda o código real da mesma família de motor (`brand + model_prefix + liters_bucket + fuel`) ou recebe um dos **51 catálogos granulares de filtros** por montadora/aplicação. Além disso, o `seedDemoData.ts` injeta dinamicamente no estoque da oficina os SKUs exatos extraídos das notas do TecDoc (`MANN-FILTER`, `MAHLE`, `WEGA`, `BOSCH`) nas 3 faixas de preço (`CHEAPEST`, `BEST_QUALITY`, `MOST_EXPENSIVE`), garantindo que o orçamento nunca exiba filtro de outra montadora.
- **Cobertura Completa das 4 Categorias (`3.856` veículos totais e `93` normas/catálogos canônicos):**
  - `CARRO`: **3.412 veículos** (incluindo frota nacional de alto giro: VW Gol G5/G6/G7/G8, Polo TSI, Virtus, Nivus, T-Cross, Saveiro; GM Onix, Tracker, Celta, Corsa, Prisma, Spin; Fiat Strada, Argo, Cronos, Mobi, Toro, Pulse, Fastback, Uno, Palio, Siena; Hyundai HB20, Creta; Toyota Corolla, Hilux, Yaris, Etios; Honda Civic, HR-V, Fit, City; Renault Kwid, Sandero, Duster, Logan; Jeep Renegade, Compass, Commander; Nissan Kicks, Versa; Ford Ka, Ranger, EcoSport; BYD Song Plus DM-i, King DM-i; GWM Haval H6; CAOA Chery Tiggo 5x/7/8).
  - `UTILITARIO`: **371 veículos** (Fiat Fiorino, Strada, Toro, Ducato; Renault Master, Kangoo; Peugeot Partner, Boxer; Citroën Jumper, Jumpy; Mercedes-Benz Sprinter 311/313/314/415/416/515/516 CDI; Iveco Daily 30-130, 35S14, 45-170, 55C17; Ford Transit; VW Delivery Express; Hyundai HR; Kia Bongo K2500; Toyota Hilux, Mitsubishi L200 Triton, Chevrolet S10, Ford Ranger, VW Amarok, Nissan Frontier).
  - `CAMINHAO`: **42 veículos** (Volkswagen Delivery 9.170 / 11.180, Worker 17.190, Constellation 17.280 / 24.250 / 24.280, Meteor 28.460 / 29.520; Mercedes-Benz Accelo 815 / 1016, Atego 1719 / 2426 / 2430, Actros 2546 / 2651, Axor 2544; Volvo VM 270 / 330, FH 460 / 540; Scania R 450, R 500, R 540, P 310, P 360, G 420; DAF XF 105 460, XF 480 / 530; Iveco Tector 170E21, 240E28, Hi-Way 440, S-Way 480; Ford Cargo 816, 1119, 2429).
  - `MOTO`: **31 veículos** (Honda CG 125/150/160 Fan/Titan/Start, NXR 160 Bros, Biz 110i/125, PCX 150/160, Elite 125, Pop 110i, CB 250F/300F Twister, XRE 190/300, Sahara 300, CB 500F/500X, NC 750X; Yamaha YBR 125/150 Factor, Fazer 150/250 FZ15/FZ25, Lander 250, Crosser 150, NMax 160, Neo 125, MT-03, MT-07, MT-09; Suzuki Intruder 125, Haojue DK 150/160; Mottu Sport 110i; Bajaj Dominar 160/200/400; BMW G 310 GS, F 850 GS, R 1250 GS; Royal Enfield Meteor 350, Hunter 350, Himalayan 411).

---

## 7. Melhorias Operacionais de UX, Sobra Técnica de Óleo e Padronização Visual

1. **Busca Interna em Dropdowns Longos e Pílulas de Subtipo no Estoque (`/oficina`):**
   - Qualquer seletor customizado (`.custom-select-menu`) com mais de 10 opções (como Montadora com 65 marcas, Modelo e Catálogo Técnico com 93 itens) exibe automaticamente um campo de busca instantânea (`#custom-select-search-input`) fixado no topo do menu aberto, com suporte a teclado (`Escape` e `Enter`).
   - O painel de estoque em `/oficina` possui pílulas rápidas de filtro por subtipo (`#prod-subtype-pills`: `Todos`, `Óleo Motor`, `Freio`, `Câmbio`, `Filtro Óleo`, `Filtro Comb.`, `Filtro Ar`) com contadores em tempo real combinados com a busca textual.
2. **Cálculo Transparente de Volume do Cárter vs. Frascos de 1L (`Sobra Técnica`):**
   - Na gaveta de cotação (`#quote-drawer`), no PDF/impressão (`openPrintableQuoteWindow`) e no resumo para WhatsApp (`buildQuoteSummaryText`), o item de Óleo de Motor exibe a capacidade exata exigida pelo cárter/filtro (ex.: `4.5L`), a quantidade de frascos de 1L orçados (ex.: `5 un. de 1L`) e a sobra técnica para o cliente ou reposição (ex.: `0.5L`).
   - O botão `#btn-toggle-bottle-rounding` permite ao balcão alternar em 1 clique entre **Fechar Frascos 1L** (ex.: `5 un.`) e **Usar Litragem Exata / Granel** (ex.: `4.5L`).
3. **Atalho de Recotação em 1 Clique na Carteira de Clientes (`/oficina`):**
   - Cada cliente exibe a contagem real de orçamentos emitidos e o último veículo orçado, acompanhado do botão `Cotar <Modelo> →` (`quoteClientLastVehicle(clientId, vehicleId)`), que abre `/index` com o veículo e o cliente já carregados na gaveta de orçamento.
4. **Padronização Visual Global de Pílulas, Badges e Botões (`styles.css` e `app.js`):**
   - Todas as pílulas informativas (`.badge-slot`, `.badge-capacity`, `.tag-best`, `.spec-norm-copy-hint`) e botões de ação (`.btn`, `.btn-sm`) utilizam `display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; flex-shrink: 0; min-height: 24px;`, eliminando quebras de linha indesejadas como `4.5 \n Litros` ou `ENTRAR \n →` tanto no desktop (`1280px`) quanto em telas móveis (`390px`).
   - Nos 6 cards técnicos (`.spec-card`), o cabeçalho `.spec-card-header` posiciona `.badge-slot` à esquerda e `.badge-capacity` à direita na mesma linha horizontal, enquanto o título `<h3 class="spec-card-title">` ocupa 100% da largura logo abaixo e o aviso de visitante utiliza `.btn.btn-outline.btn-sm` (`Entrar →`).

---

## 8. Como Executar o Projeto

No terminal PowerShell, dentro de `C:\Users\thiag\Desktop\Engine\0.Desenvolvimento`:

```powershell
# 1. Verificar tipagem estrita em todos os pacotes do monorepo
npm run typecheck

# 2. Executar toda a suíte TDD (40 testes unitários e de integração)
npm test

# 3. Reprocessar as planilhas TecDoc + frota curada e regenerar o JSON + SQL de produção (opcional)
python scripts/sanitize-tecdoc.py

# 4. Iniciar o servidor (API REST + Portal Web com base nacional pré-carregada)
npm run dev:demo

# 5. Subir o ambiente containerizado completo (MySQL 8.0 + API SOIL + Mailpit SMTP)
docker compose up --build -d
```

Com o servidor ativo, acesse no navegador:
- `http://localhost:3000/index` (Omnibox com seletor de ano, filtros em cascata para 65 montadoras e 4 categorias, 6 itens obrigatórios padronizados e gaveta de cotação com cálculo de sobra técnica, impressão/PDF, WhatsApp e e-mail)
- `http://localhost:3000/auth` e `http://localhost:3000/principal` (Portal B2B de Acesso e Credenciamento de Oficinas por CNPJ)
- `http://localhost:3000/oficina` (Faixa de KPIs operacionais, Gestão de Estoque com pílulas por subtipo, edição direta `PATCH /api/products/:id` e lote CSV, Carteira de Clientes com atalho `Cotar <Modelo> →` e Histórico de Orçamentos)
- `http://localhost:3000/admin` (Faixa de KPIs da plataforma, Curadoria de Contas, Frota Nacional Homologada com 3.856 veículos e Catálogo Técnico com 93 especificações)
- `http://localhost:3000/help` (Guia Operacional de Atendimento e Regras das 3 Faixas de Cotação)
- `http://localhost:8025` (Painel Web do Mailpit para visualizar os e-mails de orçamento disparados quando executado via Docker Compose)

---

## 9. Próximos Passos Salvos (Roadmap de Evolução)

Os próximos passos estratégicos e técnicos mapeados para a continuação do projeto são:

1. **Publicação em Produção na VPS (`engine.lat`) com HTTPS e MySQL 8.0 Real:**
   - Provisionar os containers via `docker compose up --build -d` na VPS, aplicar a migração `001_initial_schema.sql` e importar o seed relacional completo `003_seed_tecdoc_national_fleet.sql` (93 itens de catálogo, 3.851 veículos da frota nacional, 23.106 especificações técnicas e 279 produtos base).
   - Configurar proxy reverso (Nginx/Caddy) com certificado TLS/HTTPS automático e conectar as credenciais reais do servidor SMTP (`mail.engine.lat`).
2. **Consulta Rápida por Placa (Mercosul / Antiga) na Omnibox (`/index`):**
   - Adicionar detecção automática de padrão de placa brasileira (`ABC1D23` ou `ABC-1234`) na barra de busca principal para resolver marca, modelo, ano e motorização diretamente para o veículo correspondente no catálogo SOIL.
3. **Baixa Automática de Estoque e Controle de Quantidade Disponível (`/oficina`):**
   - Incluir saldo em estoque (`stockQuantity`) e alerta de estoque mínimo nos produtos da oficina, realizando a reserva/baixa automática quando um orçamento mudar para o status `FINALIZED` ou `SENT`.
4. **Histórico de Revisões por Placa / Hodômetro (Quilometragem) e Lembrete de Próxima Troca:**
   - Registrar a placa e a quilometragem atual do veículo no momento da emissão do orçamento (`Quote`), calculando a data/quilometragem prevista da próxima revisão (ex.: `+10.000 km` ou `+6 meses`) para disparo ativo de lembrete via WhatsApp/e-mail na Carteira de Clientes.
5. **Relatórios Financeiros e Curva ABC de Peças no Painel da Oficina (`/oficina`):**
   - Adicionar visão gerencial de ticket médio, taxa de conversão de orçamentos (`DRAFT` vs `SENT`), margem e ranking dos lubrificantes e filtros mais vendidos por período.
