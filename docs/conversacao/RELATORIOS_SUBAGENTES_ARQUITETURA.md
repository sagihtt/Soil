# Relatórios Técnicos dos Subagentes Especialistas — Projeto SOIL

Este documento preserva na íntegra as análises produzidas pelos três subagentes durante o levantamento arquitetural do Soil.

---

## Consultor de Produto e Engenharia de Requisitos (`698420a7-4ce2-4f25-ac97-465339dabf7b`)

The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.

<SYSTEM_MESSAGE>
[Message] timestamp=2026-10-24T23:44:59Z sender=698420a7-4ce2-4f25-ac97-465339dabf7b priority=MESSAGE_PRIORITY_HIGH content=# Análise de Produto, Engenharia de Requisitos e Domínio Automotivo: Projeto Soil

Esta análise foi construída a partir da leitura cruzada dos artefatos reais do repositório (`docs/projeto/eap.txt`, `docs/api/routes.md`, `docs/api/openapi.yaml`, `docs/api/jsonxapi.md`, `prod/soil.sql`, `prod/soil0.sql` e o diagrama `prod/soil.png`).

---

## 1. Visão de Produto e Modelo de Negócio (Consultoria)

### 1.1. O que o Soil modela hoje
Olhando a evolução entre a `eap.txt` e a especificação da API (`routes.md` / `openapi.yaml`), o projeto nasceu como um sistema de consulta técnica simples (`Marca -> Modelo -> Ano` em Angular + Node.js + MySQL) e ganhou corpo como uma **plataforma B2B híbrida de Catálogo Técnico + Precificação de Produtos por CNPJ**.

A estrutura atual opera sobre quatro pilares:
1. **Base de Veículos (`vehicle`) e Catálogo Abstrato (`catalog`):** O administrador cadastra veículos com marca, modelo, tipo e faixa de ano de fabricação (`manuf_year_start` até `manuf_year_end`), além de itens genéricos de catálogo classificados apenas como `OLEO` ou `FILTRO`.
2. **Amarração de Compatibilidade (`technical_specification`):** Uma tabela associativa simples (`vehicle_id` + `catalog_id`) que diz quais especificações de óleo/filtro servem em determinado veículo.
3. **Rede de Empresas Credenciadas (`user` + `user_password`):** O acesso é restrito a pessoas jurídicas (`cnpj` obrigatório no `/auth/signup`), passando por validação de e-mail (`/auth/verify-email/{token}`) e por uma fila de curadoria administrativa (`/admin/users/pending`, `/approve`, `/reject`).
4. **Oferta Comercial (`product`) e Busca Unificada (`/lookup`):** Cada empresa aprovada (`user_id`) cadastra os produtos que trabalha (`brand`, `price`, `type`) vinculados a um item do catálogo técnico (`catalog_id`). Na ponta final, o mecânico usa a rota `GET /lookup` no celular ou computador da oficina para informar o carro (`manufacturer`, `model`, `year`, `type`) e receber de uma só vez a especificação técnica e os produtos disponíveis com preço (podendo filtrar por um `user_id` específico, como a própria oficina ou seu distribuidor de autopeças parceiro).

### 1.2. O que falta frente ao padrão do mercado automotivo (TecDoc, Fraga, LubriBusca, Mobil, Mann-Filter)
Na versão 1 do `eap.txt` (linha 4), estava prevista a modelagem de *"Marcas, Modelos, Motores, Óleos e Filtros"*. Porém, na passagem para o `soil.sql`, a entidade **Motor** desapareceu e as especificações técnicas foram comprimidas em um único campo de texto livre (`catalog.specification VARCHAR(255)`). No aftermarket automotivo real, um veículo não define o óleo ou o filtro sozinho: quem define a aplicação é o **conjunto powertrain (motor + alimentação + emissões + transmissão)**.

Para atingir o nível de confiabilidade de um catálogo tipo TecDoc, Catálogo Fraga, Guia Mobil ou Mann-Filter, o modelo de domínio precisa incorporar cinco dimensões técnicas:

#### A. Motorização e Powertrain
Na tabela `vehicle` (ou numa tabela dedicada `engine` / `vehicle_version`), faltam atributos que diferenciam versões mecânicas de um mesmo carro:
* **Código do motor:** Identificador de engenharia da montadora (ex.: VW `EA111` vs `EA211`, Fiat `Fire` vs `Firefly` vs `GSE T270`, GM `Família I` vs `CSS Prime`, Renault `K4M` vs `H4M` vs `SCe`).
* **Deslocamento (litragem) e arquitetura:** Cilindrada comercial (`1.0`, `1.3`, `1.4`, `1.6`, `2.0`, `3.0`), número de cilindros (`3 cil`, `4 cil`, `V6`) e cabeçote/válvulas (`8V`, `12V`, `16V`, `24V`).
* **Aspiração e injeção:** Aspirado natural, Turbo com injeção indireta, Turbo com injeção direta (`TGDI` / `TSI` / `THP`) ou Biturbo.
* **Combustível e pós-tratamento de gases:** Gasolina, Etanol, Flex, Diesel (S10 / S500), GNV ou Híbrido, além da presença de **DPF** (Filtro de Partículas Diesel) ou **GPF** (Filtro de Partículas a Gasolina). Um motor diesel com DPF exige óleo de baixo teor de cinzas sulfatadas (Low/Mid SAPS); usar óleo comum destrói o filtro de partículas.

#### B. Capacidades Volumétricas e Dados de Serviço na Aplicação
A tabela `technical_specification` hoje tem apenas `id`, `catalog_id` e `vehicle_id`. Esses dados de serviço pertencem ao vínculo entre o motor e o fluido, e não ao óleo nem ao veículo isoladamente:
* **Volume de óleo do cárter com troca de filtro** (ex.: `4,0 litros`) e **sem troca de filtro** (ex.: `3,6 litros`), além do volume de enchimento a seco após retífica.
* **Intervalo de manutenção recomendado:** Quilometragem e tempo em meses para **uso normal** (ex.: `10.000 km ou 12 meses`) e **uso severo** (ex.: `5.000 km ou 6 meses` para carros de aplicativo, trânsito pesado, trechos curtos inferiores a 8 km ou estradas de terra).
* **Dados mecânicos de oficina:** Torque de aperto do bujão do cárter (em `Nm`), medida da rosca/chave do bujão e código do anel de vedação (arruela de esmagamento ou anel O-ring), item que toda troca de óleo precisa faturar.

#### C. Normas Técnicas Estruturadas de Lubrificantes
Guardar `"5W30 Sintético API SP"` tudo misturado numa string `specification` inviabiliza buscas por equivalência técnica. Dois óleos `5W-30` sintéticos podem ser totalmente incompatíveis entre si. O cadastro de óleos precisa separar:
* **Grau de viscosidade SAE:** `0W-16`, `0W-20`, `5W-20`, `5W-30`, `5W-40`, `10W-40`, `15W-40`, `20W-50` (motor) ou `75W-80`, `75W-90`, `ATF Dexron VI` (transmissão).
* **Base lubrificante:** Mineral, Semissintético (Base Mista) ou 100% Sintético (Grupos III, IV PAO ou V Éster).
* **Normas internacionais:** **API** (`SL`, `SM`, `SN`, `SN Plus`, `SP` para ciclo Otto; `CI-4`, `CJ-4`, `CK-4` para Diesel), **ACEA** (`A3/B4`, `A5/B5`, `C2`, `C3`, `C5`, `C6`) e **ILSAC** (`GF-5`, `GF-6A`, `GF-6B`).
* **Homologações de Montadora (OEM Approvals):** Este é o dado mais crítico para carros modernos (especialmente motores turbo e motores com correia dentada banhada a óleo, como GM Onix 1.0/1.2, Ford Ka 1.0 3cc e Peugeot/Citroën 1.2 PureTech). Exemplos: `GM Dexos1 Gen 3`, `VW 508.88 / 509.99`, `VW 502.00 / 505.00`, `VW 504.00 / 507.00`, `Ford WSS-M2C948-B`, `Fiat 9.55535-GS1 / DS1`, `MB 229.51 / 229.52`, `Renault RN0700 / RN0710`.

#### D. Subtipos Específicos de Filtros e Fluidos
O enum atual (`FILTRO`, `OLEO`) é genérico demais para uma revisão. Na bancada da oficina, uma ordem de serviço discrimina:
* **Subtipos de Filtro:**
  * Filtro de óleo do motor (especificando se é **blindado / spin-on** ou **refil / elemento ecológico de papel**).
  * Filtro de ar do motor (primário e, em utilitários/pesados, secundário de segurança).
  * Filtro de combustível (linha externa, interno ao tanque ou filtro diesel separador de água / tipo Racor).
  * Filtro de cabine / ar-condicionado (simples retentor de partículas ou com carvão ativado / ação bacteriostática).
  * Filtro de transmissão automática / CVT (interno ao cárter do câmbio ou externo de retorno) e filtro desumidificador/ARLA 32 (linha pesada).
