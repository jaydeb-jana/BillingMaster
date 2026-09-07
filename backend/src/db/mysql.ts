import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'billingmaster',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

export async function initDb(): Promise<boolean> {
  try {
    // Attempt connection
    const connection = await pool.getConnection();
    console.log('[MySQL] Connected successfully to database');

    const schemaPath = path.resolve(import.meta.dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await connection.query(statement);
      }

      // Ensure optional columns exist on tables
      try {
        await connection.query(`ALTER TABLE products ADD COLUMN description TEXT;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE products ADD COLUMN image_url LONGTEXT;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE products ADD COLUMN notes LONGTEXT;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE products MODIFY COLUMN notes LONGTEXT;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE products ADD COLUMN barcode VARCHAR(100);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE products MODIFY COLUMN image_url LONGTEXT;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE invoices ADD COLUMN payment_method VARCHAR(50);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(14,2) DEFAULT 0.00;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE invoices ADD COLUMN balance DECIMAL(14,2) DEFAULT 0.00;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE invoices ADD COLUMN paid_at DATETIME;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN turnover VARCHAR(100);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN employees VARCHAR(50);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN catalog_slug VARCHAR(255);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN catalog_handle VARCHAR(255);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN suspend_reason TEXT DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN logo_url LONGTEXT DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE businesses ADD COLUMN plan_name VARCHAR(100) NOT NULL DEFAULT 'Free';`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN max_customers INT NOT NULL DEFAULT 1000;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN max_products INT NOT NULL DEFAULT 500;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN display_features TEXT DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN badge_tag VARCHAR(50) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN priority_order INT NOT NULL DEFAULT 0;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN price_3months DECIMAL(10,2) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN price_6months DECIMAL(10,2) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN price_2years DECIMAL(10,2) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE plans ADD COLUMN price_3years DECIMAL(10,2) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS coupons (
            id VARCHAR(36) PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
            discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            max_uses INT NOT NULL DEFAULT -1,
            max_uses_per_user INT NOT NULL DEFAULT 1,
            uses_count INT NOT NULL DEFAULT 0,
            valid_until DATETIME DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
        `);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE coupons ADD COLUMN max_uses_per_user INT NOT NULL DEFAULT 1;`);
      } catch (e) {}

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS subscription_queue (
            id VARCHAR(36) PRIMARY KEY,
            business_id VARCHAR(36) NOT NULL,
            plan_name VARCHAR(100) NOT NULL,
            priority_order INT NOT NULL DEFAULT 0,
            duration_days INT NOT NULL DEFAULT 365,
            remaining_days INT NOT NULL DEFAULT 365,
            status VARCHAR(30) NOT NULL DEFAULT 'queued',
            start_date DATETIME DEFAULT NULL,
            expires_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_biz_status (business_id, status)
          );
        `);
      } catch (e) {}

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS coupon_usages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            coupon_code VARCHAR(50) NOT NULL,
            user_id VARCHAR(100) NOT NULL,
            used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_code_user (coupon_code, user_id)
          );
        `);
      } catch (e) {}
      try {
        await connection.query(`DELETE FROM billing_requests WHERE id = 'REQ-2026-1001';`);
        await connection.query(`UPDATE billing_requests SET utr_ref = '' WHERE utr_ref LIKE 'UTR-%';`);
      } catch (e) {}


      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN id VARCHAR(36);`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN is_catalog_enabled BOOLEAN DEFAULT TRUE;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN show_sales_rate BOOLEAN DEFAULT TRUE;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN show_barcodes BOOLEAN DEFAULT TRUE;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN location_radius_km INT DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN store_lat DECIMAL(10,8) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN store_lng DECIMAL(11,8) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN upi_id VARCHAR(255) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN upi_number VARCHAR(50) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN bank_name VARCHAR(255) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN account_holder_name VARCHAR(255) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN account_number VARCHAR(100) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN ifsc_code VARCHAR(50) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN branch_name VARCHAR(255) DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE settings ADD COLUMN payment_instructions TEXT DEFAULT NULL;`);
      } catch (e) {}
      try {
        await connection.query(`
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
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (e) {}

      try {
        await connection.query(`
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
        `);
      } catch (e) {}


      // Backfill missing/duplicate catalog_slug / catalog_handle for existing businesses
      try {
        const [allBizes]: any = await connection.query(
          "SELECT b.id, b.name, b.email, b.catalog_slug, b.catalog_handle, p.full_name FROM businesses b LEFT JOIN profiles p ON p.business_id = b.id"
        );
        if (Array.isArray(allBizes) && allBizes.length > 0) {
          const usedSlugs = new Set<string>();
          for (const biz of allBizes) {
            let handle = String(biz.catalog_slug || biz.catalog_handle || '').trim().toLowerCase();
            const baseStr = (biz.name || biz.full_name || (biz.email ? biz.email.split('@')[0] : '') || 'store').toLowerCase();
            let clean = baseStr.replace(/[^a-z0-9_-]/g, '').trim();
            if (clean.length < 3) {
              const shortId = String(biz.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase();
              clean = `store-${shortId}`;
            }

            if (!handle || handle.length < 3 || usedSlugs.has(handle)) {
              let candidate = handle && handle.length >= 3 ? handle : clean;
              let counter = 1;
              while (usedSlugs.has(candidate)) {
                candidate = `${clean}-${counter++}`;
              }
              handle = candidate;
              await connection.query(
                "UPDATE businesses SET catalog_slug = ?, catalog_handle = ? WHERE id = ?",
                [handle, handle, biz.id]
              );
            }
            usedSlugs.add(handle);
          }
        }
      } catch (e) {}

      // Add unique indexes for catalog_slug and catalog_handle
      try {
        await connection.query("ALTER TABLE businesses ADD UNIQUE INDEX idx_businesses_catalog_slug (catalog_slug);");
      } catch (e) {}
      try {
        await connection.query("ALTER TABLE businesses ADD UNIQUE INDEX idx_businesses_catalog_handle (catalog_handle);");
      } catch (e) {}

      // Backfill missing/empty SKUs in products table to resolve UNIQUE constraint conflicts
      try {
        const [emptySkuProducts]: any = await connection.query(
          "SELECT id FROM products WHERE sku IS NULL OR TRIM(sku) = '' OR sku = '0'"
        );
        if (Array.isArray(emptySkuProducts) && emptySkuProducts.length > 0) {
          for (const p of emptySkuProducts) {
            const cleanId = String(p.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
            const autoSku = `AUTOSKU-${cleanId.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await connection.query("UPDATE products SET sku = ? WHERE id = ?", [autoSku, p.id]);
          }
        }
      } catch (e) {}

      console.log('[MySQL] Database tables initialized/verified');
    }
    connection.release();
    return true;
  } catch (err: any) {
    console.warn('[MySQL] Database connection/init note:', err.message || err);
    return false;
  }
}
