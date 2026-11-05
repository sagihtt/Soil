USE soil;

-- 1. Empresas Base (Angaran Admin + Oficina Modelo)
INSERT INTO company (id, cnpj, trade_name, status) VALUES
  (1, '11222333000181', 'Angaran Tecnologia Automotiva', 'APPROVED'),
  (2, '11444777000161', 'Auto Center Paulista Lubrificantes', 'APPROVED')
ON DUPLICATE KEY UPDATE trade_name = VALUES(trade_name);

-- 2. Veículos da Frota Nacional (incluindo versões que exigem desambiguação)
INSERT INTO vehicle (id, manufacturer, model, version, type, manuf_year_start, manuf_year_end) VALUES
  (1, 'Jeep', 'Compass', '1.3 Turbo Flex T270', 'UTILITARIO', 2022, 2026),
  (2, 'Jeep', 'Compass', '2.0 Turbodiesel TD350 4x4', 'UTILITARIO', 2022, 2025),
  (3, 'Chevrolet', 'Onix', '1.0 12V Turbo (Correia Banhada a Óleo)', 'CARRO', 2020, 2026),
  (4, 'Chevrolet', 'Onix', '1.0 8V Joy SPE/4 (Correia Seca)', 'CARRO', 2017, 2021),
  (5, 'Toyota', 'Corolla', '2.0 16V Dynamic Force Flex', 'CARRO', 2020, 2026),
  (6, 'Volkswagen', 'Gol', '1.6 8V MSI TotalFlex', 'CARRO', 2016, 2022)
ON DUPLICATE KEY UPDATE version = VALUES(version);

-- 3. Catálogo Técnico (Cobrindo os 6 itens obrigatórios: 3 Óleos + 3 Filtros)
INSERT INTO catalog (id, category, type, name, specification) VALUES
  -- Lubrificantes (MOTOR, FREIO, CAMBIO)
  (1,  'OLEO',   'MOTOR',       'Óleo Sintético 0W-30 ACEA C2',          'SAE 0W-30 ACEA C2 / Fiat 9.55535-GS1'),
  (2,  'OLEO',   'MOTOR',       'Óleo Sintético 5W-30 DPF Diesel',       'SAE 5W-30 ACEA C2 / Fiat 9.55535-DS1'),
  (3,  'OLEO',   'MOTOR',       'Óleo Sintético 5W-30 Dexos1 Gen 3',     'SAE 5W-30 API SP / GM Dexos1 Gen 3'),
  (4,  'OLEO',   'MOTOR',       'Óleo Sintético 0W-20 ILSAC GF-6A',      'SAE 0W-20 API SP / ILSAC GF-6A'),
  (5,  'OLEO',   'MOTOR',       'Óleo Sintético 5W-40 VW 508.88',        'SAE 5W-40 API SN / VW 508.88'),
  (6,  'OLEO',   'FREIO',       'Fluido de Freio DOT 4',                 'FMVSS 116 DOT 4 / SAE J1704'),
  (7,  'OLEO',   'CAMBIO',      'Fluido Transmissão Automática ATF AW-1','ATF AW-1 / Aisin Warner 6F24'),
  (8,  'OLEO',   'CAMBIO',      'Fluido Transmissão CVT FE',             'Toyota Genuine CVT Fluid FE'),
  -- Filtros (OLEO, COMBUSTIVEL, AR)
  (9,  'FILTRO', 'OLEO',        'Filtro de Óleo Refil T270',             'Wega WOE-451 / Mann HU 7029 z'),
  (10, 'FILTRO', 'OLEO',        'Filtro de Óleo Blindado GM/Toyota',     'Mann W 712/95 / Tecfil PSL55'),
  (11, 'FILTRO', 'COMBUSTIVEL', 'Filtro de Combustível Linha Flex',      'Mahle KL 582 / Tecfil GI04/7'),
  (12, 'FILTRO', 'COMBUSTIVEL', 'Filtro de Combustível Diesel TD350',    'Mopar 7090784 / Wega FCD-2093'),
  (13, 'FILTRO', 'AR',          'Filtro de Ar do Motor T270/TD350',      'Mann C 21 002 / Tecfil ARL4157'),
  (14, 'FILTRO', 'AR',          'Filtro de Ar do Motor Onix Turbo',      'Mann C 22 035 / Tecfil ARL8839')
ON DUPLICATE KEY UPDATE specification = VALUES(specification);

-- 4. Especificações Técnicas (Os 6 itens obrigatórios para o Jeep Compass 1.3 Turbo T270 - ID 1)
INSERT INTO technical_specification (id, vehicle_id, catalog_id, capacity_liters, interval_km, notes) VALUES
  (1, 1, 1,  4.50, 10000, 'Troca com filtro de óleo'),
  (2, 1, 6,  0.60, 20000, 'Substituir a cada 2 anos ou 20.000 km'),
  (3, 1, 7,  6.50, 60000, 'Câmbio automático Aisin 6 marchas'),
  (4, 1, 9,  1.00, 10000, 'Cartucho refil ecológico'),
  (5, 1, 11, 1.00, 10000, 'Filtro externo sob o assoalho'),
  (6, 1, 13, 1.00, 10000, 'Inspecionar a cada revisão')
ON DUPLICATE KEY UPDATE capacity_liters = VALUES(capacity_liters);

-- 5. Produtos da Oficina Modelo (company_id = 2) nas 3 faixas (Mais Barato, Melhor Qualidade, Mais Caro)
-- Nota: requer usuário id=1 previamente criado ou ajuste conforme o ambiente
