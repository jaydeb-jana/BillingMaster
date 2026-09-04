import { pool } from './db/mysql.js';
import crypto from 'node:crypto';

const TARGET_EMAIL = 'janajaydeb36@gmail.com';
const TARGET_CUSTOMERS = 100005; // > 100,000
const TARGET_PRODUCTS = 50005;   // > 50,000
const TARGET_INVOICES = 2000000; // > 2,000,000

const FIRST_NAMES = ['Rahul', 'Amit', 'Priya', 'Sneha', 'Vikram', 'Ankit', 'Pooja', 'Rohan', 'Neha', 'Sanjay', 'Rajesh', 'Deepak', 'Swati', 'Manish', 'Kavita', 'Arjun', 'Ritu', 'Suresh', 'Ananya', 'Varun'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Das', 'Roy', 'Sen', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Dutta', 'Ghosh', 'Bhowmick', 'Mondal', 'Chowdhury', 'Saha', 'Mitra', 'Pal', 'Basu'];
const CITIES = ['Kolkata', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Patna', 'Indore', 'Nagpur', 'Bhopal'];
const PRODUCT_PREFIXES = ['Organic', 'Premium', 'Fresh', 'Deluxe', 'Essential', 'Classic', 'Royal', 'Super', 'Natural', 'Pure', 'Golden', 'Silver', 'Ultra', 'Smart', 'Pro'];
const PRODUCT_CATEGORIES = ['Rice', 'Oil', 'Wheat Flour', 'Spices', 'Tea Powder', 'Soap', 'Shampoo', 'Detergent', 'Biscuits', 'Snacks', 'Noodles', 'Toothpaste', 'Butter', 'Cheese', 'Milk'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedData() {
  console.log(`=== STARTING BULK DATA SEED FOR ${TARGET_EMAIL} ===`);
  const startTime = Date.now();

  try {
    // 1. Get or create User, Profile, and Business for target email
    const [existingUsers]: any = await pool.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [TARGET_EMAIL.toLowerCase()]);
    let userId: string = '';

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      userId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Jaydeb Jana')",
        [userId, TARGET_EMAIL.toLowerCase()]
      );
      console.log(`Created user account for ${TARGET_EMAIL}`);
    }

    const [existingProfiles]: any = await pool.query('SELECT business_id FROM profiles WHERE id = ? LIMIT 1', [userId]);
    let businessId: string = '';

    if (Array.isArray(existingProfiles) && existingProfiles.length > 0) {
      businessId = existingProfiles[0].business_id;
      console.log(`Found business_id from profile: ${businessId}`);
    }

    if (!businessId) {
      const [existingBizes]: any = await pool.query('SELECT id FROM businesses WHERE LOWER(email) = ? LIMIT 1', [TARGET_EMAIL.toLowerCase()]);
      if (Array.isArray(existingBizes) && existingBizes.length > 0) {
        businessId = existingBizes[0].id;
      } else {
        const [allBizes]: any = await pool.query('SELECT id FROM businesses LIMIT 1');
        if (Array.isArray(allBizes) && allBizes.length > 0) {
          businessId = allBizes[0].id;
        } else {
          businessId = crypto.randomUUID();
          await pool.query(
            "INSERT INTO businesses (id, name, email, catalog_slug, catalog_handle) VALUES (?, 'BillingMaster Demo Store', ?, 'store-demo', 'store-demo')",
            [businessId, TARGET_EMAIL.toLowerCase()]
          );
        }
      }

      await pool.query(
        "INSERT INTO profiles (id, business_id, full_name, role) VALUES (?, ?, 'Jaydeb Jana', 'owner') ON DUPLICATE KEY UPDATE business_id = VALUES(business_id)",
        [userId, businessId]
      );
      console.log(`Linked profile for business_id: ${businessId}`);
    }

    // Disable keys and constraints for high-speed insertion
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');
    await pool.query('SET UNIQUE_CHECKS = 0;');
    await pool.query('SET autocommit = 0;');

    // 2. Populate Customers (> 100,000)
    console.log(`\n[1/3] Inserting ${TARGET_CUSTOMERS.toLocaleString()} Customers...`);
    const customerIds: string[] = [];
    const BATCH_SIZE = 5000;

    let custBatchValues: any[] = [];
    let custBatchSql: string[] = [];

    for (let i = 1; i <= TARGET_CUSTOMERS; i++) {
      const cid = crypto.randomUUID();
      customerIds.push(cid);

      const fName = getRandomItem(FIRST_NAMES);
      const lName = getRandomItem(LAST_NAMES);
      const name = `${fName} ${lName} (${i})`;
      const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
      const email = `customer${i}@example.com`;
      const address = `${Math.floor(10 + Math.random() * 500)}, ${getRandomItem(CITIES)}`;

      custBatchSql.push('(?, ?, ?, ?, ?, ?)');
      custBatchValues.push(cid, businessId, name, phone, email, address);

      if (custBatchSql.length >= BATCH_SIZE || i === TARGET_CUSTOMERS) {
        const sql = `INSERT INTO customers (id, business_id, name, phone, email, address) VALUES ${custBatchSql.join(', ')}`;
        await pool.query(sql, custBatchValues);
        await pool.query('COMMIT;');
        custBatchSql = [];
        custBatchValues = [];
        process.stdout.write(`  Inserted ${i.toLocaleString()} / ${TARGET_CUSTOMERS.toLocaleString()} customers...\r`);
      }
    }
    console.log(`\n✓ ${TARGET_CUSTOMERS.toLocaleString()} Customers inserted successfully.`);

    // 3. Populate Products (> 50,000)
    console.log(`\n[2/3] Inserting ${TARGET_PRODUCTS.toLocaleString()} Products...`);
    const productList: Array<{ id: string; name: string; price: number }> = [];

    let prodBatchValues: any[] = [];
    let prodBatchSql: string[] = [];

    for (let i = 1; i <= TARGET_PRODUCTS; i++) {
      const pid = crypto.randomUUID();
      const prefix = getRandomItem(PRODUCT_PREFIXES);
      const category = getRandomItem(PRODUCT_CATEGORIES);
      const name = `${prefix} ${category} ${i}`;
      const price = Math.floor(20 + Math.random() * 1500);
      const buyingPrice = Math.floor(price * 0.75);
      const stockQty = Math.floor(10 + Math.random() * 500);
      const sku = `AUTOSKU-${i.toString().padStart(8, '0')}`;
      const barcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;

      productList.push({ id: pid, name, price });

      prodBatchSql.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
      prodBatchValues.push(pid, businessId, name, sku, price, buyingPrice, stockQty, 'pcs', barcode);

      if (prodBatchSql.length >= BATCH_SIZE || i === TARGET_PRODUCTS) {
        const sql = `INSERT INTO products (id, business_id, name, sku, price, cost, stock_quantity, unit, barcode) VALUES ${prodBatchSql.join(', ')}`;
        await pool.query(sql, prodBatchValues);
        await pool.query('COMMIT;');
        prodBatchSql = [];
        prodBatchValues = [];
        process.stdout.write(`  Inserted ${i.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} products...\r`);
      }
    }
    console.log(`\n✓ ${TARGET_PRODUCTS.toLocaleString()} Products inserted successfully.`);

    // 4. Populate Invoices (> 2,000,000) & Invoice Items
    console.log(`\n[3/3] Inserting ${TARGET_INVOICES.toLocaleString()} Invoices...`);
    const INVOICE_BATCH = 10000;
    let invBatchSql: string[] = [];
    let invBatchValues: any[] = [];

    let itemBatchSql: string[] = [];
    let itemBatchValues: any[] = [];

    const baseTimestamp = Date.now() - 365 * 24 * 60 * 60 * 1000; // Past 1 year

    for (let i = 1; i <= TARGET_INVOICES; i++) {
      const invId = crypto.randomUUID();
      const custId = customerIds[(i - 1) % customerIds.length];
      const prod = productList[(i - 1) % productList.length];
      const invNum = `INV-${i.toString().padStart(7, '0')}`;
      const qty = Math.floor(1 + Math.random() * 5);
      const totalAmount = prod.price * qty;
      const paymentMode = getRandomItem(PAYMENT_MODES);

      const invTime = new Date(baseTimestamp + (i % 365) * 24 * 60 * 60 * 1000 + (i % 86400) * 1000);
      const dateStr = invTime.toISOString().slice(0, 19).replace('T', ' ');

      invBatchSql.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
      invBatchValues.push(invId, businessId, custId, invNum, totalAmount, 'paid', paymentMode, totalAmount, dateStr);

      const itemId = crypto.randomUUID();
      itemBatchSql.push('(?, ?, ?, ?, ?, ?, ?)');
      itemBatchValues.push(itemId, invId, prod.id, prod.name, qty, prod.price, totalAmount);

      if (invBatchSql.length >= INVOICE_BATCH || i === TARGET_INVOICES) {
        const invSql = `INSERT INTO invoices (id, business_id, customer_id, invoice_number, total_amount, status, payment_method, paid_amount, created_at) VALUES ${invBatchSql.join(', ')}`;
        await pool.query(invSql, invBatchValues);

        const itemSql = `INSERT INTO invoice_items (id, invoice_id, product_id, name, quantity, unit_price, total_price) VALUES ${itemBatchSql.join(', ')}`;
        await pool.query(itemSql, itemBatchValues);

        await pool.query('COMMIT;');
        invBatchSql = [];
        invBatchValues = [];
        itemBatchSql = [];
        itemBatchValues = [];

        if (i % 100000 === 0 || i === TARGET_INVOICES) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`  Progress: ${i.toLocaleString()} / ${TARGET_INVOICES.toLocaleString()} Invoices (${Math.round((i / TARGET_INVOICES) * 100)}%) - Elapsed: ${elapsed}s`);
        }
      }
    }

    // Re-enable keys & foreign key checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
    await pool.query('SET UNIQUE_CHECKS = 1;');
    await pool.query('SET autocommit = 1;');

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n==================================================`);
    console.log(`🎉 BULK DATA POPULATION COMPLETE IN ${totalSeconds} SECONDS!`);
    console.log(`Account: ${TARGET_EMAIL}`);
    console.log(`Business ID: ${businessId}`);
    console.log(`Total Customers: ${TARGET_CUSTOMERS.toLocaleString()}`);
    console.log(`Total Products:  ${TARGET_PRODUCTS.toLocaleString()}`);
    console.log(`Total Invoices:  ${TARGET_INVOICES.toLocaleString()}`);
    console.log(`==================================================\n`);

  } catch (err) {
    console.error('\n❌ Error during bulk data population:', err);
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
      await pool.query('SET UNIQUE_CHECKS = 1;');
      await pool.query('SET autocommit = 1;');
    } catch (e) {}
  }
}

seedData();
