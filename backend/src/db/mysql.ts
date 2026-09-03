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
        await connection.query(`ALTER TABLE products MODIFY COLUMN notes LONGTEXT;`);
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
        await connection.query(`ALTER TABLE settings ADD COLUMN id VARCHAR(36);`);
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

      console.log('[MySQL] Database tables initialized/verified');
    }
    connection.release();
    return true;
  } catch (err: any) {
    console.warn('[MySQL] Database connection/init note:', err.message || err);
    return false;
  }
}