* **Subtipos de Fluido:** Óleo de motor, fluido de transmissão manual, fluido de transmissão automática (ATF / CVT / DSG banhado a óleo), fluido de diferencial/caixa de transferência, fluido de freio (`DOT 3`, `DOT 4`, `DOT 4 Class 6 LV`, `DOT 5.1`) e aditivo de arrefecimento (orgânico OAT, híbrido HOAT, concentrado ou pronto para uso).

#### E. Códigos de Peça (Part Numbers) e Conversão (Cross-Reference OEM x Paralelo)
Em filtros, a especificação técnica no mercado real **é o próprio código da peça e suas dimensões físicas** (altura, diâmetro externo, passo de rosca ex.: `M20x1.5`, presença de válvula anti-retorno e válvula de alívio bypass). Hoje nem `catalog` nem `product` possuem campo para o **Part Number**. O sistema precisa de:
* **Código OEM (Montadora):** Ex.: Honda `15400-RTA-003` ou VW `030115561AN`.
* **Código do Fabricante de Reposição (SKU/Part Number) em `product`:** Ex.: Mann-Filter `W 610/6` ou `W 712/52`, Mahle `OC 600` ou `OC 250`, Tecfil `PSL55`, Wega `JFO0411`, Fram `PH6811`, Bosch `0986B00021`.
* **Código de barras (EAN-13 / GTIN)** e **embalagem comercial** (para óleos: frasco de `1L`, galão de `4L`, `5L`, balde de `20L` ou tambor de `200L`).
* **Tabela de Equivalência (Cross-Reference):** Permite que o mecânico digite no `/lookup` ou em `/catalogs/search` o código de um filtro antigo que ele acabou de tirar do carro (ex.: `PSL55`) e o sistema ache imediatamente o item de catálogo equivalente e mostre quais marcas o fornecedor dele tem em estoque (`Mann W 610/6`, `Mahle OC 600`).

---

## 2. Levantamento de Requisitos Funcionais (RF) e Não Funcionais (RNF)

Os requisitos abaixo consolidam o que está desenhado nos documentos `routes.md`, `openapi.yaml`, `jsonxapi.md`, `eap.txt` e `prod/soil.sql`, fechando também as lacunas entre o contrato da API e o schema do banco.

### 2.1. Requisitos Funcionais (RF)

| ID | Módulo | Descrição do Requisito Funcional | Origem / Observação Técnica |
|---|---|---|---|
| **RF01** | Autenticação e Onboarding PJ | Permitir o autocadastro (`POST /auth/signup`) de empresas do setor automotivo exigindo CNPJ válido, razão social/nome, e-mail, telefone e senha. | `openapi.yaml` (`SignupRequest`) e `soil.sql` (`user`, `user_password`). É necessário restaurar a constraint `UNIQUE (cnpj)` que existia em `soil0.sql`. |
| **RF02** | Verificação de E-mail | Enviar token de confirmação após o cadastro, permitir a validação (`POST /auth/verify-email/{token}`) e o reenvio do token (`POST /auth/resend-verification`). | `routes.md` / `openapi.yaml`. Exige criar colunas de controle (`email_verified_at` / tabela de tokens) no MySQL. |
| **RF03** | Fluxo de Aprovação Cadastral (Admin) | Manter novos cadastros em estado pendente (`GET /auth/pending-approval`) até que um administrador avalie a fila (`GET /admin/users/pending`) e aprove (`POST /admin/users/{id}/approve`) ou rejeite (`POST /admin/users/{id}/reject`) a conta. | `routes.md` / `openapi.yaml`. Exige adicionar coluna `status ENUM('PENDING','APPROVED','REJECTED')` e `role ENUM('USER','ADMIN')` na tabela `user`. |
| **RF04** | Login, Sessão e Recuperação de Senha | Autenticar usuários com e-mail e senha (`POST /auth/login`) emitindo Bearer Token (JWT), encerrar sessão (`POST /auth/logout`) e permitir recuperação de senha via token enviado por e-mail (`POST /auth/forgot-password` e `POST /auth/reset-password/{token}`). | `routes.md` / `jsonxapi.md`. Senhas armazenadas com hash na tabela `user_password`. |
| **RF05** | Gestão do Próprio Perfil | Permitir ao usuário autenticado consultar seus dados (`GET /users/me`), atualizar nome, e-mail e telefone (`PATCH /users/me`) e alterar sua senha mediante confirmação da senha atual (`PATCH /users/me/password`). | `routes.md` / `openapi.yaml`. O CNPJ não pode ser alterado pelo próprio usuário após aprovação. |
| **RF06** | Gestão da Base de Veículos (Admin) | Permitir ao administrador criar (`POST /vehicles`), atualizar (`PATCH /vehicles/{id}`) e remover (`DELETE /vehicles/{id}`) veículos com marca, modelo, categoria/tipo e faixa de anos (`manuf_year_start` <= `manuf_year_end`), além de motorização quando expandido. | `openapi.yaml` / `soil.sql`. Necessário padronizar o nome do campo entre API (`manufacturer`) e banco (`brand`). |
| **RF07** | Consulta e Busca de Veículos | Permitir a usuários autenticados listar veículos com filtros combinados por marca, modelo, tipo e ano (`GET /vehicles`), consultar detalhes por ID (`GET /vehicles/{id}`) e realizar busca textual/avançada (`GET /vehicles/search`). | `routes.md` / `openapi.yaml` / `eap.txt`. O filtro `year` deve verificar se o ano informado está contido entre `manuf_year_start` e `manuf_year_end`. |
| **RF08** | Gestão do Catálogo Técnico (Admin) | Permitir ao administrador criar (`POST /catalogs`), atualizar (`PATCH /catalogs/{id}`) e excluir (`DELETE /catalogs/{id}`) especificações técnicas de óleos e filtros. | `openapi.yaml` / `soil.sql`. **Correção obrigatória:** incluir o campo `name` no schema `CatalogCreate` do OpenAPI (hoje é `NOT NULL` no SQL e inexiste no YAML). |
| **RF09** | Consulta ao Catálogo Técnico | Permitir listar itens do catálogo por tipo e especificação (`GET /catalogs`), ver detalhes (`GET /catalogs/{id}`) e executar busca avançada (`GET /catalogs/search`). | `routes.md` / `openapi.yaml`. |
| **RF10** | Vínculo de Aplicação Veículo x Catálogo (Admin) | Permitir ao administrador criar (`POST /technical-specifications`) e remover (`DELETE /technical-specifications/{id}`) o vínculo de compatibilidade entre um `vehicle_id` e um `catalog_id`. | `routes.md` / `openapi.yaml` / `soil.sql`. Deve haver constraint `UNIQUE (vehicle_id, catalog_id)` para evitar vínculos duplicados. |
| **RF11** | Navegação Cruzada de Compatibilidade | Permitir consultar todas as especificações técnicas compatíveis com um veículo (`GET /vehicles/{id}/catalogs`), todos os veículos que utilizam determinado item de catálogo (`GET /catalogs/{id}/vehicles`) e listar os vínculos (`GET /technical-specifications`). | `routes.md` / `openapi.yaml`. Muito útil no balcão de autopeças para saber em quais outros carros uma peça do estoque serve. |
| **RF12** | Gestão de Catálogo de Preços e Marcas por Lojista/Oficina | Permitir que a empresa autenticada cadastre (`POST /products`), edite (`PATCH /products/{id}`), exclua (`DELETE /products/{id}`) e liste (`GET /products`, `GET /users/{id}/products`) seus produtos comerciais (marca do fabricante da peça/óleo e preço unitário `> 0`) atrelados a um `catalog_id`. | `routes.md` / `openapi.yaml` / `soil.sql`. **Regra de autorização:** um usuário comum só pode criar/editar/excluir produtos cujo `user_id` seja o dele mesmo (extraído do token JWT). |
| **RF13** | Consulta Rápida do Mecânico (`/lookup`) | Disponibilizar o endpoint consolidado `GET /lookup` (filtrando por `manufacturer`, `model`, `year`, `type` e opcionalmente `user_id`) que retorna, em uma única chamada, o veículo localizado, as especificações técnicas de óleo e filtros exigidas e a lista de produtos compatíveis com marcas e preços disponíveis. | `routes.md` / `openapi.yaml` / `eap.txt`. É a tela principal de trabalho diário do mecânico na oficina. |

---

### 2.2. Requisitos Não Funcionais (RNF)

