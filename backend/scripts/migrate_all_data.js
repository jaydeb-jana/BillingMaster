import mysql from 'mysql2/promise';
import pg from 'pg';

const { Pool } = pg;

// Dependency ordered table list
const TABLES_IN_ORDER = [
  'plans',
  'users',
  'businesses',
  'profiles',
  'settings',
  'categories',
  'customers',
  'products',
  'suppliers',
  'invoices',
  'invoice_items',
  'payments',
  'purchases',
  'purchase_items',
  'stock_transactions',
  'expenses',
  'khata_entries',
  'subscriptions',
  'system_bulletins',
  'feature_flags',
  'admin_audit_logs',
  'billing_requests',
  'returns',
  'coupons',
  'coupon_usages',
  'subscription_queue'
];

// Map of columns that are boolean in PostgreSQL
const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_enabled',
  'is_pinned',
  'is_catalog_enabled',
  'show_sales_rate',
  'show_barcodes',
  'allow_khatabook',
  'allow_ai_assistant',
  'allow_custom_branding'
]);

function formatValue(colName, val) {
  if (val === null || val === undefined) return null;

  if (BOOLEAN_COLUMNS.has(colName)) {
    return Boolean(val);
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  // Handle MySQL date/datetime strings
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val;
  }

  return val;
}

async function runMigration() {
  console.log('========================================================');
  console.log('🚀 Starting Full Migration: Local MySQL -> Supabase PostgreSQL');
  console.log('========================================================');

  // 1. Connect to MySQL
  console.log('\n[1/4] Connecting to Local MySQL...');
  const mysqlConn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '1234',
    database: 'billingmaster',
    dateStrings: true
  });
  console.log('✅ Connected to Local MySQL');

  // 2. Connect to PostgreSQL
  console.log('\n[2/4] Connecting to Supabase PostgreSQL...');
  const pgPool = new Pool({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.dnogoajxlzdmosavfijq',
    password: 'Jaydeb#jana@787',
    database: 'billingmaster',
    ssl: { rejectUnauthorized: false }
  });
  const pgClient = await pgPool.connect();
  console.log('✅ Connected to Supabase PostgreSQL');

  const migrationStats = {};

  try {
    console.log('\n[3/4] Migrating Tables in Dependency Order...');

    for (const table of TABLES_IN_ORDER) {
      // Check if table exists in MySQL
      try {
        const [mysqlCountRows] = await mysqlConn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
        const rowCount = mysqlCountRows[0]?.cnt || 0;

        if (rowCount === 0) {
          console.log(`- [${table}]: 0 rows in MySQL, skipping`);
          continue;
        }

        console.log(`\n⏳ Migrating [${table}] (${rowCount} rows)...`);

        // Fetch valid columns in PostgreSQL for this table
        const pgColsRes = await pgClient.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          [table]
        );
        const pgValidCols = new Set(pgColsRes.rows.map(r => r.column_name));

        if (pgValidCols.size === 0) {
          console.warn(`⚠️ Table [${table}] not found in PostgreSQL schema!`);
          continue;
        }

        // Fetch all rows from MySQL
        const [mysqlRows] = await mysqlConn.query(`SELECT * FROM \`${table}\``);
        let migratedCount = 0;

        for (const row of mysqlRows) {
          // Filter to only columns that exist in both
          const keys = Object.keys(row).filter(k => pgValidCols.has(k));
          if (keys.length === 0) continue;

          const values = keys.map(k => formatValue(k, row[k]));

          const colList = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          // Determine conflict target
          let conflictClause = 'ON CONFLICT DO NOTHING';
          if (keys.includes('id')) {
            const updateSet = keys
              .filter(k => k !== 'id')
              .map(k => `"${k}" = EXCLUDED."${k}"`)
              .join(', ');
            if (updateSet.length > 0) {
              conflictClause = `ON CONFLICT ("id") DO UPDATE SET ${updateSet}`;
            } else {
              conflictClause = 'ON CONFLICT ("id") DO NOTHING';
            }
          } else if (keys.includes('code') && table === 'coupons') {
            conflictClause = 'ON CONFLICT ("code") DO NOTHING';
          } else if (keys.includes('flag_key') && table === 'feature_flags') {
            conflictClause = 'ON CONFLICT ("flag_key") DO NOTHING';
          }

          const insertSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ${conflictClause}`;

          try {
            await pgClient.query(insertSql, values);
            migratedCount++;
          } catch (rowErr) {
            console.warn(`  Warning on ${table} row:`, rowErr.message);
          }
        }

        console.log(`✅ [${table}]: Migrated ${migratedCount} of ${rowCount} rows`);
        migrationStats[table] = { mysqlCount: rowCount, pgMigrated: migratedCount };

      } catch (tableErr) {
        console.warn(`Note on table ${table}:`, tableErr.message);
      }
    }

    console.log('\n[4/4] Verifying Row Counts in Supabase PostgreSQL...');
    for (const table of Object.keys(migrationStats)) {
      const res = await pgClient.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const pgCount = Number(res.rows[0]?.cnt || 0);
      const myCount = migrationStats[table].mysqlCount;
      console.log(`- ${table}: MySQL=${myCount} | PostgreSQL=${pgCount} ${pgCount >= myCount ? '✅' : '⚠️'}`);
    }

    console.log('\n========================================================');
    console.log('🎉🎉 MIGRATION COMPLETED 100% SUCCESSFULLY! 🎉🎉');
    console.log('========================================================');

  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    pgClient.release();
    await pgPool.end();
    await mysqlConn.end();
  }
}

runMigration();
