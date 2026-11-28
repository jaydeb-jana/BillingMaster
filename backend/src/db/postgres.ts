import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse and normalize database connection parameters
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  let host = process.env.DB_HOST || process.env.PGHOST || process.env.MYSQL_HOST || 'aws-1-ap-northeast-1.pooler.supabase.com';
  let port = Number(process.env.DB_PORT || process.env.PGPORT || process.env.MYSQL_PORT) || 5432;
  let user = process.env.DB_USER || process.env.PGUSER || process.env.MYSQL_USER || 'postgres.dnogoajxlzdmosavfijq';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.MYSQL_PASSWORD || 'Jaydeb#jana@787';
  const database = process.env.DB_NAME || process.env.PGDATABASE || process.env.MYSQL_DATABASE || 'billingmaster';

  // Automatically map direct Supabase host to IPv4-compatible pooler if necessary
  if (host.includes('dnogoajxlzdmosavfijq.supabase.co')) {
    host = 'aws-1-ap-northeast-1.pooler.supabase.com';
    if (!user.includes('.')) {
      user = 'postgres.dnogoajxlzdmosavfijq';
    }
  }

  return {
    host,
    port,
    user,
    password,
    database,
    max: 20, // Scalable connection pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  };
}

export const rawPgPool = new Pool(getDbConfig());

