SET NAMES utf8mb4;
SET TIME_ZONE = '+00:00';

CREATE SCHEMA IF NOT EXISTS soil
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE soil;

CREATE TABLE IF NOT EXISTS company (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cnpj        CHAR(14)     NOT NULL,
  trade_name  VARCHAR(150) NOT NULL,
  status      ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_company_cnpj (cnpj ASC) VISIBLE,
  CONSTRAINT chk_company_cnpj_digits CHECK (cnpj REGEXP '^[0-9]{14}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user` (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id        INT UNSIGNED NOT NULL,
  cnpj              CHAR(14)     NOT NULL,
  name              VARCHAR(150) NOT NULL,
  login             VARCHAR(60)  NOT NULL,
  email             VARCHAR(255) NOT NULL,
  phone             VARCHAR(20)  NOT NULL,
  role              ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  status            ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  email_verified_at TIMESTAMP    NULL DEFAULT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_user_email (email ASC) VISIBLE,
  UNIQUE INDEX uq_user_login (login ASC) VISIBLE,
  INDEX idx_user_company (company_id ASC) VISIBLE,
  CONSTRAINT fk_user_company
    FOREIGN KEY (company_id) REFERENCES company (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `password` (
  user_id       INT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_password_user
    FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS vehicle (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  manufacturer      VARCHAR(80)       NOT NULL,
  model             VARCHAR(120)      NOT NULL,
  version           VARCHAR(120)      NULL DEFAULT NULL,
  type              VARCHAR(40)       NOT NULL,
  manuf_year_start  SMALLINT UNSIGNED NOT NULL,
  manuf_year_end    SMALLINT UNSIGNED NOT NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_vehicle_years CHECK (
    manuf_year_start >= 1900 AND manuf_year_end <= 2100 AND manuf_year_start <= manuf_year_end
  ),
  INDEX idx_vehicle_lookup (manufacturer ASC, model ASC, type ASC, manuf_year_start ASC, manuf_year_end ASC) VISIBLE,
  FULLTEXT INDEX idx_ft_vehicle (manufacturer, model, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catalog (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  category      ENUM('OLEO', 'FILTRO') NOT NULL,
  type          ENUM('MOTOR', 'FREIO', 'CAMBIO', 'OLEO', 'COMBUSTIVEL', 'AR') NOT NULL,
  specification VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_catalog_category_type CHECK (
    (category = 'OLEO'   AND type IN ('MOTOR', 'FREIO', 'CAMBIO')) OR
    (category = 'FILTRO' AND type IN ('OLEO', 'COMBUSTIVEL', 'AR'))
  ),
  INDEX idx_catalog_cat_type (category ASC, type ASC) VISIBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS technical_specification (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id      INT UNSIGNED NOT NULL,
  catalog_id      INT UNSIGNED NOT NULL,
  capacity_liters DECIMAL(4,2) NULL DEFAULT NULL,
  interval_km     INT UNSIGNED NULL DEFAULT NULL,
  notes           VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_tech_spec_vehicle_catalog (vehicle_id ASC, catalog_id ASC) VISIBLE,
  INDEX idx_tech_spec_catalog (catalog_id ASC, vehicle_id ASC) VISIBLE,
  CONSTRAINT fk_tech_spec_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicle (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tech_spec_catalog
    FOREIGN KEY (catalog_id) REFERENCES catalog (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS product (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  company_id      INT UNSIGNED  NOT NULL,
  user_id         INT UNSIGNED  NOT NULL,
  catalog_id      INT UNSIGNED  NOT NULL,
  name            VARCHAR(150)  NOT NULL,
  manufacturer    VARCHAR(80)   NOT NULL,
  sku             VARCHAR(60)   NULL DEFAULT NULL,
  price_cents     INT UNSIGNED  NOT NULL,
  is_best_quality BOOLEAN       NOT NULL DEFAULT FALSE,
  is_available    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_product_price_cents CHECK (price_cents > 0),
  INDEX idx_product_company_catalog_price (company_id ASC, catalog_id ASC, is_available ASC, price_cents ASC) VISIBLE,
  CONSTRAINT fk_product_company
    FOREIGN KEY (company_id) REFERENCES company (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_product_user
    FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_product_catalog
    FOREIGN KEY (catalog_id) REFERENCES catalog (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `client` (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(150) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX uq_client_company_email (company_id ASC, email ASC) VISIBLE,
  UNIQUE INDEX uq_client_company_phone (company_id ASC, phone ASC) VISIBLE,
  CONSTRAINT fk_client_company
    FOREIGN KEY (company_id) REFERENCES company (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quote (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  client_id     INT UNSIGNED NULL DEFAULT NULL,
  vehicle_id    INT UNSIGNED NOT NULL,
  profile       ENUM('CHEAPEST', 'MOST_EXPENSIVE', 'BEST_QUALITY', 'CUSTOM') NOT NULL DEFAULT 'CHEAPEST',
  total_cents   INT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('DRAFT', 'SENT') NOT NULL DEFAULT 'DRAFT',
  sent_at       TIMESTAMP    NULL DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_quote_company_created (company_id ASC, created_at DESC) VISIBLE,
  CONSTRAINT fk_quote_company FOREIGN KEY (company_id) REFERENCES company (id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_user    FOREIGN KEY (user_id)    REFERENCES `user` (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_quote_client  FOREIGN KEY (client_id)  REFERENCES `client` (id) ON DELETE SET NULL,
  CONSTRAINT fk_quote_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS quote_item (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quote_id         INT UNSIGNED NOT NULL,
  product_id       INT UNSIGNED NOT NULL,
  quantity         DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  unit_price_cents INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_quote_item_quote (quote_id ASC) VISIBLE,
  CONSTRAINT chk_quote_item_qty   CHECK (quantity > 0),
  CONSTRAINT chk_quote_item_price CHECK (unit_price_cents > 0),
  CONSTRAINT fk_quote_item_quote   FOREIGN KEY (quote_id)   REFERENCES quote (id)   ON DELETE CASCADE,
  CONSTRAINT fk_quote_item_product FOREIGN KEY (product_id) REFERENCES product (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
