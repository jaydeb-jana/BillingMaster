const mysql = require('mysql2/promise');
const crypto = require('node:crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'billingmaster',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const sampleCustomers = [
  { name: "Rahul Sharma", email: "rahul.sharma@example.com", phone: "+91 98301 12345", address: "MG Road, Commercial Hub, Kolkata, WB 700007", notes: "Regular buyer of formal shirts & trousers. Prefers email invoices.", balance: 0.00 },
  { name: "Priya Patel", email: "priya.patel@example.com", phone: "+91 98302 23456", address: "Park Street, Flat 4B, Kolkata, WB 700016", notes: "Prefers online invoicing and WhatsApp payment reminders.", balance: 1250.00 },
  { name: "Amit Roy", email: "amit.roy@example.com", phone: "+91 98303 34567", address: "Salt Lake Sector V, Block EP, Kolkata, WB 700091", notes: "Corporate bulk buyer for company apparel gifting.", balance: 0.00 },
  { name: "Sneha Banerjee", email: "sneha.b@example.com", phone: "+91 98304 45678", address: "Southern Avenue, Lake Gardens, Kolkata, WB 700029", notes: "VIP Customer - High value recurring purchases.", balance: 4500.00 },
  { name: "Rajesh Kumar", email: "rajesh.k@example.com", phone: "+91 98305 56789", address: "Ballygunge Circular Rd, Kolkata, WB 700019", notes: "Prefers cash on delivery and store pickup.", balance: 0.00 },
  { name: "Ananya Das", email: "ananya.das@example.com", phone: "+91 98306 67890", address: "New Town Action Area 1, Kolkata, WB 700156", notes: "Frequent purchaser of women's ethnic & western apparel.", balance: 850.00 },
  { name: "Vikramaditya Singh", email: "vikram.singh@example.com", phone: "+91 98307 78901", address: "Gariahat Main Market, Shop 12, Kolkata, WB 700019", notes: "Retail distributor partner - Wholesale pricing applicable.", balance: 12500.00 },
  { name: "Sunita Mukherjee", email: "sunita.m@example.com", phone: "+91 98308 89012", address: "Alipore Park Road, Kolkata, WB 700027", notes: "Monthly credit account customer with net 30 terms.", balance: 3200.00 },
  { name: "Arjun Gupta", email: "arjun.gupta@example.com", phone: "+91 98309 90123", address: "Howrah Station Road, Howrah, WB 711101", notes: "Bulk denim and graphic t-shirt buyer.", balance: 0.00 },
  { name: "Pooja Verma", email: "pooja.verma@example.com", phone: "+91 98310 01234", address: "Rashbehari Avenue, Kolkata, WB 700026", notes: "Casual wear regular shopper.", balance: 0.00 },
  { name: "Devendra Chawla", email: "dev.chawla@example.com", phone: "+91 98311 12345", address: "Elgin Road, Forum Quarter, Kolkata, WB 700020", notes: "Wholesale reseller customer.", balance: 6800.00 },
  { name: "Meera Sengupta", email: "meera.s@example.com", phone: "+91 98312 23456", address: "Lake Town Block B, Kolkata, WB 700089", notes: "Preferred loyalty buyer - 10% seasonal discount tier.", balance: 0.00 },
  { name: "Rakesh Paul", email: "rakesh.paul@example.com", phone: "+91 98313 34567", address: "Dum Dum Cantonment, Kolkata, WB 700065", notes: "Express delivery priority customer.", balance: 950.00 },
  { name: "Tanvi Bose", email: "tanvi.bose@example.com", phone: "+91 98314 45678", address: "Jadavpur University Area, Kolkata, WB 700032", notes: "Student tier customer account.", balance: 0.00 },
  { name: "Subhash Ghosh", email: "subhash.g@example.com", phone: "+91 98315 56789", address: "College Street Market, Kolkata, WB 700073", notes: "Commercial partner for custom apparel orders.", balance: 2100.00 }
];

async function seedCustomers() {
  console.log('Fetching businesses from MySQL database...');
  const [businesses] = await pool.query('SELECT id, name FROM businesses');
  
  if (!businesses || businesses.length === 0) {
    console.error('No businesses found in database!');
    process.exit(1);
  }

  console.log(`Found ${businesses.length} business(es):`, businesses.map(b => `${b.name} (${b.id})`).join(', '));

  let totalAdded = 0;

  for (const biz of businesses) {
    console.log(`Seeding sample customers for business: ${biz.name} (${biz.id})...`);
    
    for (const c of sampleCustomers) {
      // Check if customer phone already exists for this business
      const [existing] = await pool.query(
        'SELECT id FROM customers WHERE business_id = ? AND (phone = ? OR email = ? OR name = ?)',
        [biz.id, c.phone, c.email, c.name]
      );

      if (existing.length === 0) {
        const customerId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO customers (id, business_id, name, email, phone, address, notes, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [customerId, biz.id, c.name, c.email, c.phone, c.address, c.notes, c.balance]
        );
        totalAdded++;
      }
    }
  }

  console.log(`Successfully added ${totalAdded} sample customers across all businesses!`);
  process.exit(0);
}

seedCustomers().catch((err) => {
  console.error('Error seeding sample customers:', err);
  process.exit(1);
});
