import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccountStatus, CatalogCategory, CatalogSubtype, QuoteProfile, QuoteStatus, UserRole } from '@soil/shared';
import { CatalogItem } from '../../domain/entities/CatalogItem.js';
import { Quote, QuoteItem } from '../../domain/entities/Quote.js';
import { Money } from '../../domain/value-objects/Money.js';
import { AppDependencies } from '../../presentation/app.js';

interface SanitizedTecdocCatalog {
  key: string;
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
  ecoBrand?: string;
  ecoName?: string;
  ecoSku?: string;
  bestBrand?: string;
  bestName?: string;
  bestSku?: string;
  premBrand?: string;
  premName?: string;
  premSku?: string;
}

interface SanitizedTecdocVehicle {
  manufacturer: string;
  model: string;
  version: string;
  type: string;
  manufYearStart: number;
  manufYearEnd: number;
  sumpLiters: number;
  transLiters: number;
  oilKey: string;
  oilNotes: string;
  brakeKey: string;
  transKey: string;
  foKey: string;
  foNotes: string;
  fcKey: string;
  fcNotes: string;
  faKey: string;
  faNotes: string;
}

interface SanitizedTecdocPayload {
  catalogs: SanitizedTecdocCatalog[];
  vehicles: SanitizedTecdocVehicle[];
}

let cachedTecdocPayload: SanitizedTecdocPayload | null = null;

async function loadSanitizedTecdocPayload(): Promise<SanitizedTecdocPayload | null> {
  if (cachedTecdocPayload) {
    return cachedTecdocPayload;
  }
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const jsonPath = resolve(currentDir, 'tecdoc-sanitized.json');
    const raw = await readFile(jsonPath, 'utf-8');
    cachedTecdocPayload = JSON.parse(raw) as SanitizedTecdocPayload;
    return cachedTecdocPayload;
  } catch {
    return null;
  }
}