* **RNF01 - Usabilidade Mobile na Oficina (Responsividade):** A interface Angular deve ser desenhada em padrão *mobile-first* (`eap.txt`, item 2.3), com seletores grandes (Marca -> Modelo -> Ano -> Motor) e cards de leitura rápida com alto contraste, pensados para uso pelo mecânico no celular com uma mão só, em ambiente de iluminação variável e mãos sujas de graxa.
* **RNF02 - Desempenho e Indexação de Consultas:** A rota `GET /lookup` e as listagens de veículos devem responder em tempo inferior a 300ms (p95). Conforme previsto na `eap.txt` (item 2.1), o MySQL precisa de índices compostos nas colunas de busca de `vehicle` (`(brand, model, manuf_year_start, manuf_year_end)`) e índice em `catalog (type, specification)`, que ainda não foram declarados no arquivo `prod/soil.sql`.
* **RNF03 - Padronização de Contrato JSON e Paginação:** Todas as respostas da API devem seguir o envelope definido em `docs/api/jsonxapi.md`: `{ "data": ..., "meta": { "page", "per_page", "total" } }` para sucesso e `{ "error": { "code", "message", "details": [{ "field", "issue" }] } }` para falhas, com datas em ISO-8601 UTC e códigos HTTP semânticos (`422 Unprocessable Entity` para erros de validação de payload, `401` para não autenticado, `403` para usuário pendente de aprovação ou sem perfil admin, `409 Conflict` para CNPJ/e-mail duplicado).
* **RNF04 - Segurança, Isolamento de Credenciais e Autorização (RBAC/ABAC):**
  * Senhas nunca devem trafegar ou retornar em payloads de `user`, mantendo o isolamento na tabela `user_password` com hash seguro (`bcrypt` ou `argon2`).
  * Rotas de escrita em `/vehicles`, `/catalogs`, `/technical-specifications` e `/admin/*` devem validar perfil de administrador no middleware de autenticação.
  * Rotas de escrita em `/products` devem impedir **IDOR (Insecure Direct Object Reference)**: no `POST /products`, o `user_id` deve vir do token autenticado (ou validar que `body.user_id == token.sub`), impedindo que uma oficina altere ou injete preços no catálogo de um concorrente.
* **RNF05 - Codificação de Caracteres no Banco de Dados:** O script `prod/soil.sql` define `DEFAULT CHARACTER SET utf8` (que no MySQL equivale ao `utf8mb3` legado). Deve ser atualizado para `utf8mb4` com `COLLATE utf8mb4_unicode_ci` para garantir suporte completo e buscas case/accent-insensitive (ex.: buscar `"oleo"` e encontrar `"Óleo"`).
* **RNF06 - Disponibilidade e Processo de Deploy:** O back-end Node.js/Express deve rodar gerenciado por gerenciador de processos (PM2) com variáveis de ambiente segregadas (`.env`) e rotina de backup/snapshot periódico do MySQL (`eap.txt`, itens 3 e 4).

---

## 3. Casos de Borda de Negócio (O que vai dar errado se for ao ar como está hoje)

Se o Soil for colocado em produção exatamente com o schema atual de `prod/soil.sql` e o contrato `openapi.yaml`, a operação vai enfrentar falhas técnicas imediatas e problemas sérios de aplicação mecânica na oficina:

### 3.1. Mesmo modelo e ano com motores diferentes que exigem óleos incompatíveis
* **O cenário real:** Um mecânico recebe na oficina um **Jeep Compass 2022** ou uma **Fiat Toro 2022** e consulta `GET /lookup?manufacturer=Jeep&model=Compass&year=2022`. Esse mesmo carro e ano saiu de fábrica com duas motorizações completamente diferentes: **1.3 Turbo Flex (T270)** (que usa óleo `0W-30` ACEA C2, Fiat 9.55535-GS1, pegando 4,5 litros) e **2.0 Turbodiesel (TD350)** (que usa óleo `5W-30` ACEA C2 para DPF, Fiat 9.55535-DS1, pegando 4,3 litros e usando filtros de óleo e combustível totalmente diferentes). Outro caso clássico: **VW Gol 2014** (existe 1.0 8V EA111 4 cilindros e 1.0 12V EA211 3 cilindros) ou **Chevrolet Onix 2020** (1.0 Joy aspirado motor SPE/4 com correia seca vs 1.0 Novo Onix com correia banhada a óleo que exige estritamente `0W-20` ou `5W-30` Dexos1 Gen 3).
* **O que acontece hoje no Soil:** Como `vehicle` só tem `brand`, `model`, `type` e anos, ou o admin cadastra um único registro `"Compass 2022"` e pendura nele todos os óleos e filtros dos dois motores (deixando o mecânico adivinhar qual é qual na tela), ou o admin começa a fazer "gambiarra" no nome do modelo (`model = "Compass Longitude 2.0 16V Diesel 4x4 AT9"`), o que destrói a busca por filtro exato `?model=Compass`.
* **Impacto prático:** Se o mecânico colocar o óleo de um motor aspirado comum num Onix de correia banhada a óleo, a borracha da correia esfarela, entope o pescador da bomba de óleo e funde o motor, gerando prejuízo de R$ 12.000+ para a oficina.

### 3.2. Conflito entre Ano de Fabricação (`manuf_year`) e Ano-Modelo, mais viradas de geração no mesmo ano
* **O cenário real:** No Brasil, um carro fabricado em agosto de 2019 já sai no documento (CRLV) como **2019/2020 (Ano-Modelo 2020)**, trazendo as peças da linha 2020. Além disso, quando uma montadora lança uma nova geração (ex.: **Toyota Corolla 2014** geração XEi 2.0 antiga convivendo com a nova geração 2014/2015, ou **Fiat Palio** que conviveu com Palio Fire Economy e Novo Palio Attractive no mesmo ano de 2014), ambas as gerações têm interseção no ano `2014`.
* **O que acontece hoje no Soil:** O banco filtra apenas por `manuf_year_start <= :year AND manuf_year_end >= :year`. Sem distinguir geração/plataforma (ex.: `G1`, `G2`, `E170`, `E210`) e sem deixar claro se o ano consultado é ano-modelo, a busca para o ano de transição retorna os dois carros misturados ou aplica a peça da geração errada.

### 3.3. Mudança de fornecedor de peça no meio do mesmo ano (Quebra por Chassi ou Sistema)
* **O cenário real:** É muito comum na linha francesa (Peugeot/Citroën/Renault), Fiat e VW o mesmo carro, mesmo motor e mesmo ano usar dois filtros de óleo ou de cabine diferentes dependendo do mês de fabricação, do número de chassi ou da marca da caixa de ar/carcaça do filtro (ex.: *"sistema Valeo vs sistema Behr"*, ou *"até chassi 9BW... usa filtro blindado; a partir do chassi X usa refil de papel"*).
* **O que acontece hoje no Soil:** A tabela `technical_specification` tem apenas `catalog_id` e `vehicle_id`, sem nenhuma coluna de `notes` / `application_restriction`. O mecânico vê dois filtros listados para o mesmo carro sem saber o critério de desempate e só descobre que comprou o errado quando já desmontou a peça no elevador.

### 3.4. Colapso de todos os filtros sob o único rótulo `FILTRO`
* **O cenário real:** O mecânico vai fazer a revisão de óleo + 4 filtros (óleo, ar do motor, combustível e ar-condicionado).
* **O que acontece hoje no Soil:** Tanto no `openapi.yaml` (`enum: [FILTRO, OLEO]`) quanto no `soil.sql` (`product.type ENUM('FILTRO', 'OLEO')`), tudo é apenas `FILTRO`. Quando o mecânico chama `GET /lookup?manufacturer=Honda&model=Civic&year=2020&type=FILTRO`, vêm todos os filtros embaralhados na mesma categoria sem distinção estruturada de qual é filtro de óleo, ar, combustível ou cabine.

### 3.5. Impossibilidade de fechar orçamento real na oficina (Preço unitário sem volume de cárter nem embalagem)
* **O cenário real:** Um Volkswagen Amarok V6 pega **8,0 litros** de óleo na troca com filtro; um Renault Kwid 1.0 pega **3,0 litros**; um Honda Civic 2.0 pega **4,2 litros** (obrigando a comprar 5 frascos de 1 litro ou 1 galão de 4L + 1 frasco de 1L).
* **O que acontece hoje no Soil:** O item de produto (`product`) tem apenas `price DECIMAL(10,2)` e `brand`, sem informar se aquele preço é de uma garrafa de 1L, galão de 4L ou balde de 20L, e sem informar quantos litros o veículo exige. O mecânico vê `R$ 48,90` na tela, mas não tem a informação principal da troca de óleo: **quantos litros colocar no motor** e quanto vai custar a troca completa para passar o orçamento ao cliente no WhatsApp.