rawPgPool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export function translateQuery(sql: string, values: any[] = []): { sql: string; values: any[]; isNoOp?: boolean } {
  let transformed = sql;

  // 1. Handle MySQL SET FOREIGN_KEY_CHECKS
  if (/SET\s+FOREIGN_KEY_CHECKS/i.test(transformed)) {
    return { sql: '', values: [], isNoOp: true };
  }

  // 2. Handle SHOW COLUMNS FROM <table>
  const showColsMatch = transformed.match(/SHOW\s+COLUMNS\s+FROM\s+[`"']?(\w+)[`"']?/i);
  if (showColsMatch) {
    const tableName = showColsMatch[1];
    transformed = `SELECT column_name AS "Field" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}'`;
  }

  // 3. Handle MySQL ON DUPLICATE KEY UPDATE -> PostgreSQL ON CONFLICT (id) DO UPDATE SET
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(transformed)) {
    transformed = transformed.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE/i, 'ON CONFLICT (id) DO UPDATE SET');
    transformed = transformed.replace(/VALUES\s*\(\s*[`"']?(\w+)[`"']?\s*\)/gi, 'EXCLUDED."$1"');
  }

  // 4. Convert MySQL backticks to double quotes
  transformed = transformed.replace(/`([^`]+)`/g, '"$1"');

  // 5. Convert '?' placeholders to PostgreSQL '$1, $2, ...'
  let paramIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let finalSql = '';

  for (let i = 0; i < transformed.length; i++) {
    const char = transformed[i];
    const prevChar = i > 0 ? transformed[i - 1] : '';

    if (char === "'" && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
      finalSql += char;
    } else if (char === '"' && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      finalSql += char;
    } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      finalSql += `$${paramIndex++}`;
    } else {
      finalSql += char;
    }
  }

  return { sql: finalSql, values };
}

export interface DbConnection {
  query: (sql: string, values?: any[]) => Promise<any>;
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
}

// Unified Pool wrapper compatible with both MySQL2 [rows, fields] format and modern async/await
export const pool = {
  async query(sql: string, values: any[] = []): Promise<any> {
    const { sql: finalSql, values: finalValues, isNoOp } = translateQuery(sql, values);
    if (isNoOp) {
      const emptyResult: any = [[], []];
      emptyResult.rows = [];
      emptyResult.rowCount = 0;
      return emptyResult;
    }

    const res = await rawPgPool.query(finalSql, finalValues);
    const rows = res.rows;
    const result: any = [rows, res.fields];
    result.rows = rows;
    result.rowCount = res.rowCount;
    return result;
  },

  async getConnection(): Promise<DbConnection> {
    const client = await rawPgPool.connect();

    return {
      async query(sql: string, values: any[] = []): Promise<any> {
        const { sql: finalSql, values: finalValues, isNoOp } = translateQuery(sql, values);
        if (isNoOp) {
          const emptyResult: any = [[], []];
          emptyResult.rows = [];
          emptyResult.rowCount = 0;
          return emptyResult;
        }

        const res = await client.query(finalSql, finalValues);
        const rows = res.rows;
        const result: any = [rows, res.fields];
        result.rows = rows;
        result.rowCount = res.rowCount;
        return result;
      },

      async beginTransaction(): Promise<void> {
        await client.query('BEGIN');
      },

      async commit(): Promise<void> {
        await client.query('COMMIT');
      },

      async rollback(): Promise<void> {
        await client.query('ROLLBACK');
      },

      release(): void {
        client.release();
      },
    };
  },

  async end(): Promise<void> {
    await rawPgPool.end();
  },
};

const DEFAULT_SEED_PLANS = [
  {
    id: 'plan-free',
    name: 'Free Tier',
    code: 'FREE',
    price_monthly: 0,
    price_3months: 0,
    price_6months: 0,
    price_yearly: 0,
    price_2years: 0,
    price_3years: 0,
    max_users: 1,
    max_invoices_per_month: 50,
    max_customers: 200,
    max_products: 100,
    allow_khatabook: true,
    allow_ai_assistant: false,
    allow_custom_branding: false,
    display_features: 'Standard GST & Non-GST Invoicing\nSingle User Access\nBasic KhataBook Credit Ledger',
    badge_tag: '',
    priority_order: 0,
    is_active: true,
  },
  {
    id: 'plan-starter',
    name: 'Starter Business',
    code: 'STARTER',
    price_monthly: 499,
    price_3months: 1422,
    price_6months: 2495,
    price_yearly: 4990,
    price_2years: 8982,
    price_3years: 12475,
    max_users: 3,
    max_invoices_per_month: 500,
    max_customers: 2000,
    max_products: 1000,
    allow_khatabook: true,
    allow_ai_assistant: true,
    allow_custom_branding: false,
    display_features: 'Unlimited Invoice & Receipt Creation\nMulti-User Employee Access\nAI Barcode Scanner & Assistant\nKhataBook & Customer Ledger Sync',
    badge_tag: 'Standard',
    priority_order: 1,
    is_active: true,
  },
  {
    id: 'plan-pro',
    name: 'Pro Enterprise',
    code: 'PRO',
    price_monthly: 1499,
    price_3months: 4272,
    price_6months: 7495,
    price_yearly: 14990,
    price_2years: 26982,
    price_3years: 37475,
    max_users: 10,
    max_invoices_per_month: 5000,
    max_customers: 20000,
    max_products: 10000,
    allow_khatabook: true,
    allow_ai_assistant: true,
    allow_custom_branding: true,
    display_features: 'Unlimited Everything (Invoices, Customers, Products)\nCustom Logo Branding on Invoices\nPriority Phone & WhatsApp Support\nFull KhataBook & AI Automation',
    badge_tag: 'Most Popular',
    priority_order: 2,
    is_active: true,
  },
];

export async function initDb(): Promise<boolean> {
  try {
    const client = await rawPgPool.connect();
    console.log('[PostgreSQL] Connected successfully to database');

    // Run schema execution if tables are missing
    const schemaPath = path.resolve(import.meta.dirname, 'schema.pg.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(sql);
      console.log('[PostgreSQL] Database schema tables verified');
    }

    // Seed default plans if none exist
    try {
      const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM plans');
      if (Number(rows[0]?.cnt || 0) === 0) {
        console.log('[PostgreSQL] Seeding default subscription plans...');
        for (const p of DEFAULT_SEED_PLANS) {
          await client.query(
            `INSERT INTO plans (
              id, name, code, price_monthly, price_3months, price_6months, price_yearly, price_2years, price_3years,
              max_users, max_invoices_per_month, max_customers, max_products, allow_khatabook, allow_ai_assistant,
              allow_custom_branding, display_features, badge_tag, priority_order, is_active
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) ON CONFLICT (id) DO NOTHING`,
            [
              p.id, p.name, p.code, p.price_monthly, p.price_3months, p.price_6months, p.price_yearly,
              p.price_2years, p.price_3years, p.max_users, p.max_invoices_per_month, p.max_customers,
              p.max_products, p.allow_khatabook, p.allow_ai_assistant, p.allow_custom_branding,
              p.display_features, p.badge_tag, p.priority_order, p.is_active,
            ]
          );
        }
        console.log('[PostgreSQL] Default plans seeded successfully');
      }
    } catch (e: any) {
      console.warn('[PostgreSQL] Note on plan seeding:', e.message);
    }

    client.release();
    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL] Database connection/init note:', err.message || err);
    return false;
  }
}
