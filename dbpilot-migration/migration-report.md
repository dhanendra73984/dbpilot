# DBPilot Migration Report

## Overview

- Source: MySQL
- Target: PostgreSQL
- Tables: 3
- Columns: 36
- Circular dependencies detected: No

## Table Creation Order

1. `customers`
2. `orders`
3. `order_items`

## Column Conversions

| Column | MySQL Type | PostgreSQL Type | Nullable |
|---|---|---|---|
| `customers.id` | `bigint unsigned` | `BIGINT` | No |
| `customers.customer_code` | `varchar(30)` | `VARCHAR` | No |
| `customers.full_name` | `varchar(150)` | `VARCHAR` | No |
| `customers.email` | `varchar(255)` | `VARCHAR` | No |
| `customers.phone` | `varchar(20)` | `VARCHAR` | Yes |
| `customers.age` | `tinyint unsigned` | `SMALLINT` | Yes |
| `customers.credit_limit` | `decimal(12,2)` | `NUMERIC` | No |
| `customers.account_status` | `enum('ACTIVE','INACTIVE','SUSPENDED')` | `TEXT` | No |
| `customers.preferences` | `json` | `JSONB` | Yes |
| `customers.is_verified` | `tinyint(1)` | `SMALLINT` | No |
| `customers.created_at` | `timestamp` | `TIMESTAMP` | No |
| `customers.updated_at` | `timestamp` | `TIMESTAMP` | No |
| `order_items.id` | `bigint unsigned` | `BIGINT` | No |
| `order_items.order_id` | `bigint unsigned` | `BIGINT` | No |
| `order_items.product_code` | `varchar(40)` | `VARCHAR` | No |
| `order_items.product_name` | `varchar(200)` | `VARCHAR` | No |
| `order_items.quantity` | `smallint unsigned` | `SMALLINT` | No |
| `order_items.unit_price` | `decimal(12,2)` | `NUMERIC` | No |
| `order_items.discount_percent` | `decimal(5,2)` | `NUMERIC` | No |
| `order_items.line_total` | `decimal(14,2)` | `NUMERIC` | No |
| `order_items.item_status` | `enum('NEW','PACKED','SHIPPED','RETURNED')` | `TEXT` | No |
| `order_items.metadata` | `json` | `JSONB` | Yes |
| `order_items.created_at` | `datetime` | `TIMESTAMP` | No |
| `orders.id` | `bigint unsigned` | `BIGINT` | No |
| `orders.order_number` | `varchar(40)` | `VARCHAR` | No |
| `orders.customer_id` | `bigint unsigned` | `BIGINT` | No |
| `orders.order_status` | `enum('PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED')` | `TEXT` | No |
| `orders.subtotal` | `decimal(12,2)` | `NUMERIC` | No |
| `orders.discount_amount` | `decimal(10,2)` | `NUMERIC` | No |
| `orders.tax_amount` | `decimal(10,2)` | `NUMERIC` | No |
| `orders.total_amount` | `decimal(14,2)` | `NUMERIC` | No |
| `orders.shipping_address` | `json` | `JSONB` | Yes |
| `orders.payment_method` | `varchar(30)` | `VARCHAR` | Yes |
| `orders.placed_at` | `datetime` | `TIMESTAMP` | No |
| `orders.delivered_at` | `datetime` | `TIMESTAMP` | Yes |
| `orders.created_at` | `timestamp` | `TIMESTAMP` | No |

## Migration Phases

### Phase 1: Create tables

- Prepare and create table: customers
- Prepare and create table: orders
- Prepare and create table: order_items

### Phase 2: Primary keys and unique constraints

- Create primary key on customers (id)
- Create primary key on order_items (id)
- Create primary key on orders (id)
- Create unique constraint customer_code on customers (customer_code)
- Create unique constraint email on customers (email)
- Create unique constraint uq_order_product on order_items (order_id, product_code)
- Create unique constraint order_number on orders (order_number)

### Phase 3: Foreign keys

- Add fk_items_order on order_items.order_id referencing orders.id
- Add fk_orders_customer on orders.customer_id referencing customers.id

### Phase 4: Indexes

- Create unique index customer_code on customers (customer_code)
- Create unique index email on customers (email)
- Create index idx_customer_created on customers (created_at)
- Create index idx_customer_status on customers (account_status)
- Create index idx_items_product on order_items (product_code)
- Create index idx_items_status on order_items (item_status)
- Create unique index uq_order_product on order_items (order_id, product_code)
- Create index idx_orders_customer on orders (customer_id)
- Create index idx_orders_status_date on orders (order_status, placed_at)
- Create index idx_orders_total on orders (total_amount)
- Create unique index order_number on orders (order_number)

### Phase 5: Manual review

- customers.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- customers.account_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- customers.is_verified: Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL.
- order_items.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- order_items.item_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- orders.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- orders.order_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- Verify referenced tables and columns exist, and confirm compatible data types before applying foreign-key constraints.

## Warnings

- customers: id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- customers: account_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- customers: is_verified: Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL.
- order_items: id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- order_items: item_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- order_items: Foreign key fk_items_order uses ON UPDATE CASCADE. Verify PostgreSQL behavior.
- orders: id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- orders: order_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- orders: Foreign key fk_orders_customer uses ON UPDATE CASCADE. Verify PostgreSQL behavior.
- customers.id: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.
- customers.id: AUTO_INCREMENT was detected on a non-standard identity type. Review the generated definition.
- customers.account_status: MySQL ENUM is mapped to TEXT. Add validation or a PostgreSQL ENUM if required.
- customers.is_verified: TINYINT maps to SMALLINT. Review whether this column should be BOOLEAN.
- orders.id: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.
- orders.id: AUTO_INCREMENT was detected on a non-standard identity type. Review the generated definition.
- orders.customer_id: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.
- orders.order_status: MySQL ENUM is mapped to TEXT. Add validation or a PostgreSQL ENUM if required.
- order_items.id: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.
- order_items.id: AUTO_INCREMENT was detected on a non-standard identity type. Review the generated definition.
- order_items.order_id: BIGINT UNSIGNED can exceed PostgreSQL BIGINT range; using NUMERIC(20,0). Verify the source values.
- order_items.item_status: MySQL ENUM is mapped to TEXT. Add validation or a PostgreSQL ENUM if required.
- Manual review: customers.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- Manual review: customers.account_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- Manual review: customers.is_verified: Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL.
- Manual review: order_items.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- Manual review: order_items.item_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- Manual review: orders.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- Manual review: orders.order_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- Manual review: Verify referenced tables and columns exist, and confirm compatible data types before applying foreign-key constraints.

## Manual Review Actions

- customers.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- customers.account_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- customers.is_verified: Verify whether TINYINT is being used as a boolean before mapping to PostgreSQL.
- order_items.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- order_items.item_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- orders.id: AUTO_INCREMENT requires PostgreSQL identity/sequence handling.
- orders.order_status: ENUM requires special PostgreSQL handling. Consider a CHECK constraint or PostgreSQL ENUM type.
- Verify referenced tables and columns exist, and confirm compatible data types before applying foreign-key constraints.

## Important

This report and the generated SQL are migration artifacts only.
Review the SQL and warnings, test against a disposable PostgreSQL
database, and verify data and constraints before any production use.
No SQL was executed by this export operation.