### 3.6. Rupturas técnicas imediatas entre o Banco (`prod/soil.sql`) e a API (`openapi.yaml`)
Antes mesmo dos problemas de domínio automotivo, se o back-end for conectado hoje ao `prod/soil.sql` seguindo o `openapi.yaml`, ocorrerão quebras em tempo de execução:
1. **`POST /catalogs` vai falhar com erro de banco (SQL Error 1364):** A tabela `catalog` exige `name VARCHAR(255) NOT NULL`, mas o schema `CatalogCreate` no `openapi.yaml` envia apenas `type` e `specification`.
2. **`POST /products` vai falhar com erro de banco (SQL Error 1364):** A tabela `product` exige `type ENUM('FILTRO', 'OLEO') NOT NULL`, mas o schema `ProductCreate` no `openapi.yaml` envia apenas `user_id`, `catalog_id`, `price` e `manufacturer` (que no banco se chama `brand`).
3. **Rotas de aprovação de cadastro e verificação de e-mail não têm onde salvar estado:** As rotas `/auth/verify-email/{token}`, `/auth/pending-approval`, `/admin/users/pending`, `/admin/users/{id}/approve` e `/reject` estão documentadas na API, mas a tabela `user` em `prod/soil.sql` não possui colunas para status de aprovação, flag de e-mail verificado, perfil (`role`) ou tokens de verificação/reset de senha.
4. **Duplicidade de CNPJ liberada por acidente:** No arquivo anterior `prod/soil0.sql` existia `UNIQUE INDEX cnpj_UNIQUE (cnpj ASC)`, mas essa constraint foi apagada em `prod/soil.sql`, permitindo que o mesmo CNPJ crie múltiplas contas.
5. **Deleção de veículo ou catálogo gera erro 500 por Foreign Key:** As chaves estrangeiras em `technical_specification` e `product` não possuem cláusula `ON DELETE CASCADE` nem o banco possui exclusão lógica (`deleted_at` / `active`), fazendo com que `DELETE /vehicles/{id}` ou `DELETE /catalogs/{id}` estourem erro de integridade referencial assim que houver qualquer vínculo cadastrado.
</SYSTEM_MESSAGE>

---

## Arquiteto de Banco de Dados e Persistência MySQL 8.0 (`608c45e6-bf47-4283-98c5-566104b7870c`)

The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.

<SYSTEM_MESSAGE>
[Message] timestamp=2026-10-24T23:45:37Z sender=608c45e6-bf47-4283-98c5-566104b7870c priority=MESSAGE_PRIORITY_HIGH content=# Auditoria de Banco de Dados — Projeto Soil (DBA Sênior)

Analisei os scripts SQL (`prod/soil.sql`, `prod/soil0.sql`, `snapshots/soil_20260413_0.sql`, e o histórico do repositório em `testing/soil_dz.sql` e `testing/soilj.sql`), o modelo do MySQL Workbench (`prod/soil.png`), o plano de projeto (`docs/projeto/eap.txt`) e a especificação da API (`docs/api/openapi.yaml`, `docs/api/routes.md` e `docs/api/jsonxapi.md`).

O schema de produção atual (`prod/soil.sql`) não sustenta o contrato prometido pela API. Se o back-end Node.js rodar contra esse banco hoje, várias rotas vão quebrar com erros de coluna inexistente, violação de `NOT NULL` sem default ou lentidão por falta de índices.

---

## 1. Divergências Críticas entre o Banco (`soil.sql`) e a API (`openapi.yaml` / `routes.md`)

### 1.1. Fluxo de Autenticação, Aprovação Admin e Recuperação de Senha inexistente no DDL
A API documenta um ciclo completo de gestão de conta em `openapi.yaml` e `routes.md`:
- Validação de e-mail: `POST /auth/verify-email/{token}` e `POST /auth/resend-verification`
- Fila de moderação de cadastros: `GET /auth/pending-approval`, `GET /admin/users/pending`, `POST /admin/users/{id}/approve` e `POST /admin/users/{id}/reject`
- Reset de senha e sessão: `POST /auth/forgot-password`, `POST /auth/reset-password/{token}` e `POST /auth/logout`
- Rotas exclusivas para administradores (`POST/PATCH/DELETE` em `/vehicles`, `/catalogs`, `/technical-specifications` e `/admin/users/*`).

Na tabela `user` de `prod/soil.sql` (linhas 54-64), existem apenas `id`, `cnpj`, `name`, `email`, `phone`, `created_at` e `updated_at`. Não há coluna `status` (`PENDING`, `APPROVED`, `REJECTED`), não há coluna `role` (`USER`, `ADMIN`), não há `email_verified_at` nem rastreio de quem aprovou ou rejeitou a conta (`reviewed_by`, `reviewed_at`). Também não existe tabela para armazenar os tokens temporários de verificação de e-mail e redefinição de senha (`user_token`) com data de expiração e invalidação.

### 1.2. Conflito de Nomenclatura (`manufacturer` vs `brand`) e Quebras de `INSERT` por Campos Omitidos
O contrato JSON (`openapi.yaml` e `jsonxapi.md`) e o schema SQL usam nomes diferentes e exigem campos incompatíveis:
- **`manufacturer` vs `brand`**: Os schemas `VehicleCreate`, `VehicleUpdate`, `ProductCreate`, `ProductUpdate` e os query params de `GET /vehicles` e `GET /lookup` usam `manufacturer`. Já as tabelas `vehicle` (linha 12) e `product` (linha 89) definem a coluna como `brand`.
- **`catalog.name` obrigatório no banco, mas ausente na API**: Em `prod/soil.sql` (linha 27), a tabela `catalog` exige `name VARCHAR(255) NOT NULL` sem valor padrão. Porém, `CatalogCreate` (`openapi.yaml` linhas 495-503) envia apenas `type` e `specification`. Qualquer tentativa de criar um item de catálogo via `POST /catalogs` falhará no MySQL com erro `1364 (ER_NO_DEFAULT_FOR_FIELD)`.
- **`product.type` obrigatório no banco, mas ausente no `ProductCreate`**: O payload de `POST /products` (`openapi.yaml` linhas 512-520) envia apenas `user_id`, `catalog_id`, `price` e `manufacturer`. Como `product.type` está definido como `ENUM('FILTRO', 'OLEO') NOT NULL` sem default, o `INSERT` também vai falhar ou gravar o primeiro valor do enum de forma silenciosa se o strict mode estiver desativado.

### 1.3. Regressão de Integridade: Perda do `UNIQUE INDEX` de CNPJ em Produção
Nos arquivos iniciais `prod/soil0.sql` (linha 59) e `snapshots/soil_20260413_0.sql` (linha 61), a tabela `user` tinha a constraint `UNIQUE INDEX cnpj_UNIQUE (cnpj ASC) VISIBLE`. Quando a senha foi extraída para a tabela `user_password` na versão de produção (`prod/soil.sql` e `prod/soil.png`), o índice único de `cnpj` desapareceu. Hoje o banco de produção aceita múltiplos cadastros com o mesmo CNPJ.

Outro problema no diretório de snapshots: o arquivo `snapshots/soil_20260413_0.sql` está truncado na linha 82 (`REF`) e utiliza `USE @dbname;` e `CREATE TABLE IF NOT EXISTS @dbname.vehicle` nas linhas 5 e 10, o que é sintaxe inválida no MySQL fora de Prepared Statements.

### 1.4. Violação de 3ª Forma Normal (3FN) entre `catalog` e `product`
Na tabela `catalog` (`prod/soil.sql` linha 28), `type` é `VARCHAR(255) NOT NULL`, enquanto na tabela `product` (linha 90) `type` é `ENUM('FILTRO', 'OLEO') NOT NULL`.
Como todo registro em `product` referencia obrigatoriamente um `catalog_id`, a natureza do item (`FILTRO` ou `OLEO`) pertence ao catálogo, não à oferta do fornecedor. Repetir `type` em `product` duplica dados e permite anomalias onde um produto aponta para um `catalog_id` de óleo mas está marcado como `FILTRO` na tabela `product`. O `ENUM('FILTRO', 'OLEO')` deve ficar apenas em `catalog.type`, exatamente como definido em `CatalogCreate` no OpenAPI.

### 1.5. Duplicidade em `technical_specification` e Ausência de Políticas `ON DELETE`
A tabela associativa `technical_specification` (`prod/soil.sql` linhas 37-48) possui uma chave primária artificial (`id AUTO_INCREMENT`), mas não tem uma constraint `UNIQUE (vehicle_id, catalog_id)`. Nada impede que a rota `POST /technical-specifications` insira o mesmo vínculo entre veículo e item de catálogo várias vezes, poluindo o retorno de `/lookup` e `/vehicles/{id}/catalogs`.

Além disso, todas as chaves estrangeiras do banco foram declaradas sem `ON DELETE`. Quando um administrador executar `DELETE /vehicles/{id}` ou `DELETE /catalogs/{id}`, o banco bloqueará a operação caso existam vínculos em `technical_specification`, ou exigirá deleção manual em cascata na aplicação. Em `user_password`, a falta de `ON DELETE CASCADE` também impede a remoção limpa de usuários.

