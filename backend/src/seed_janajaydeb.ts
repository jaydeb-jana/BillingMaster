import { pool } from './db/mysql.js';
import crypto from 'node:crypto';

const TARGET_EMAIL = 'janajaydeb36@gmail.com';

const FIRST_NAMES = [
  'Rahul', 'Amit', 'Priya', 'Sneha', 'Vikram', 'Ankit', 'Pooja', 'Rohan', 'Neha', 'Sanjay',
  'Rajesh', 'Deepak', 'Swati', 'Manish', 'Kavita', 'Arjun', 'Ritu', 'Suresh', 'Ananya', 'Varun',
  'Debasish', 'Sourav', 'Subhash', 'Tanmoy', 'Subhajit', 'Shampa', 'Kakali', 'Bishal', 'Avijit', 'Payel'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Das', 'Roy', 'Sen', 'Banerjee', 'Chatterjee',
  'Mukherjee', 'Dutta', 'Ghosh', 'Bhowmick', 'Mondal', 'Chowdhury', 'Saha', 'Mitra', 'Pal', 'Basu',
  'Jana', 'Pradhan', 'Nandy', 'Bhattacharya', 'Koley', 'Kundu', 'De', 'Samanta', 'Kar', 'Bag'
];

const CITIES = [
  'Kolkata, WB', 'Howrah, WB', 'Siliguri, WB', 'Durgapur, WB', 'Asansol, WB',
  'Kharagpur, WB', 'Burdwan, WB', 'Haldia, WB', 'Medinipur, WB', 'Mumbai, MH',
  'Delhi, DL', 'Bangalore, KA', 'Hyderabad, TS', 'Chennai, TN', 'Pune, MH'
];

const PRODUCTS_DATA = [
  { name: 'Basmati Rice (Premium 5kg)', price: 580, cost: 460, unit: 'bag', category: 'Grocery' },
  { name: 'Fortune Mustard Oil (1L)', price: 165, cost: 135, unit: 'bottle', category: 'Grocery' },
  { name: 'Aashirvaad Whole Wheat Atta (10kg)', price: 420, cost: 350, unit: 'bag', category: 'Grocery' },
  { name: 'Tata Salt Vacuum Evaporated (1kg)', price: 28, cost: 21, unit: 'pkt', category: 'Grocery' },
  { name: 'Brooke Bond Red Label Tea (500g)', price: 290, cost: 235, unit: 'pkt', category: 'Grocery' },
  { name: 'Amul Butter Pasteurized (500g)', price: 275, cost: 240, unit: 'box', category: 'Dairy' },
  { name: 'Surf Excel Easy Wash Detergent (1kg)', price: 145, cost: 115, unit: 'pkt', category: 'FMCG' },
  { name: 'Dettol Antiseptic Soap (125g x 3)', price: 180, cost: 145, unit: 'pack', category: 'Personal Care' },
  { name: 'Dove Cream Beauty Bar (100g)', price: 65, cost: 50, unit: 'pcs', category: 'Personal Care' },
  { name: 'Colgate Strong Teeth Toothpaste (200g)', price: 115, cost: 90, unit: 'pcs', category: 'Personal Care' },
  { name: 'Britannia Good Day Biscuits (200g)', price: 40, cost: 30, unit: 'pkt', category: 'Snacks' },
  { name: 'Maggi 2-Minute Noodles (12-Pack)', price: 168, cost: 138, unit: 'pack', category: 'Snacks' },
  { name: 'Lays Potato Chips Cream & Onion (50g)', price: 20, cost: 15, unit: 'pkt', category: 'Snacks' },
  { name: 'Cadbury Dairy Milk Silk (150g)', price: 175, cost: 140, unit: 'pcs', category: 'Confectionery' },
  { name: 'Coca-Cola Soft Drink Bottle (1.25L)', price: 65, cost: 48, unit: 'bottle', category: 'Beverages' },
  { name: 'Classmate Exercise Notebook (180 Pages)', price: 60, cost: 42, unit: 'pcs', category: 'Stationery' },
  { name: 'Reynolds Ballpoint Pens (Blue - Box of 10)', price: 100, cost: 72, unit: 'box', category: 'Stationery' },
  { name: 'Boat Bassheads In-Ear Earphones', price: 499, cost: 310, unit: 'pcs', category: 'Electronics' },
  { name: 'Syska LED Bulb 9W (Cool Day Light)', price: 110, cost: 70, unit: 'pcs', category: 'Electronics' },
  { name: 'SanDisk 64GB USB 3.0 Flash Drive', price: 550, cost: 410, unit: 'pcs', category: 'Electronics' },
  { name: 'Cotton Full Sleeves Formal Shirt (M)', price: 899, cost: 520, unit: 'pcs', category: 'Apparel' },
  { name: 'Slim Fit Denim Jeans (Blue - 32)', price: 1299, cost: 780, unit: 'pcs', category: 'Apparel' },
  { name: 'Casual Running Shoes (Size 9)', price: 1499, cost: 890, unit: 'pair', category: 'Footwear' },
  { name: 'Stainless Steel Water Bottle (1L)', price: 349, cost: 210, unit: 'pcs', category: 'Home & Kitchen' },
  { name: 'Non-Stick Induction Frying Pan (24cm)', price: 699, cost: 440, unit: 'pcs', category: 'Home & Kitchen' },
];