export async function seedDemoData(deps: AppDependencies): Promise<void> {
  const existingAdminCompany = await deps.companyRepo.findByCnpj('11222333000181');
  if (existingAdminCompany !== null) {
    return;
  }

  // 1. Empresas: Soil Admin (ID 1) e Auto Center Paulista (ID 2)
  const adminCompany = await deps.companyRepo.create({
    cnpj: '11222333000181',
    tradeName: 'Soil Plataforma Automotiva',
  });

  const workshopCompany = await deps.companyRepo.create({
    cnpj: '11444777000161',
    tradeName: 'Auto Center Paulista Lubrificantes',
  });

  const adminPasswordHash = await deps.passwordHasher.hash('Soil@2026!');
  await deps.userRepo.create({
    companyId: adminCompany.id,
    cnpj: adminCompany.cnpj.value,
    name: 'Thiago Azenha (Admin)',
    login: 'thiago.admin',
    email: 'thiago@engine.lat',
    phone: '11999990000',
    passwordHash: adminPasswordHash,
    role: UserRole.ADMIN,
    status: AccountStatus.APPROVED,
  });

  const opPasswordHash = await deps.passwordHasher.hash('Oficina@2026!');
  const operator = await deps.userRepo.create({
    companyId: workshopCompany.id,
    cnpj: workshopCompany.cnpj.value,
    name: 'Marcos Consultor Técnico',
    login: 'marcos.paulista',
    email: 'marcos@autocenterpaulista.com.br',
    phone: '11988887777',
    passwordHash: opPasswordHash,
    role: UserRole.USER,
    status: AccountStatus.APPROVED,
  });

  // 2. Clientes da Oficina (ID 2)
  const robertoClient = await deps.clientRepo.create({
    companyId: workshopCompany.id,
    name: 'Roberto Almeida',
    phone: '11977776666',
    email: 'roberto.almeida@cliente.com.br',
  });
  const fernandaClient = await deps.clientRepo.create({
    companyId: workshopCompany.id,
    name: 'Fernanda Ribeiro (Frota Executiva)',
    phone: '11966665555',
    email: 'fernanda@frotaexecutiva.com.br',
  });

  // 3. Frota de Veículos (Com casos reais de desambiguação)
  const compassFlex = await deps.vehicleRepo.create({
    manufacturer: 'Jeep',
    model: 'Compass',
    version: '1.3 Turbo Flex T270',
    type: 'UTILITARIO',
    manufYearStart: 2022,
    manufYearEnd: 2026,
  });

  const compassDiesel = await deps.vehicleRepo.create({
    manufacturer: 'Jeep',
    model: 'Compass',
    version: '2.0 Turbodiesel TD350 4x4',
    type: 'UTILITARIO',
    manufYearStart: 2022,
    manufYearEnd: 2025,
  });

  const onixTurbo = await deps.vehicleRepo.create({
    manufacturer: 'Chevrolet',
    model: 'Onix',
    version: '1.0 12V Ecotec Turbo (Correia Banhada a Óleo)',
    type: 'CARRO',
    manufYearStart: 2020,
    manufYearEnd: 2026,
  });

  const onixJoy = await deps.vehicleRepo.create({
    manufacturer: 'Chevrolet',
    model: 'Onix',
    version: '1.0 8V Joy SPE/4 (Correia Seca)',
    type: 'CARRO',
    manufYearStart: 2017,
    manufYearEnd: 2021,
  });

  const corolla = await deps.vehicleRepo.create({
    manufacturer: 'Toyota',
    model: 'Corolla',
    version: '2.0 16V Dynamic Force Direct Shift',
    type: 'CARRO',
    manufYearStart: 2020,
    manufYearEnd: 2026,
  });

  // 4. Catálogo Técnico dos 6 Itens Obrigatórios
  const catOleo0w30C2 = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.MOTOR,
    name: 'Óleo Sintético 0W-30 ACEA C2',
    specification: 'SAE 0W-30 ACEA C2 / Norma Fiat 9.55535-GS1',
  });
  const catOleo5w30Diesel = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.MOTOR,
    name: 'Óleo Sintético 5W-30 Low SAPS DPF',
    specification: 'SAE 5W-30 ACEA C2 / Norma Fiat 9.55535-DS1',
  });
  const catOleo5w30Dexos = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.MOTOR,
    name: 'Óleo Sintético 5W-30 Dexos1 Gen 3',
    specification: 'SAE 5W-30 API SP / GM Dexos1 Gen 3 (Obrigatório Correia Banhada)',
  });
  const catOleo0w20 = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.MOTOR,
    name: 'Óleo Sintético 0W-20 API SP',
    specification: 'SAE 0W-20 API SP / ILSAC GF-6A',
  });

  const catFreioDot4 = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.FREIO,
    name: 'Fluido de Freio Sintético DOT 4',
    specification: 'FMVSS 116 DOT 4 / ISO 4925 Class 4',
  });

  const catCambioAtf6 = await deps.catalogRepo.create({
    category: CatalogCategory.OLEO,
    subtype: CatalogSubtype.CAMBIO,
    name: 'Fluido Transmissão Automática ATF AW-1',
    specification: 'ATF AW-1 / Dexron VI Baixa Viscosidade',
  });

  const catFiltroOleoT270 = await deps.catalogRepo.create({
    category: CatalogCategory.FILTRO,
    subtype: CatalogSubtype.OLEO,
    name: 'Filtro de Óleo Refil Ecológico',
    specification: 'Mann HU 7029 z / Wega WOE-451',
  });

  const catFiltroOleoBlindado = await deps.catalogRepo.create({
    category: CatalogCategory.FILTRO,
    subtype: CatalogSubtype.OLEO,
    name: 'Filtro de Óleo Blindado Rosca M20',
    specification: 'Mann W 712/95 / Tecfil PSL55',
  });

  const catFiltroCombFlex = await deps.catalogRepo.create({
    category: CatalogCategory.FILTRO,
    subtype: CatalogSubtype.COMBUSTIVEL,
    name: 'Filtro de Combustível Injeção Flex',
    specification: 'Mahle KL 582 / Tecfil GI04/7',
  });

  const catFiltroArMotor = await deps.catalogRepo.create({
    category: CatalogCategory.FILTRO,
    subtype: CatalogSubtype.AR,
    name: 'Filtro de Ar Primário do Motor',
    specification: 'Mann C 21 002 / Tecfil ARL4157',
  });

  // 5. Carrega os catálogos canônicos homologados (TecDoc + Frota Nacional)
  const allCatalogs: CatalogItem[] = [
    catOleo0w30C2,
    catOleo5w30Diesel,
    catOleo5w30Dexos,
    catOleo0w20,
    catFreioDot4,
    catCambioAtf6,
    catFiltroOleoT270,
    catFiltroOleoBlindado,
    catFiltroCombFlex,
    catFiltroArMotor,
  ];

  const catalogByKey = new Map<string, CatalogItem>([
    ['oil_0w30_c2_fiat', catOleo0w30C2],
    ['oil_5w30_diesel_dpf', catOleo5w30Diesel],
    ['oil_5w30_dexos_belt', catOleo5w30Dexos],
    ['oil_0w20_sp', catOleo0w20],
    ['brake_dot4', catFreioDot4],
    ['trans_atf_aw1', catCambioAtf6],
    ['fo_stellantis_gse_turbo', catFiltroOleoT270],
    ['fo_vw_ea111_ea211', catFiltroOleoBlindado],
    ['fc_inline_flex', catFiltroCombFlex],
    ['fa_stellantis_gse_turbo', catFiltroArMotor],
  ]);

  const catalogMetaById = new Map<number, SanitizedTecdocCatalog>();

  const tecdoc = await loadSanitizedTecdocPayload();
  if (tecdoc) {
    for (const c of tecdoc.catalogs) {
      const existing = catalogByKey.get(c.key);
      if (existing) {
        catalogMetaById.set(existing.id, c);
      } else {
        const created = await deps.catalogRepo.create({
          category: c.category,
          subtype: c.subtype,
          name: c.name,
          specification: c.specification,
        });
        catalogByKey.set(c.key, created);
        catalogMetaById.set(created.id, c);
        allCatalogs.push(created);
      }
    }
  }

  // 6. Vincula os 6 itens obrigatórios aos 5 veículos iniciais com aplicação OEM exata por família de motor
  const bindVehicleSpecs = async (params: {
    vehicleId: number;
    oilCat: CatalogItem;
    sumpLiters: number;
    oilNotes: string;
    brakeCat: CatalogItem;
    transCat: CatalogItem;
    transLiters: number;
    foCat: CatalogItem;
    foNotes: string;
    fcCat: CatalogItem;
    fcNotes: string;
    faCat: CatalogItem;
    faNotes: string;
  }): Promise<void> => {
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.oilCat.id,
      capacityLiters: params.sumpLiters,
      intervalKm: 10000,
      notes: params.oilNotes,
    });
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.brakeCat.id,
      capacityLiters: 1,
      intervalKm: 20000,
      notes: 'Sangria completa do circuito hidráulico ABS/ESP',
    });
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.transCat.id,
      capacityLiters: params.transLiters,
      intervalKm: 60000,
      notes: 'Conferir nível térmico e especificação da transmissão',
    });
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.foCat.id,
      capacityLiters: 1,
      intervalKm: 10000,
      notes: params.foNotes,
    });
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.fcCat.id,
      capacityLiters: 1,
      intervalKm: 10000,
      notes: params.fcNotes,
    });
    await deps.catalogRepo.assignToVehicle({
      vehicleId: params.vehicleId,
      catalogId: params.faCat.id,
      capacityLiters: 1,
      intervalKm: 10000,
      notes: params.faNotes,
    });
  };

  await bindVehicleSpecs({
    vehicleId: compassFlex.id,
    oilCat: catOleo0w30C2,
    sumpLiters: 4.5,
    oilNotes: 'Motor GSE T270 Turbo: exige norma Fiat 9.55535-GS1 ACEA C2',
    brakeCat: catalogByKey.get('brake_dot4_lv') ?? catFreioDot4,
    transCat: catCambioAtf6,
    transLiters: 6.0,
    foCat: catFiltroOleoT270,
    foNotes: 'Ref. TecDoc Homologada: MANN-FILTER: HU 7029 z • WEGA: WOE-451 • MAHLE: OX 1143D',
    fcCat: catalogByKey.get('fc_fiat_flex') ?? catFiltroCombFlex,
    fcNotes: 'Ref. TecDoc Homologada: MANN-FILTER: WK 58 • WEGA: FCI-1660 • MAHLE: KL 582',
    faCat: catFiltroArMotor,
    faNotes: 'Ref. TecDoc Homologada: MANN-FILTER: C 21 002 • WEGA: JFA-0998 • MAHLE: LX 4436',
  });

  await bindVehicleSpecs({
    vehicleId: compassDiesel.id,
    oilCat: catOleo5w30Diesel,
    sumpLiters: 4.3,
    oilNotes: 'Motor Multijet II TD350 c/ DPF: obrigatório óleo Low SAPS Fiat 9.55535-DS1',
    brakeCat: catalogByKey.get('brake_dot4_lv') ?? catFreioDot4,
    transCat: catalogByKey.get('trans_atf_zf8') ?? catCambioAtf6,
    transLiters: 6.5,
    foCat: catalogByKey.get('fo_stellantis_multijet_diesel') ?? catFiltroOleoT270,
    foNotes: 'Ref. TecDoc Homologada: MANN-FILTER: HU 7013 x • WEGA: WOE-626 • MAHLE: OX 553D',
    fcCat: catalogByKey.get('fc_stellantis_multijet_diesel') ?? catFiltroCombFlex,
    fcNotes: 'Ref. TecDoc Homologada: MOPAR: 7090784 • MANN-FILTER: PU 7015 z • WEGA: FCD-2093',
    faCat: catFiltroArMotor,
    faNotes: 'Ref. TecDoc Homologada: MANN-FILTER: C 21 002 • WEGA: JFA-0998 • MAHLE: LX 4436',
  });

  await bindVehicleSpecs({
    vehicleId: onixTurbo.id,
    oilCat: catOleo5w30Dexos,
    sumpLiters: 4.0,
    oilNotes: 'ATENÇÃO: Correia dentada banhada a óleo. Usar apenas GM Dexos1 Gen 3 SAE 5W-30',
    brakeCat: catalogByKey.get('brake_dot4_lv') ?? catFreioDot4,
    transCat: catCambioAtf6,
    transLiters: 6.0,
    foCat: catalogByKey.get('fo_gm_css_prime') ?? catFiltroOleoBlindado,
    foNotes: 'Ref. TecDoc Homologada: MANN-FILTER: W 7561 • WEGA: WO-139 • MAHLE: OC 1465',
    fcCat: catalogByKey.get('fc_gm_flex') ?? catFiltroCombFlex,
    fcNotes: 'Ref. TecDoc Homologada: MANN-FILTER: WK 58 • WEGA: FCI-1660 • MAHLE: KL 582',
    faCat: catalogByKey.get('fa_gm_css_prime') ?? catFiltroArMotor,
    faNotes: 'Ref. TecDoc Homologada: MANN-FILTER: C 23 023 • WEGA: FAP-3233 • MAHLE: LX 4908',
  });

  await bindVehicleSpecs({
    vehicleId: onixJoy.id,
    oilCat: catalogByKey.get('oil_0w20_dexos') ?? catOleo0w20,
    sumpLiters: 3.5,
    oilNotes: 'Motor SPE/4 8V com correia dentada a seco • GM Dexos1 Gen 3',
    brakeCat: catFreioDot4,
    transCat: catalogByKey.get('trans_mt_75w80') ?? catCambioAtf6,
    transLiters: 2.0,
    foCat: catalogByKey.get('fo_gm_familia_spe4') ?? catFiltroOleoBlindado,
    foNotes: 'Ref. TecDoc Homologada: MANN-FILTER: W 712/22 • WEGA: WO-130 • MAHLE: OC 90',
    fcCat: catalogByKey.get('fc_gm_flex') ?? catFiltroCombFlex,
    fcNotes: 'Ref. TecDoc Homologada: MANN-FILTER: WK 58 • WEGA: FCI-1660 • MAHLE: KL 582',
    faCat: catalogByKey.get('fa_gm_familia_spe4') ?? catFiltroArMotor,
    faNotes: 'Ref. TecDoc Homologada: MANN-FILTER: C 22 016 • WEGA: FAP-3286 • MAHLE: LX 3451',
  });

  await bindVehicleSpecs({
    vehicleId: corolla.id,
    oilCat: catOleo0w20,
    sumpLiters: 4.3,
    oilNotes: 'Motor 2.0 Dynamic Force M20A-FKS • SAE 0W-20 API SP / ILSAC GF-6A',
    brakeCat: catalogByKey.get('brake_dot4_lv') ?? catFreioDot4,
    transCat: catalogByKey.get('trans_cvt') ?? catCambioAtf6,
    transLiters: 5.5,
    foCat: catalogByKey.get('fo_toyota_passeio') ?? catFiltroOleoBlindado,
    foNotes: 'Ref. TecDoc Homologada: MANN-FILTER: W 68/80 • WEGA: JFO-0211 • MAHLE: OC 534',
    fcCat: catalogByKey.get('fc_asiaticos_flex') ?? catFiltroCombFlex,
    fcNotes: 'Ref. TecDoc Homologada: MANN-FILTER: WK 58/1 • WEGA: FCI-1610 • MAHLE: KL 585',
    faCat: catalogByKey.get('fa_toyota_passeio') ?? catFiltroArMotor,
    faNotes: 'Ref. TecDoc Homologada: MANN-FILTER: C 24 005 • WEGA: JFA-0285 • MAHLE: LX 2792',
  });

  if (tecdoc) {
    for (const v of tecdoc.vehicles) {
      const veh = await deps.vehicleRepo.create({
        manufacturer: v.manufacturer,
        model: v.model,
        version: v.version,
        type: v.type,
        manufYearStart: v.manufYearStart,
        manufYearEnd: v.manufYearEnd,
      });

      const motorCat = catalogByKey.get(v.oilKey) ?? catOleo5w30Dexos;
      const brakeCat = catalogByKey.get(v.brakeKey) ?? catFreioDot4;
      const transCat = catalogByKey.get(v.transKey) ?? catCambioAtf6;
      const foCat = catalogByKey.get(v.foKey) ?? catFiltroOleoBlindado;
      const fcCat = catalogByKey.get(v.fcKey) ?? catFiltroCombFlex;
      const faCat = catalogByKey.get(v.faKey) ?? catFiltroArMotor;

      await bindVehicleSpecs({
        vehicleId: veh.id,
        oilCat: motorCat,
        sumpLiters: v.sumpLiters,
        oilNotes: v.oilNotes,
        brakeCat,
        transCat,
        transLiters: v.transLiters,
        foCat,
        foNotes: v.foNotes,
        fcCat,
        fcNotes: v.fcNotes,
        faCat,
        faNotes: v.faNotes,
      });
    }
  }

  // 7. Cadastra produtos nas 3 faixas (Mais Barato, Melhor Qualidade, Mais Caro) usando marcas e SKUs reais homologados
  for (const cat of allCatalogs) {
    const isOil = cat.category === CatalogCategory.OLEO;
    const meta = catalogMetaById.get(cat.id);

    // Opção 1: Mais Barato (Econômico Homologado)
    await deps.productRepo.create({
      companyId: workshopCompany.id,
      userId: operator.id,
      catalogId: cat.id,
      name: meta?.ecoName ?? (isOil ? `${cat.name} - Linha Econômica (1L)` : `${cat.name} - Linha Standard`),
      manufacturer: meta?.ecoBrand ?? (isOil ? 'Lubrax / Vibra' : 'Wega / Tecfil'),
      sku: meta?.ecoSku ? `${meta.ecoSku}-${cat.id}` : `ECO-${cat.id}01`,
      priceCents: isOil ? 4490 : 3290,
      isBestQuality: false,
    });

    // Opção 2: Melhor Qualidade (Recomendado OEM / Destaque)
    await deps.productRepo.create({
      companyId: workshopCompany.id,
      userId: operator.id,
      catalogId: cat.id,
      name: meta?.bestName ?? (isOil ? `${cat.name} - Sintético OEM (1L)` : `${cat.name} - Linha Original OEM`),
      manufacturer: meta?.bestBrand ?? (isOil ? 'Mobil / Selenia / TotalEnergies' : 'Mann-Filter'),
      sku: meta?.bestSku ? `${meta.bestSku}-${cat.id}` : `BEST-${cat.id}02`,
      priceCents: isOil ? 6490 : 5490,
      isBestQuality: true,
    });

    // Opção 3: Mais Caro (Alta Performance Importado)
    await deps.productRepo.create({
      companyId: workshopCompany.id,
      userId: operator.id,
      catalogId: cat.id,
      name: meta?.premName ?? (isOil ? `${cat.name} - 100% Sintético Ester (1L)` : `${cat.name} - Premium Long Life`),
      manufacturer: meta?.premBrand ?? (isOil ? 'Motul / Liqui Moly' : 'Mahle / Bosch'),
      sku: meta?.premSku ? `${meta.premSku}-${cat.id}` : `PREM-${cat.id}03`,
      priceCents: isOil ? 8990 : 7890,
      isBestQuality: false,
    });
  }

  // 8. Cotações iniciais no histórico da oficina para alimentar Carteira de Clientes e Recentes
  await deps.quoteRepo.save(
    new Quote({
      id: 0,
      companyId: workshopCompany.id,
      userId: operator.id,
      vehicleId: compassFlex.id,
      clientId: robertoClient.id,
      profile: QuoteProfile.BEST_QUALITY,
      status: QuoteStatus.SENT,
      sentAt: new Date(Date.now() - 86_400_000),
      items: [
        new QuoteItem({
          productId: 2,
          productName: 'Selenia Forward 0W-30 ACEA C2 Sintético (1L)',
          manufacturer: 'Petronas Selenia (Mopar OEM)',
          quantity: 5,
          unitPrice: Money.fromPositiveCents(6490),
        }),
        new QuoteItem({
          productId: 20,
          productName: 'Filtro de Óleo Refil Ecológico HU 7029 z',
          manufacturer: 'Mann-Filter',
          quantity: 1,
          unitPrice: Money.fromPositiveCents(5490),
        }),
      ],
    }),
  );

  await deps.quoteRepo.save(
    new Quote({
      id: 0,
      companyId: workshopCompany.id,
      userId: operator.id,
      vehicleId: corolla.id,
      clientId: fernandaClient.id,
      profile: QuoteProfile.BEST_QUALITY,
      status: QuoteStatus.DRAFT,
      items: [
        new QuoteItem({
          productId: 11,
          productName: 'Mobil 1 Advanced Fuel Economy 0W-20 API SP (1L)',
          manufacturer: 'Mobil',
          quantity: 5,
          unitPrice: Money.fromPositiveCents(6490),
        }),
        new QuoteItem({
          productId: 23,
          productName: 'Filtro de Óleo Blindado W 68/80',
          manufacturer: 'Mann-Filter',
          quantity: 1,
          unitPrice: Money.fromPositiveCents(5490),
        }),
      ],
    }),
  );
}
