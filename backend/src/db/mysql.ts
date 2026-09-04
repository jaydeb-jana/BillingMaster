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
        await connection.query(`ALTER TABLE settings ADD COLUMN id VARCHAR(36);`);
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
