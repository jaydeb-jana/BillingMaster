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
  logo_url LONGTEXT DEFAULT NULL,
  plan_name VARCHAR(100) NOT NULL DEFAULT 'Free',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  role ENUM('owner', 'admin', 'staff') NOT NULL DEFAULT 'owner',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(36),
  business_id VARCHAR(36) PRIMARY KEY,
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
  default_due_days INT NOT NULL DEFAULT 30,
  tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
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
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE KEY category_business_name (business_id, name)
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  low_stock_threshold DECIMAL(14,3) NOT NULL DEFAULT 5.000,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  description TEXT,
  image_url LONGTEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE KEY product_business_sku (business_id, sku)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  status ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  paid_at DATETIME,
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  UNIQUE KEY invoice_business_number (business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id VARCHAR(36) PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  invoice_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method ENUM('cash', 'card', 'bank_transfer', 'mobile_money', 'other') NOT NULL,
  reference VARCHAR(255),
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  supplier_id VARCHAR(36),
  reference VARCHAR(100),
  status ENUM('draft', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  purchase_date DATE NOT NULL,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id VARCHAR(36) PRIMARY KEY,
  purchase_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  cost DECIMAL(14,2) NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  type ENUM('opening', 'purchase', 'sale', 'adjustment', 'return', 'cancelled_sale') NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  reference VARCHAR(255),
  created_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS khata_entries (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(50),
  type ENUM('gave', 'got') NOT NULL DEFAULT 'gave',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  date VARCHAR(20) NOT NULL,
  time VARCHAR(20),
  payment_mode VARCHAR(50),
  bill_reference VARCHAR(100),
  note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  max_users INT NOT NULL DEFAULT 1,
  max_invoices_per_month INT NOT NULL DEFAULT 100,
  max_customers INT NOT NULL DEFAULT 1000,
  max_products INT NOT NULL DEFAULT 500,
  allow_khatabook TINYINT(1) DEFAULT 1,
  allow_ai_assistant TINYINT(1) DEFAULT 1,
  allow_custom_branding TINYINT(1) DEFAULT 0,
  display_features TEXT DEFAULT NULL,
  badge_tag VARCHAR(50) DEFAULT NULL,
  priority_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) NOT NULL,
  billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
  status ENUM('active', 'past_due', 'canceled', 'trial') DEFAULT 'active',
  start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS system_bulletins (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category ENUM('secret_insight', 'announcement', 'update', 'maintenance', 'alert') NOT NULL DEFAULT 'announcement',
  target_audience ENUM('all', 'pro_only', 'enterprise_only', 'admins') NOT NULL DEFAULT 'all',
  is_pinned TINYINT(1) DEFAULT 0,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key VARCHAR(100) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  category VARCHAR(50) DEFAULT 'general',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100),
  details TEXT,
  performed_by VARCHAR(255) DEFAULT 'System Admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_requests (
  id VARCHAR(36) PRIMARY KEY,
  business_id VARCHAR(36) NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  requested_plan VARCHAR(100) NOT NULL,
  price VARCHAR(50) NOT NULL DEFAULT '0',
  utr_ref VARCHAR(255),
  screenshot_url LONGTEXT,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  admin_response TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);


