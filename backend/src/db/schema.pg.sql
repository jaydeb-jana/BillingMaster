-- ========================================================
-- BillingMaster PostgreSQL Complete Production Schema
-- Designed for 100% Scalability, Data Integrity & Performance
-- ========================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  turnover VARCHAR(100),
  employees VARCHAR(50),
  catalog_slug VARCHAR(255) UNIQUE,
  catalog_handle VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  suspend_reason TEXT DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  plan_name VARCHAR(100) NOT NULL DEFAULT 'Free',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  role VARCHAR(30) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_profiles_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 4. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(36),
  business_id VARCHAR(36) PRIMARY KEY,
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
  default_due_days INT NOT NULL DEFAULT 30,
  tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  is_catalog_enabled BOOLEAN DEFAULT TRUE,
  show_sales_rate BOOLEAN DEFAULT TRUE,
  show_barcodes BOOLEAN DEFAULT TRUE,
  location_radius_km INT DEFAULT NULL,
  store_lat DECIMAL(10,8) DEFAULT NULL,
  store_lng DECIMAL(11,8) DEFAULT NULL,
  upi_id VARCHAR(255) DEFAULT NULL,
  upi_number VARCHAR(50) DEFAULT NULL,
  bank_name VARCHAR(255) DEFAULT NULL,
  account_holder_name VARCHAR(255) DEFAULT NULL,
  account_number VARCHAR(100) DEFAULT NULL,
  ifsc_code VARCHAR(50) DEFAULT NULL,
  branch_name VARCHAR(255) DEFAULT NULL,
  payment_instructions TEXT DEFAULT NULL,
  CONSTRAINT fk_settings_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT uq_category_business_name UNIQUE (business_id, name)
);

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 7. Products Table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  barcode VARCHAR(100),
  price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  low_stock_threshold DECIMAL(14,3) NOT NULL DEFAULT 5.000,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  description TEXT,
  image_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT uq_product_business_sku UNIQUE (business_id, sku)
);

-- 8. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_suppliers_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 9. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT uq_invoice_business_number UNIQUE (business_id, invoice_number)
);

-- 10. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id VARCHAR(36) PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 11. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  invoice_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  reference VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  CONSTRAINT fk_payments_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 12. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  supplier_id VARCHAR(36),
  reference VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  purchase_date DATE NOT NULL,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 13. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
  id VARCHAR(36) PRIMARY KEY,
  purchase_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  cost DECIMAL(14,2) NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 14. Stock Transactions Table
CREATE TABLE IF NOT EXISTS stock_transactions (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  type VARCHAR(30) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  reference VARCHAR(255),
  created_by VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_transactions_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_transactions_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 15. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_by VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 16. Khata Entries Table
CREATE TABLE IF NOT EXISTS khata_entries (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(50),
  type VARCHAR(20) NOT NULL DEFAULT 'gave',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  date VARCHAR(20) NOT NULL,
  time VARCHAR(20),
  payment_mode VARCHAR(50),
  bill_reference VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_khata_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 17. Plans Table
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_3months DECIMAL(10,2) DEFAULT NULL,
  price_6months DECIMAL(10,2) DEFAULT NULL,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_2years DECIMAL(10,2) DEFAULT NULL,
  price_3years DECIMAL(10,2) DEFAULT NULL,
  max_users INT NOT NULL DEFAULT 1,
  max_invoices_per_month INT NOT NULL DEFAULT 100,
  max_customers INT NOT NULL DEFAULT 1000,
  max_products INT NOT NULL DEFAULT 500,
  allow_khatabook BOOLEAN DEFAULT TRUE,
  allow_ai_assistant BOOLEAN DEFAULT TRUE,
  allow_custom_branding BOOLEAN DEFAULT FALSE,
  display_features TEXT DEFAULT NULL,
  badge_tag VARCHAR(50) DEFAULT NULL,
  priority_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  status VARCHAR(30) DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- 19. System Bulletins Table
CREATE TABLE IF NOT EXISTS system_bulletins (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'announcement',
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
  is_pinned BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key VARCHAR(100) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  category VARCHAR(50) DEFAULT 'general',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100),
  details TEXT,
  performed_by VARCHAR(255) DEFAULT 'System Admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. Billing Requests Table
CREATE TABLE IF NOT EXISTS billing_requests (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  requested_plan VARCHAR(100) NOT NULL,
  price VARCHAR(50) NOT NULL DEFAULT '0',
  utr_ref VARCHAR(255),
  screenshot_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  admin_response TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_billing_requests_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 23. Returns Table
CREATE TABLE IF NOT EXISTS returns (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36),
  invoice_id VARCHAR(36) NOT NULL,
  invoice_number VARCHAR(100),
  invoice_item_id VARCHAR(36),
  product_id VARCHAR(36),
  product_name VARCHAR(255),
  product_unit VARCHAR(50),
  returned_qty DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_method VARCHAR(50),
  refund_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  max_uses INT NOT NULL DEFAULT -1,
  max_uses_per_user INT NOT NULL DEFAULT 1,
  uses_count INT NOT NULL DEFAULT 0,
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. Coupon Usages Table
CREATE TABLE IF NOT EXISTS coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_code VARCHAR(50) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. Subscription Queue Table
CREATE TABLE IF NOT EXISTS subscription_queue (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  priority_order INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 365,
  remaining_days INT NOT NULL DEFAULT 365,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_business ON products (business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers (business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices (business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments (business_id);
CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_entries (customer_id);
CREATE INDEX IF NOT EXISTS idx_khata_business ON khata_entries (business_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_business_prod ON stock_transactions (business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_biz_queue_status ON subscription_queue (business_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_code_user ON coupon_usages (coupon_code, user_id);