const EXPENSE_CATEGORIES = [
  'Shop Rent & Maintenance',
  'Electricity & Utility Bill',
  'Staff Salary & Wages',
  'Transport & Freight Charges',
  'Tea, Snacks & Guest Refreshments',
  'Packaging Materials & Bags',
  'Internet & Phone Recharge',
  'Software & Cloud Subscription',
];

const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer'];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedUserAccount() {
  console.log(`\n==================================================`);
  console.log(`🚀 STARTING SEED FOR ACCOUNT: ${TARGET_EMAIL}`);
  console.log(`==================================================\n`);

  try {
    // 1. Get or create User
    const [userRows]: any = await pool.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [TARGET_EMAIL.toLowerCase()]);
    let userId = '';
    if (Array.isArray(userRows) && userRows.length > 0) {
      userId = userRows[0].id;
    } else {
      userId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?, ?, '$2a$10$abcdefghijklmnopqrstuv', 'Jaydeb Jana', '9876543210')",
        [userId, TARGET_EMAIL.toLowerCase()]
      );
      console.log(`✓ User account created: ${userId}`);
    }

    // 2. Get or create Business
    let businessId = '';
    const [profileRows]: any = await pool.query('SELECT business_id FROM profiles WHERE id = ? LIMIT 1', [userId]);
    if (Array.isArray(profileRows) && profileRows.length > 0 && profileRows[0].business_id) {
      businessId = profileRows[0].business_id;
    }

    if (!businessId) {
      const [bizRows]: any = await pool.query('SELECT id FROM businesses WHERE LOWER(email) = ? LIMIT 1', [TARGET_EMAIL.toLowerCase()]);
      if (Array.isArray(bizRows) && bizRows.length > 0) {
        businessId = bizRows[0].id;
      } else {
        businessId = crypto.randomUUID();
        await pool.query(
          "INSERT INTO businesses (id, name, email, phone, address, catalog_slug, catalog_handle, plan_name, currency) VALUES (?, 'BillingMaster Enterprise Store', ?, '9876543210', '12 Park Street, Kolkata, WB - 700016', 'store-jaydeb', 'store-jaydeb', 'Pro', 'INR')",
          [businessId, TARGET_EMAIL.toLowerCase()]
        );
      }

      await pool.query(
        "INSERT INTO profiles (id, business_id, full_name, role) VALUES (?, ?, 'Jaydeb Jana', 'owner') ON DUPLICATE KEY UPDATE business_id = VALUES(business_id)",
        [userId, businessId]
      );
    }

    console.log(`✓ Target Business ID: ${businessId}\n`);

    // Disable foreign key checks for clean bulk insertion
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 3. Create 50 Customers
    console.log('1. Inserting 50 Customers...');
    const customerList: Array<{ id: string; name: string; phone: string; email: string }> = [];

    for (let i = 1; i <= 50; i++) {
      const cid = crypto.randomUUID();
      const fn = getRandom(FIRST_NAMES);
      const ln = getRandom(LAST_NAMES);
      const name = `${fn} ${ln}`;
      const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`;
      const address = `${Math.floor(10 + Math.random() * 400)} Commercial Street, ${getRandom(CITIES)}`;

      await pool.query(
        "INSERT INTO customers (id, business_id, name, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)",
        [cid, businessId, name, phone, email, address]
      );
      customerList.push({ id: cid, name, phone, email });
    }
    console.log(`✓ 50 Customers inserted successfully.`);

    // 4. Create 50 Products
    console.log('2. Inserting 50 Products...');
    const productList: Array<{ id: string; name: string; price: number; cost: number }> = [];

    for (let i = 1; i <= 50; i++) {
      const pid = crypto.randomUUID();
      const template = PRODUCTS_DATA[(i - 1) % PRODUCTS_DATA.length];
      const name = i > PRODUCTS_DATA.length ? `${template.name} (Variant ${i})` : template.name;
      const sku = `SKU-BM-${1000 + i}`;
      const price = template.price;
      const cost = template.cost;
      const stock = Math.floor(25 + Math.random() * 300);
      const barcode = `8901234${10000 + i}`;

      await pool.query(
        "INSERT INTO products (id, business_id, name, sku, price, cost, stock_quantity, low_stock_threshold, unit, barcode, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, ?, 1)",
        [pid, businessId, name, sku, price, cost, stock, template.unit, barcode]
      );
      productList.push({ id: pid, name, price, cost });
    }
    console.log(`✓ 50 Products inserted successfully.`);

    // 5. Create 120 Invoices with Items
    console.log('3. Inserting 120 Invoices with Line Items...');
    const now = Date.now();
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

    for (let i = 1; i <= 120; i++) {
      const invId = crypto.randomUUID();
      const customer = getRandom(customerList);
      const invNum = `INV-2026-${(1000 + i).toString()}`;
      
      // Random date within past 6 months
      const randomTime = new Date(now - Math.random() * SIX_MONTHS_MS);
      const dateStr = randomTime.toISOString().slice(0, 10);
      const dateTimeStr = randomTime.toISOString().slice(0, 19).replace('T', ' ');

      // Generate 1 to 4 items for each invoice
      const itemCount = Math.floor(1 + Math.random() * 4);
      let subtotal = 0;
      let totalCost = 0;

      const itemsToInsert: Array<{ prod: any; qty: number; lineTotal: number }> = [];

      for (let j = 0; j < itemCount; j++) {
        const prod = getRandom(productList);
        const qty = Math.floor(1 + Math.random() * 5);
        const lineTotal = prod.price * qty;
        subtotal += lineTotal;
        totalCost += prod.cost * qty;
        itemsToInsert.push({ prod, qty, lineTotal });
      }

      const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
      const total = subtotal + tax;
      const status = i % 12 === 0 ? 'overdue' : i % 15 === 0 ? 'draft' : 'paid';
      const paidAmount = status === 'paid' ? total : status === 'overdue' ? 0 : 0;
      const balance = total - paidAmount;
      const paymentMethod = status === 'paid' ? getRandom(PAYMENT_MODES) : null;

      await pool.query(
        `INSERT INTO invoices (id, business_id, customer_id, invoice_number, status, issue_date, due_date, subtotal, tax, total, paid_amount, balance, payment_method, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invId, businessId, customer.id, invNum, status, dateStr, dateStr, subtotal, tax, total, paidAmount, balance, paymentMethod, userId, dateTimeStr]
      );

      for (const item of itemsToInsert) {
        const itemId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, cost, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, invId, item.prod.id, item.prod.name, item.qty, item.prod.price, item.prod.cost, item.lineTotal]
        );
      }
    }
    console.log(`✓ 120 Invoices and Items inserted successfully.`);

    // 6. Create 30 Expenses
    console.log('4. Inserting 30 Expenses...');
    for (let i = 1; i <= 30; i++) {
      const expId = crypto.randomUUID();
      const cat = getRandom(EXPENSE_CATEGORIES);
      const amount = Math.floor(250 + Math.random() * 7500);
      const randomTime = new Date(now - Math.random() * SIX_MONTHS_MS);
      const dateStr = randomTime.toISOString().slice(0, 10);
      const desc = `Monthly ${cat.toLowerCase()} payment #${i}`;

      await pool.query(
        "INSERT INTO expenses (id, business_id, category, amount, date, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [expId, businessId, cat, amount, dateStr, desc, userId]
      );
    }
    console.log(`✓ 30 Expenses inserted successfully.`);

    // 7. Create 40 Khata Book entries
    console.log('5. Inserting 40 Khata Book entries...');
    for (let i = 1; i <= 40; i++) {
      const kid = crypto.randomUUID();
      const customer = getRandom(customerList);
      const type = i % 2 === 0 ? 'gave' : 'got';
      const amount = Math.floor(100 + Math.random() * 3500);
      const randomTime = new Date(now - Math.random() * SIX_MONTHS_MS);
      const dateStr = randomTime.toISOString().slice(0, 10);
      const timeStr = randomTime.toTimeString().slice(0, 5);
      const note = type === 'gave' ? 'Goods given on credit' : 'Received partial payment via UPI';

      await pool.query(
        `INSERT INTO khata_entries (id, business_id, customer_id, customer_name, customer_phone, type, amount, date, time, payment_mode, bill_reference, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [kid, businessId, customer.id, customer.name, customer.phone, type, amount, dateStr, timeStr, type === 'got' ? 'upi' : 'cash', `BILL-${100 + i}`, note]
      );
    }
    console.log(`✓ 40 Khata Book entries inserted successfully.`);

    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log(`\n==================================================`);
    console.log(`🎉 ALL FAKE DATA POPULATED SUCCESSFULLY FOR ${TARGET_EMAIL}!`);
    console.log(`==================================================\n`);
  } catch (err) {
    console.error('❌ Error seeding user account data:', err);
    try { await pool.query('SET FOREIGN_KEY_CHECKS = 1;'); } catch (e) {}
  } finally {
    process.exit(0);
  }
}

seedUserAccount();