### 1.6. Charset `utf8` Depreciado (`utf8mb3`)
O script `prod/soil.sql` (linha 4) cria o schema com `DEFAULT CHARACTER SET utf8`. No MySQL 8.0+, `utf8` é um alias legado para `utf8mb3` (depreciado) que suporta apenas 3 bytes por caractere. O banco deve usar `utf8mb4` com collation `utf8mb4_0900_ai_ci`, garantindo suporte completo a Unicode e buscas insensíveis a maiúsculas e acentuação (para que buscas por `caminhao` ou `Caminhão` retornem o mesmo resultado).

---

## 2. Modelagem Automotiva e Performance (Meta `< 10ms` em `/lookup` e `/vehicles`)

### 2.1. Gargalos de Consulta no Schema Atual
Em `prod/soil.sql`, não há nenhum índice pensado para leitura além das Primary Keys e dos índices simples gerados automaticamente para as Foreign Keys.
Veja o que acontece nas duas rotas mais acessadas pelos mecânicos:

1. **`GET /vehicles?manufacturer=Honda&model=Civic&type=CARRO&year=2020`**
   A query filtra por igualdade em `manufacturer`, `model`, `type` e por intervalo de anos (`manuf_year_start <= 2020 AND manuf_year_end >= 2020`). Sem índice composto em `vehicle`, o MySQL faz **Full Table Scan** em toda a frota cadastrada.
2. **`GET /lookup?manufacturer=Honda&model=Civic&year=2020&type=OLEO&user_id=5`**
   Esta consulta faz um JOIN de 4 a 5 tabelas (`vehicle` $\rightarrow$ `technical_specification` $\rightarrow$ `catalog` $\rightarrow$ `product` $\rightarrow$ `user`). Sem índices compostos cobrindo as pontas do JOIN e os filtros de ano e tipo, o otimizador precisa varrer tabelas inteiras e criar tabelas temporárias em memória/disco.

### 2.2. Estratégia de Indexação para Sub-10ms no MySQL 8+ (InnoDB)
Para que o InnoDB resolva `/vehicles`, `/lookup` e as buscas textuais (`/vehicles/search` e `/catalogs/search`) em menos de 10ms usando apenas páginas em RAM (Buffer Pool) e **Covering Indexes** (Index-Only Scans):

| Tabela | Índice Proposto | Justificativa Técnica |
|---|---|---|
| `vehicle` | `idx_vehicle_lookup (manufacturer, model, type, manuf_year_start, manuf_year_end)` | Atende os predicados de igualdade (`manufacturer`, `model`, `type`) seguidos pelo range de ano (`manuf_year_start <= :year AND manuf_year_end >= :year`). Como toda folha de índice secundário no InnoDB contém a PK (`id`), o MySQL descobre os `vehicle.id` compatíveis lendo apenas a B-Tree do índice, sem acessar as páginas de dados da tabela. |
| `vehicle` | `idx_vehicle_type_years (type, manuf_year_start, manuf_year_end)` | Cobre listagens em que o usuário filtra apenas por categoria de veículo e ano. |
| `vehicle` | `FULLTEXT idx_ft_vehicle_search (manufacturer, model, version)` | Substitui `LIKE '%termo%'` por `MATCH(manufacturer, model, version) AGAINST(? IN BOOLEAN MODE)` na rota `GET /vehicles/search`, mantendo tempo de resposta em poucos milissegundos. |
| `technical_specification` | `UNIQUE uq_tech_spec_vehicle_catalog (vehicle_id, catalog_id)` | Impede vínculos duplicados e funciona como Covering Index para o JOIN `vehicle` $\rightarrow$ `technical_specification` $\rightarrow$ `catalog` em `/lookup` e `GET /vehicles/{id}/catalogs`. |
| `technical_specification` | `idx_tech_spec_catalog_vehicle (catalog_id, vehicle_id)` | Cobre o JOIN no sentido inverso para a rota `GET /catalogs/{id}/vehicles`. |
| `catalog` | `idx_catalog_type_spec (type, specification)` | Acelera `GET /catalogs?type=...&specification=...` e o filtro de tipo de item (`FILTRO` ou `OLEO`) durante o `/lookup`. |
| `catalog` | `FULLTEXT idx_ft_catalog_search (name, specification, oem_code)` | Suporta a rota `GET /catalogs/search` para buscas rápidas por viscosidade (`5W30`), norma (`API SP`, `ACEA C3`) ou código de peça. |
| `product` | `idx_product_catalog_user_price (catalog_id, user_id, price)` | Índice composto desenhado sob medida para o final do `/lookup` e `GET /products`: localiza os produtos pelo `catalog_id` (e `user_id` quando filtrado) já entregando o preço (`price`) ordenado na folha do índice. |
| `product` | `idx_product_user_catalog (user_id, catalog_id)` | Atende `GET /users/{id}/products` e a gestão de estoque do lojista. |
| `user` | `idx_user_status_created (status, created_at)` | Permite que `GET /admin/users/pending` busque apenas os registros `status = 'PENDING'` ordenados por chegada sem ler os usuários já aprovados. |

### 2.3. Ajustes de Modelagem para Dados Automotivos Reais
No domínio de lubrificantes e filtros (conforme previsto no `eap.txt`), dois carros do mesmo modelo e ano (ex.: Fiat Toro 2021 1.8 Flex vs 2.0 Turbo Diesel) exigem óleos, capacidades de cárter e filtros totalmente distintos. Para suportar os dados reais sem quebrar os payloads atuais do `openapi.yaml`:
- **`vehicle`**: redução de `VARCHAR(255)` para tamanhos reais (`manufacturer VARCHAR(80)`, `model VARCHAR(120)`, `type VARCHAR(40)`), troca de `INT` (4 bytes) por `SMALLINT UNSIGNED` (2 bytes) nos anos de fabricação, e adição da coluna opcional `version VARCHAR(120) NULL` (ex.: `2.0 16V Turbo Diesel`, `1.0 12V TSI`) para diferenciar motorizações quando necessário.
- **`catalog`**: `name` passa a ser opcional (`VARCHAR(150) NULL`) para não quebrar `POST /catalogs`, `type` passa a ser `ENUM('FILTRO', 'OLEO') NOT NULL`, e adicionamos colunas opcionais técnicas (`category VARCHAR(40) NULL` para diferenciar filtro de óleo/ar/combustível/cabine ou óleo de motor/câmbio, e `oem_code VARCHAR(80) NULL`).
- **`technical_specification`**: adição de colunas opcionais de aplicação (`capacity_liters DECIMAL(4,2) NULL` para volume do cárter com filtro, `interval_km INT UNSIGNED NULL` e `notes VARCHAR(255) NULL`).
- **`product`**: renomeação de `brand` para `manufacturer VARCHAR(80) NOT NULL`, remoção da coluna redundante `type`, e inclusão de `sku VARCHAR(60) NULL` (código da peça no fabricante, ex.: `PSL55`, `W712/95`) e `is_available BOOLEAN NOT NULL DEFAULT TRUE`.

---

## 3. Proposta de Schema DDL v2 (MySQL 8.0+ / Cloud SQL)

O script abaixo está pronto para execução em MySQL 8.0+ (incluindo Google Cloud SQL for MySQL), com `utf8mb4_0900_ai_ci`, constraints nomeadas, integridade referencial ajustada e todos os índices de performance.

