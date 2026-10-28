-- DBPilot: MySQL to PostgreSQL migration
-- Generated SQL only. Review warnings before execution.

BEGIN;

CREATE TABLE "customers" (
  "id" NUMERIC(20,0) NOT NULL,
  "customer_code" VARCHAR(30) NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(20),
  "age" SMALLINT,
  "credit_limit" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  "account_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "preferences" JSONB,
  "is_verified" SMALLINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" NUMERIC(20,0) NOT NULL,
  "order_number" VARCHAR(40) NOT NULL,
  "customer_id" NUMERIC(20,0) NOT NULL,
  "order_status" TEXT NOT NULL DEFAULT 'PENDING',
  "subtotal" NUMERIC(12, 2) NOT NULL,
  "discount_amount" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "tax_amount" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "total_amount" NUMERIC(14, 2) NOT NULL,
  "shipping_address" JSONB,
  "payment_method" VARCHAR(30),
  "placed_at" TIMESTAMP NOT NULL,
  "delivered_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" NUMERIC(20,0) NOT NULL,
  "order_id" NUMERIC(20,0) NOT NULL,
  "product_code" VARCHAR(40) NOT NULL,
  "product_name" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" NUMERIC(12, 2) NOT NULL,
  "discount_percent" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  "line_total" NUMERIC(14, 2) NOT NULL,
  "item_status" TEXT NOT NULL DEFAULT 'NEW',
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

ALTER TABLE "customers" ADD CONSTRAINT "customer_code" UNIQUE ("customer_code");

ALTER TABLE "customers" ADD CONSTRAINT "email" UNIQUE ("email");

ALTER TABLE "order_items" ADD CONSTRAINT "uq_order_product" UNIQUE ("order_id", "product_code");

ALTER TABLE "orders" ADD CONSTRAINT "order_number" UNIQUE ("order_number");

ALTER TABLE "order_items"
  ADD CONSTRAINT "fk_items_order"
  FOREIGN KEY ("order_id")
  REFERENCES "orders" ("id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE "orders"
  ADD CONSTRAINT "fk_orders_customer"
  FOREIGN KEY ("customer_id")
  REFERENCES "customers" ("id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

CREATE INDEX "idx_customer_created" ON "customers" ("created_at");

CREATE INDEX "idx_customer_status" ON "customers" ("account_status");

CREATE INDEX "idx_items_product" ON "order_items" ("product_code");

CREATE INDEX "idx_items_status" ON "order_items" ("item_status");

CREATE INDEX "idx_orders_customer" ON "orders" ("customer_id");

CREATE INDEX "idx_orders_status_date" ON "orders" ("order_status", "placed_at");

CREATE INDEX "idx_orders_total" ON "orders" ("total_amount");

COMMIT;

-- Review all warnings and test this script against a disposable
-- PostgreSQL database before using it in production.