```sql
-- ============================================================================
-- Schema Soil v2 - Produção (MySQL 8.0+ / Google Cloud SQL)
-- ============================================================================

SET NAMES utf8mb4;
SET TIME_ZONE = '+00:00';

CREATE SCHEMA IF NOT EXISTS soil
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE soil;

-- ----------------------------------------------------------------------------
-- 1. Tabela: user
-- Suporta /auth/signup, /auth/pending-approval, /admin/users/* e /users/me
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  cnpj              VARCHAR(18)     NOT NULL,
  name              VARCHAR(150)    NOT NULL,
  email             VARCHAR(255)    NOT NULL,
  phone             VARCHAR(20)     NOT NULL,
  role              ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  status            ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  email_verified_at TIMESTAMP       NULL DEFAULT NULL,
  reviewed_at       TIMESTAMP       NULL DEFAULT NULL,
  reviewed_by       INT UNSIGNED    NULL DEFAULT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_user_cnpj (cnpj ASC) VISIBLE,
  UNIQUE INDEX uq_user_email (email ASC) VISIBLE,
  INDEX idx_user_status_created (status ASC, created_at ASC) VISIBLE,
  INDEX idx_user_reviewed_by (reviewed_by ASC) VISIBLE,
  CONSTRAINT fk_user_reviewed_by
    FOREIGN KEY (reviewed_by)
    REFERENCES `user` (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 2. Tabela: user_password
-- Isola credenciais de autenticação (1:1 com user)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_password (
  user_id             INT UNSIGNED  NOT NULL,
  password_hash       VARCHAR(255)  NOT NULL,
  password_updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_password_user
    FOREIGN KEY (user_id)
    REFERENCES `user` (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 3. Tabela: user_token
-- Suporta /auth/verify-email/{token}, /auth/resend-verification,
-- /auth/forgot-password, /auth/reset-password/{token} e revogação no /auth/logout
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_token (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    NOT NULL,
  token_hash  CHAR(64)        NOT NULL COMMENT 'SHA-256 do token enviado ao usuário',
  purpose     ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'SESSION_REFRESH') NOT NULL,
  expires_at  TIMESTAMP       NOT NULL,
  used_at     TIMESTAMP       NULL DEFAULT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_user_token_hash (token_hash ASC) VISIBLE,
  INDEX idx_user_token_user_purpose (user_id ASC, purpose ASC, expires_at ASC) VISIBLE,
  CONSTRAINT fk_user_token_user
    FOREIGN KEY (user_id)
    REFERENCES `user` (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Tabela: vehicle
-- Alinhada com VehicleCreate/VehicleUpdate (manufacturer em vez de brand)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  manufacturer      VARCHAR(80)       NOT NULL,
  model             VARCHAR(120)      NOT NULL,
  version           VARCHAR(120)      NULL DEFAULT NULL COMMENT 'Motorização/versão (ex: 1.6 16V MSI)',
  type              VARCHAR(40)       NOT NULL COMMENT 'Ex: CARRO, MOTO, CAMINHAO, UTILITARIO',
  manuf_year_start  SMALLINT UNSIGNED NOT NULL,
  manuf_year_end    SMALLINT UNSIGNED NOT NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_vehicle_years CHECK (
    manuf_year_start >= 1900
    AND manuf_year_end <= 2100
    AND manuf_year_start <= manuf_year_end
  ),
  -- Índice composto principal para /vehicles e /lookup (< 10ms)
  INDEX idx_vehicle_lookup (manufacturer ASC, model ASC, type ASC, manuf_year_start ASC, manuf_year_end ASC) VISIBLE,
  INDEX idx_vehicle_type_years (type ASC, manuf_year_start ASC, manuf_year_end ASC) VISIBLE,
  -- Índice Full-Text para /vehicles/search
  FULLTEXT INDEX idx_ft_vehicle_search (manufacturer, model, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. Tabela: catalog
-- Alinhada com CatalogCreate/CatalogUpdate (type ENUM e name opcional)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog (
  id            INT UNSIGNED            NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150)            NULL DEFAULT NULL COMMENT 'Nome descritivo opcional (ex: Óleo Sintético 5W-30)',
  type          ENUM('FILTRO', 'OLEO')  NOT NULL,
  category      VARCHAR(40)             NULL DEFAULT NULL COMMENT 'Subtipo opcional: OLEO_MOTOR, FILTRO_OLEO, FILTRO_AR, FILTRO_CABINE, FILTRO_COMBUSTIVEL',
  specification VARCHAR(255)            NOT NULL COMMENT 'Especificação técnica (ex: SAE 5W-30 API SP / ACEA C3 ou Rosca M20x1.5)',
  oem_code      VARCHAR(80)             NULL DEFAULT NULL COMMENT 'Código de referência original/OEM opcional',
  created_at    TIMESTAMP               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP               NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_catalog_type_spec (type ASC, specification ASC) VISIBLE,
  FULLTEXT INDEX idx_ft_catalog_search (name, specification, oem_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 6. Tabela: technical_specification
-- Relacionamento N:N entre vehicle e catalog sem duplicatas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technical_specification (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vehicle_id      INT UNSIGNED  NOT NULL,
  catalog_id      INT UNSIGNED  NOT NULL,
  capacity_liters DECIMAL(4,2)  NULL DEFAULT NULL COMMENT 'Volume de fluido em litros (ex: 4.20)',
  interval_km     INT UNSIGNED  NULL DEFAULT NULL COMMENT 'Intervalo de troca recomendado em km (ex: 10000)',
  notes           VARCHAR(255)  NULL DEFAULT NULL COMMENT 'Observações de aplicação (ex: Com troca de filtro)',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Garante unicidade do vínculo e cobre o JOIN vehicle -> catalog no /lookup
  UNIQUE INDEX uq_tech_spec_vehicle_catalog (vehicle_id ASC, catalog_id ASC) VISIBLE,
  -- Cobre o JOIN inverso catalog -> vehicle em /catalogs/{id}/vehicles
  INDEX idx_tech_spec_catalog_vehicle (catalog_id ASC, vehicle_id ASC) VISIBLE,
  CONSTRAINT fk_technical_specification_vehicle
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicle (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_technical_specification_catalog
    FOREIGN KEY (catalog_id)
    REFERENCES catalog (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 7. Tabela: product
-- Alinhada com ProductCreate/ProductUpdate (manufacturer em vez de brand,
-- sem duplicar a coluna type que já pertence a catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED  NOT NULL,
  catalog_id    INT UNSIGNED  NOT NULL,
  manufacturer  VARCHAR(80)   NOT NULL COMMENT 'Marca comercial do produto (ex: Mobil, Motul, Mann-Filter, Tecfil)',
  sku           VARCHAR(60)   NULL DEFAULT NULL COMMENT 'Part number / código comercial (ex: W712/95, PSL55)',
  price         DECIMAL(10,2) NOT NULL,
  is_available  BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_product_price CHECK (price > 0),
  -- Covering index para /lookup e /products?catalog_id=...&user_id=...
  INDEX idx_product_catalog_user_price (catalog_id ASC, user_id ASC, is_available ASC, price ASC) VISIBLE,
  -- Índice para /users/{id}/products
  INDEX idx_product_user_catalog (user_id ASC, catalog_id ASC) VISIBLE,
  CONSTRAINT fk_product_user
    FOREIGN KEY (user_id)
    REFERENCES `user` (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_product_catalog
    FOREIGN KEY (catalog_id)
    REFERENCES catalog (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Query de Referência para o Endpoint `GET /lookup` (< 10ms)
Com o Schema DDL v2 acima, a rota `/lookup` pode ser executada em uma única query parametrizada que usa `idx_vehicle_lookup` $\rightarrow$ `uq_tech_spec_vehicle_catalog` $\rightarrow$ `catalog` (PK) $\rightarrow$ `idx_product_catalog_user_price`:

```sql
SELECT
  v.id                AS vehicle_id,
  v.manufacturer      AS vehicle_manufacturer,
  v.model             AS vehicle_model,
  v.version           AS vehicle_version,
  v.type              AS vehicle_type,
  v.manuf_year_start,
  v.manuf_year_end,
  c.id                AS catalog_id,
  c.type              AS catalog_type,
  c.category          AS catalog_category,
  c.specification     AS catalog_specification,
  ts.capacity_liters,
  ts.interval_km,
  p.id                AS product_id,
  p.manufacturer      AS product_manufacturer,
  p.sku               AS product_sku,
  p.price             AS product_price,
  u.id                AS supplier_id,
  u.name              AS supplier_name
FROM vehicle v
INNER JOIN technical_specification ts
  ON ts.vehicle_id = v.id
INNER JOIN catalog c
  ON c.id = ts.catalog_id
LEFT JOIN product p
  ON p.catalog_id = c.id
  AND p.is_available = TRUE
  AND (:user_id IS NULL OR p.user_id = :user_id)
LEFT JOIN `user` u
  ON u.id = p.user_id
  AND u.status = 'APPROVED'
WHERE (:manufacturer IS NULL OR v.manufacturer = :manufacturer)
  AND (:model IS NULL OR v.model = :model)
  AND (:year IS NULL OR (v.manuf_year_start <= :year AND v.manuf_year_end >= :year))
  AND (:type IS NULL OR c.type = :type)
ORDER BY c.type ASC, p.price ASC;
```
</SYSTEM_MESSAGE>

---

## Arquiteto de Software Backend e Frontend (`5dbb82cc-fc84-4d40-a301-02296bc679d8`)

The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.

<SYSTEM_MESSAGE>
[Message] timestamp=2026-10-24T23:45:48Z sender=5dbb82cc-fc84-4d40-a301-02296bc679d8 priority=MESSAGE_PRIORITY_HIGH content=# Análise de Arquitetura, Backend e UX — Projeto Soil

Analisei os artefatos de documentação (`docs/projeto/eap.txt`, `docs/api/openapi.yaml`, `docs/api/routes.md`, `docs/api/jsonxapi.md`) em conjunto com o schema de produção (`prod/soil.sql`). Abaixo estão os pontos críticos encontrados nos contratos atuais e a proposta arquitetural para o Backend Node.js e o Frontend Angular.

---

## 1. Auditoria do Contrato da API (`openapi.yaml`, `routes.md`, `jsonxapi.md`)

### 1.1. Metadados de paginação enviados no corpo de um POST (`jsonxapi.md`)
Nas linhas 85 a 101 de `docs/api/jsonxapi.md`, o exemplo de requisição `POST /api/vehicles` envia metadados de paginação dentro do body do request:
```json
{
  "data": {
    "manufacturer": "Toyota",
    "model": "Corolla",
    "year": 2024
  },
  "meta": { 
    "page": 1, 
    "per_page": 20, 
    "total": 100 
  }
}
```
Paginação (`page`, `per_page`, `total`) pertence apenas às respostas de listagem (`GET`). Além disso, há uma contradição estrutural entre os documentos: o `jsonxapi.md` envelopa o payload de entrada em `{"data": { ... }}` e usa um campo `"year": 2024`, enquanto o `openapi.yaml` (linhas 476–485) espera os atributos direto na raiz do JSON (`manufacturer`, `model`, `type`, `manuf_year_start`, `manuf_year_end`). É preciso padronizar: **requests recebem o objeto direto na raiz** (ou apenas `{ data }` sem `meta`), e **responses** usam `{ data, meta }`.

### 1.2. Vulnerabilidade de IDOR / Mass Assignment em `ProductCreate` (`openapi.yaml`)
No `openapi.yaml` (linhas 512–520), o schema `ProductCreate` exige `user_id` no corpo da requisição:
```yaml
ProductCreate:
  type: object
  required: [user_id, catalog_id, price, manufacturer]
```
Exigir `user_id` no body de `POST /products` abre uma falha clássica de **IDOR (Insecure Direct Object Reference)** combinada com **Mass Assignment**. Qualquer fornecedor autenticado poderia enviar o `user_id` de um concorrente para cadastrar produtos falsos ou distorcer preços em nome de outra empresa.
- **Correção:** Remover `user_id` de `ProductCreate`. O backend deve extrair a identidade do lojista exclusivamente do token JWT validado (`req.user.sub`). Nas rotas `PATCH /products/{id}` e `DELETE /products/{id}`, o serviço deve verificar se `product.user_id === req.user.sub` (ou se o usuário é `ADMIN`), retornando `403 Forbidden` caso contrário.

### 1.3. Respostas às cegas e ausência de `securitySchemes` (`openapi.yaml`)
- **Schemas de resposta inexistentes:** Todas as rotas do `openapi.yaml` declaram apenas `'200': { description: OK }` ou `'201': { description: Created }`. A seção `components/schemas` define somente contratos de entrada (`*Request`, `*Create`, `*Update`). O time de frontend não sabe pelo contrato qual é a estrutura exata retornada pelo endpoint principal `GET /lookup`, nem se `POST /auth/login` devolve `{ access_token, user }`.
- **Falta de `securitySchemes`:** Não há definição de `bearerAuth` em `components/securitySchemes` nem marcação `security` por rota. A distinção entre rotas públicas (`/auth/login`, `/auth/signup`), rotas de usuário logado (`/products`, `/users/me`) e rotas exclusivas de administrador (`POST /vehicles`, `/admin/users/*`) depende apenas de comentários manuais como `(admin)` no `summary`.
- **Inconsistência de Status HTTP e parâmetros de busca:** O `jsonxapi.md` (linha 69) determina retorno `422 Unprocessable Entity` para falhas de validação, mas o `openapi.yaml` só documenta `400 Bad Request`. Além disso, `GET /vehicles/search` e `GET /catalogs/search` não declaram nenhum query param (`q`, `page`, `per_page`) no OpenAPI.

### 1.4. Conflito de roteamento no Express (`routes.md` e `openapi.yaml`)
Tanto em `routes.md` (linhas 50–54 e 61–65) quanto em `openapi.yaml` (linhas 169–209 e 232–272), as rotas parametrizadas aparecem antes das rotas de busca:
- `GET /vehicles/{id}` antes de `GET /vehicles/search`
- `GET /catalogs/{id}` antes de `GET /catalogs/search`

No Express, a ordem de registro define a precedência da árvore de rotas. Se `router.get('/vehicles/:id', ...)` for declarado antes de `router.get('/vehicles/search', ...)`, uma requisição para `/api/vehicles/search` será capturada pela rota `/:id` com `req.params.id = "search"`, gerando erro `400`/`404` ao validar o ID numérico. As rotas estáticas (`/search`) devem ser registradas antes das rotas dinâmicas (`/:id`).

### 1.5. Divergências entre o contrato da API (`openapi.yaml`) e o Banco (`prod/soil.sql`)
Cruzando o OpenAPI com o DDL do MySQL, há incompatibilidades que vão quebrar a aplicação em tempo de execução:
1. **`CatalogCreate` sem `name`:** Na tabela `catalog` (`soil.sql`, linha 27), a coluna `name VARCHAR(255) NOT NULL` é obrigatória, mas `CatalogCreate` no `openapi.yaml` (linhas 495–503) só envia `type` e `specification`. Qualquer tentativa de criar um item de catálogo pela API resultará em erro de banco (`Field 'name' doesn't have a default value`).
2. **Nomenclatura `brand` vs `manufacturer`:** No SQL (`vehicle.brand` e `product.brand`), a coluna se chama `brand`, enquanto no OpenAPI foi chamada de `manufacturer`. É recomendável padronizar ou mapear explicitamente na camada de repositório/DTO.
3. **Coluna redundante `product.type`:** A tabela `product` (`soil.sql`, linha 90) exige `type ENUM('FILTRO', 'OLEO') NOT NULL`, mas `ProductCreate` no OpenAPI não recebe `type` (pois o tipo já pertence a `catalog.type`).
4. **Fluxo de aprovação e autenticação sem suporte no SQL:** O `openapi.yaml` prevê `/auth/verify-email/{token}`, `/auth/pending-approval` e `/admin/users/{id}/approve`, mas a tabela `user` em `soil.sql` (linhas 54–64) não possui colunas `role`, `status` (ex: `PENDING`, `APPROVED`, `REJECTED`) nem `email_verified_at`.

---

## 2. Arquitetura Backend (Node.js + Express/Fastify + MySQL)

### 2.1. Estrutura de Pastas Modular (Feature-Based)
Em vez de agrupar todo o sistema em pastas horizontais gigantes (`controllers/`, `models/`, `routes/`) como rascunhado no `eap.txt`, uma arquitetura modular por domínio facilita a manutenção e os testes:

```text
src/
├── config/               # Variáveis de ambiente validadas no boot (env.ts), cors, rate-limit
├── shared/
│   ├── database/         # Pool de conexões mysql2/promise (ou Kysely) + healthcheck
│   ├── cache/            # Camada de cache (LRU em memória ou Redis)
│   ├── errors/           # AppError, catálogo de códigos de erro e errorHandler global
│   ├── http/             # Helpers de resposta padronizada ({ data, meta } e { error })
│   └── middlewares/      # authenticateJwt, requireRole, validateRequest (Zod)
├── modules/
│   ├── auth/             # auth.routes, auth.controller, auth.service, token.repository
│   ├── users/            # users.routes, admin-users.routes, users.service, users.repository
│   ├── vehicles/         # vehicles.routes (/search ANTES de /:id), vehicles.service, etc.
│   ├── catalogs/         # catalogs.routes (/search ANTES de /:id), catalogs.service, etc.
│   ├── specs/            # technical-specifications (vínculos veículo <-> catálogo)
│   ├── products/         # estoque/preços por fornecedor com checagem de ownership
│   └── lookup/           # motor de consulta rápida para oficinas (/lookup)
└── app.ts / server.ts    # Bootstrap e Graceful Shutdown (PM2 / Docker)
```

### 2.2. Validação e Padronização de Contratos com Zod
Cada rota passa por um middleware `validate(schema)` baseado em **Zod** (ou validação nativa via JSON Schema se optar por **Fastify**, que já integra geração de OpenAPI e validação de alta performance):
- Valida simultaneamente `req.body`, `req.query` (convertendo strings como `year` e `page` com `z.coerce.number().int()`) e `req.params`.
- Remove propriedades não declaradas (`strip`), blindando o servidor contra Mass Assignment.
- Quando ocorre erro de validação, o middleware formata automaticamente a resposta com HTTP `422 Unprocessable Entity` seguindo o contrato de `jsonxapi.md`:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Os dados enviados são inválidos.",
      "details": [{ "field": "manuf_year_end", "issue": "must_be_gte_start_year" }]
    }
  }
  ```

### 2.3. Autenticação Segura, RBAC e Rate Limiting
- **Hash de Senhas:** Utilizar **Argon2id** (pacote `argon2`) para gravar `password_hash` na tabela `user_password`. Caso a equipe prefira `bcrypt`, configurar `cost >= 12`.
- **Tokens (JWT Curto + Refresh Token HttpOnly):**
  - `Access Token` JWT com expiração curta (15 minutos) enviado no header `Authorization: Bearer <token>`, contendo `{ sub: user.id, role: user.role, status: user.status }`.
  - `Refresh Token` (7 dias) armazenado em cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, permitindo renovar a sessão sem expor credenciais de longa duração ao `localStorage` (proteção contra roubo de sessão via XSS) e viabilizando revogação real no `POST /auth/logout`.
- **RBAC (Controle de Acesso Baseado em Papéis):**
  - Três perfis claros na tabela `user`: `ADMIN` (curadoria de veículos, catálogos, especificações técnicas e aprovação de contas), `SUPPLIER` (autopeças/distribuidoras com CNPJ que gerenciam seus próprios `products`) e `MECHANIC` (consulta técnica e cotação).
  - Usuários recém-cadastrados entram com `status = 'PENDING'`. O middleware `requireApprovedUser` bloqueia a criação de produtos enquanto o cadastro não for aprovado em `/admin/users/{id}/approve`.
- **Rate Limiting:**
  - Nas rotas sensíveis (`/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/resend-verification`), aplicar limite estrito (ex.: 5 requisições a cada 15 minutos por IP/e-mail) retornando `429 Too Many Requests`.
  - Nos endpoints públicos/de leitura (`/lookup`, `/vehicles`), aplicar limite mais folgado (ex.: 120 req/min por IP) para impedir scraping automatizado da base técnica.

### 2.4. Paginação Real e Cache Estratégico para `/lookup`
- **Paginação em todas as listagens:** Adicionar `page` (padrão `1`) e `per_page` (padrão `20`, teto `100`) nas queries SQL com `LIMIT ? OFFSET ?`, executando `COUNT(*)` (ou window function) para devolver `{ data, meta: { page, per_page, total } }`.
- **Otimização de Banco e Índices (`soil.sql`):**
  - A consulta de veículos filtra se o ano informado está entre `manuf_year_start` e `manuf_year_end`. Criar índice composto em `vehicle (brand, model, manuf_year_start, manuf_year_end)`.
  - Em `technical_specification`, adicionar `UNIQUE INDEX idx_vehicle_catalog (vehicle_id, catalog_id)` para evitar vínculos duplicados e acelerar o JOIN.
  - Em `product`, criar índice em `product (catalog_id, price ASC)` para ordenar rapidamente os fornecedores mais baratos de cada peça.
- **Cache em Memória / Redis para `/lookup`:**
  - O tráfego do Soil será majoritariamente composto por consultas repetidas dos carros mais populares da frota brasileira (Onix, HB20, Gol, Strada, Corolla, Civic).
  - Implementar cache (com `lru-cache` no processo Node ou Redis) usando chave normalizada `lookup:${brand}:${model}:${year}:${type}` com TTL de 10 minutos.
  - Quando um administrador edita `technical_specification` ou um fornecedor altera preço em `product`, o serviço invalida o prefixo correspondente no cache. Isso derruba o tempo de resposta do `/lookup` de dezenas de milissegundos no MySQL para menos de 2ms.

---

## 3. Arquitetura Frontend e UX "Estilo Google" (Angular + Material Design 3)

O usuário principal na ponta é o mecânico ou balconista no meio do expediente, muitas vezes pelo celular no pátio da oficina. A interface precisa ter a velocidade do **Google Search** e a clareza de filtragem do **Google Flights**, construída com **Angular moderno (Standalone Components, Signals, Control Flow `@if`/`@for`)** e **Angular Material 3 (M3)**.

### 3.1. Busca Unificada Instantânea (Omnibox) + Seletores Progressivos
Em vez de obrigar o usuário a preencher quatro dropdowns tradicionais toda vez, a tela inicial combina dois modos de entrada na mesma superfície:

1. **Omnibox Instantânea (Estilo Google Search):**
   - Um campo de busca centralizado no topo com foco automático, `debounceTime(200)` e tolerância a abreviações/erros de digitação.
   - O mecânico digita livremente `"civic 2020"`, `"onix 1.0 turbo 22"`, `"hilux diesel"` ou diretamente uma especificação/código (`"5w30"`, `"PSL55"`) e o autocomplete já exibe as combinações exatas de veículo + motorização.
   - **Pronto para evolução:** Esse mesmo input já fica preparado na arquitetura (via detector de regex no Signal de busca) para reconhecer **Placa (padrão Mercosul/antigo)** ou **Chassi (VIN)** em versões futuras, resolvendo o veículo exato em um único passo.
2. **Seletores Progressivos em Chips/Steps (Estilo Google Flights):**
   - Logo abaixo da Omnibox, quatro seletores rápidos em cascata: **Marca → Modelo → Ano → Motor/Versão**.
   - Em vez de `<select>` nativos pequenos, usar **Bottom Sheets** (no mobile) ou **M3 Filter Chips / Menus expansíveis** (no desktop). Ao tocar em "Honda", o passo de "Modelo" já abre automaticamente exibindo apenas modelos Honda; ao tocar em "Civic", a grade de anos mostra apenas os anos compatíveis; ao escolher o ano, se houver mais de uma motorização (ex: `2.0 Flex` vs `1.5 Turbo`), o usuário dá o último toque e o resultado aparece na hora.

### 3.2. Ergonomia Mobile-First para Oficina ("Mãos Sujas de Óleo")
No ambiente de oficina, o celular é operado com uma mão só, dedos sujos de graxa ou sob iluminação ruim:
- **Alvos de Toque Generosos (48x48dp+):** Todos os botões, chips de seleção de ano/motor e ações de contato devem ter altura mínima de `48px` (ou `56px` nas ações primárias) com espaçamento mínimo de `8px` a `12px` entre elementos clicáveis.
- **Alto Contraste Adaptativo (Sol de Pátio vs. Galpão Escuro):**
  - Configurar a paleta do Angular Material 3 com contraste elevado (nível WCAG AAA — mínimo 7:1 nos textos técnicos).
  - No **Modo Claro**, fundo branco puro/cinza muito claro (`#F8FAFC`) com tipografia preta intensa (`#0F172A`) para leitura sob luz solar direta.
  - No **Modo Escuro**, superfícies escuras de alto contraste (`#121212` / `#1E293B`) com badges em tons vibrantes (âmbar para óleo, azul claro para filtros) para uso debaixo do elevador automotivo.
- **Zero Digitação Desnecessária:** Guardar no `localStorage` (via Angular Signal sincronizado) um histórico horizontal de **"Últimos veículos consultados"** em chips clicáveis logo abaixo da busca (`[Honda Civic 2020]` `[VW Gol 1.6 2018]`), permitindo reabrir a especificação do carro que está no box com um único toque.

### 3.3. Exibição Imediata em Cards Resumo (Hierarquia Visual de 2 Segundos)
Assim que o veículo é identificado na rota `/lookup`, o mecânico não deve navegar por tabelas complexas. A tela de resultados apresenta os dados em **Cards Resumo M3** com tipografia numérica tabular (`font-variant-numeric: tabular-nums`):

1. **Card Principal — Óleo do Motor (Destaque Máximo):**
   - **Viscosidade e Norma em destaque gigante:** Ex.: **`5W-30`** (Sintético • API SP / ILSAC GF-6).
   - **Capacidade de Abastecimento clara:** Badge em destaque mostrando **`4,2 Litros (com filtro)`** e `3,9 Litros (sem filtro)`.
2. **Grid de Filtros Compatíveis (Óleo, Ar do Motor, Cabine, Combustível):**
   - Cada categoria de filtro em seu próprio card compacto com ícone identificável.
   - Códigos de referência em fonte monoespaçada grande (ex.: `W 712/95`, `OC 504`, `PSL 55`) acompanhados de um botão de copiar em um toque.
3. **Comparativo de Preços e Disponibilidade dos Fornecedores Locais:**
   - Integrado a cada item do catálogo (óleo ou filtro), exibir a lista de ofertas dos fornecedores cadastrados (`products`), ordenada pelo **menor preço**.
   - Cada linha de fornecedor mostra: **Nome da Autopeças/Distribuidora**, **Marca da peça** (ex: Mobil, Castrol, Mann, Mahle), **Preço (`R$ 42,90`)** e um botão de ação rápida **"Pedir no WhatsApp"** (`min-height: 48px`), que abre o link `wa.me/` do fornecedor já com a mensagem pronta: *"Olá! Vi no Soil o item [Óleo 5W-30 Mobil - Honda Civic 2020] por R$ 42,90. Tem disponível para entrega?"*.
</SYSTEM_MESSAGE>

---
