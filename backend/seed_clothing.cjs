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

const BUSINESS_ID = '59ce5b83-e5b0-4508-8e83-98e7c51739be';

const sampleImages = [
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500&auto=format&fit=crop&q=60'
];

const clothingTemplates = [
  // Shirts
  { title: "Slim Fit Oxford Cotton Formal Shirt", cat: "Shirts", basePrice: 899, baseCost: 450, desc: "Classic 100% breathable Oxford cotton shirt designed for formal & casual wear." },
  { title: "Linen Blend Short Sleeve Beach Shirt", cat: "Shirts", basePrice: 1199, baseCost: 600, desc: "Lightweight and airy linen shirt perfect for summer outings and weekend getaways." },
  { title: "Premium Micro-Check Formal Dress Shirt", cat: "Shirts", basePrice: 1499, baseCost: 750, desc: "Wrinkle-resistant micro-check dress shirt with stiff spread collar for professional elegance." },
  { title: "Vintage Corduroy Button-Down Overshirt", cat: "Shirts", basePrice: 1299, baseCost: 650, desc: "Soft-textured corduroy overshirt with front chest flap pockets." },
  { title: "Mandarin Collar Casual Slub Cotton Shirt", cat: "Shirts", basePrice: 999, baseCost: 500, desc: "Modern band collar shirt in soft slub cotton fabric." },

  // T-Shirts
  { title: "Heavyweight 240 GSM Graphic Oversized Tee", cat: "T-Shirts", basePrice: 699, baseCost: 320, desc: "Streetwear oversized drop-shoulder t-shirt crafted from premium 240 GSM combed cotton." },
  { title: "Classic Pique Cotton Polo T-Shirt", cat: "T-Shirts", basePrice: 799, baseCost: 380, desc: "Ribbed collar polo t-shirt with signature chest logo embroidery." },
  { title: "Organic Slub Crewneck Everyday T-Shirt", cat: "T-Shirts", basePrice: 499, baseCost: 220, desc: "Everyday staple crew neck t-shirt made with 100% organic cotton." },
  { title: "Athletic Moisture-Wicking Dry Fit Tee", cat: "T-Shirts", basePrice: 599, baseCost: 260, desc: "Lightweight stretch polyester gym t-shirt designed for active workouts." },
  { title: "Striped Nautical Yarn-Dyed Crewneck T-Shirt", cat: "T-Shirts", basePrice: 649, baseCost: 300, desc: "Timeless navy and white yarn-dyed striped casual t-shirt." },

  // Jeans & Denim
  { title: "Skinny Fit Stretchable Indigo Denim Jeans", cat: "Jeans", basePrice: 1699, baseCost: 850, desc: "Durable stretch indigo denim with ergonomic 5-pocket styling." },
  { title: "Straight Fit Washed Vintage Denim Jeans", cat: "Jeans", basePrice: 1899, baseCost: 950, desc: "Classic straight-cut mid-rise denim with distressed washing." },
  { title: "Slim Tapered Jet Black Denim Pants", cat: "Jeans", basePrice: 1799, baseCost: 900, desc: "Fade-resistant deep black denim with comfortable flexibility." },
  { title: "Relaxed Fit Utility Cargo Denim Trousers", cat: "Jeans", basePrice: 2199, baseCost: 1100, desc: "Utility cargo pants with multiple flap pockets and reinforced stitching." },

  // Hoodies & Sweatshirts
  { title: "Fleece Lined Warm Pullover Hoodie", cat: "Hoodies", basePrice: 1499, baseCost: 720, desc: "Heavyweight warm fleece hoodie with kangaroo pocket and adjustable drawstring hood." },
  { title: "Full Zip-Up Urban Streetwear Fleece Hoodie", cat: "Hoodies", basePrice: 1699, baseCost: 850, desc: "Full-zip fleece sweater with ribbed cuffs and hem." },
  { title: "Colorblock Tri-Color Crewneck Sweatshirt", cat: "Hoodies", basePrice: 1299, baseCost: 600, desc: "Modern tri-color blocked casual fleece crewneck jumper." },

  // Jackets
  { title: "Classic Brass Button Trucker Denim Jacket", cat: "Jackets", basePrice: 2499, baseCost: 1200, desc: "Rugged heavy-cotton denim trucker jacket with brass button closure." },
  { title: "Quilted Lightweight Puffer Winter Jacket", cat: "Jackets", basePrice: 2999, baseCost: 1500, desc: "Windproof poly-fill insulated bomber jacket with high neck band." },
  { title: "Sleek Faux Leather Biker Motorcycle Jacket", cat: "Jackets", basePrice: 3499, baseCost: 1750, desc: "Sleek asymmetrical zipped motorcycle jacket with metallic hardware." },
  { title: "Water-Resistant Hooded Packable Windbreaker", cat: "Jackets", basePrice: 1999, baseCost: 980, desc: "Ultra-packable lightweight rain jacket with mesh lining." },

  // Women's Dresses & Tops
  { title: "Floral Print Chiffon Tiered Midi Dress", cat: "Dresses", basePrice: 1599, baseCost: 780, desc: "Elegant floral printed midi dress with elasticated waist and tiered skirt." },
  { title: "Ribbed Knit Bodycon Mini Casual Dress", cat: "Dresses", basePrice: 1299, baseCost: 620, desc: "Stretch ribbed cotton knit dress with square neckline." },
  { title: "Boho Neck Embroidery Cotton Tunic Top", cat: "Tops", basePrice: 899, baseCost: 420, desc: "Detailed neck embroidery top with tassel ties and lantern sleeves." },
  { title: "Silky Satin Button-Front Casual Blouse", cat: "Tops", basePrice: 1099, baseCost: 520, desc: "Silky smooth satin shirt top with notched collar." },
  { title: "Crop Top Stretch Ribbed Casual Tee", cat: "Tops", basePrice: 499, baseCost: 210, desc: "Soft cotton stretch cropped top for daily styling." },

  // Women's Jeans
  { title: "High-Rise Super Stretch Vintage Mom Jeans", cat: "Women Jeans", basePrice: 1799, baseCost: 890, desc: "Flattering high-waist vintage mom jeans with ankle taper." },
  { title: "Wide Leg Flared Denim High Rise Trousers", cat: "Women Jeans", basePrice: 1999, baseCost: 990, desc: "Trendy wide-leg high rise denim with clean hem finish." },

  // Ethnic Wear
  { title: "Pure Cotton Hand-Block Printed Straight Kurta", cat: "Ethnic", basePrice: 999, baseCost: 480, desc: "Hand-block printed knee-length cotton kurta with band collar." },
  { title: "Designer Woven Silk Blend Nehru Jacket Set", cat: "Ethnic", basePrice: 3299, baseCost: 1600, desc: "Traditional woven silk waistcoat with matching kurta pyjama set." },
  { title: "Anarkali Zari Embroidered Kurti with Dupatta", cat: "Ethnic", basePrice: 2499, baseCost: 1200, desc: "Graceful flare gown kurti adorned with zari work." },

  // Trousers & Activewear
  { title: "Slim Fit Cotton Stretch Chino Trousers", cat: "Trousers", basePrice: 1399, baseCost: 680, desc: "Tailored cotton twill chinos with expandable waistband." },
  { title: "Crease-Resistant Formal Suit Trousers", cat: "Trousers", basePrice: 1599, baseCost: 780, desc: "Poly-viscose crease-resistant formal suit trousers." },
  { title: "Quick-Dry Active Workout Jogger Sweatpants", cat: "Activewear", basePrice: 999, baseCost: 480, desc: "Flexible workout sweatpants with elasticated drawstring waist." }
];

const colors = ["Navy Blue", "Charcoal Grey", "Olive Green", "Classic Black", "Pure White", "Maroon", "Beige Tan", "Crimson Red", "Mustard Yellow", "Sky Blue", "Dusty Pink", "Emerald Green"];
const sizes = ["S", "M", "L", "XL", "XXL"];

async function seed() {
  console.log('Starting catalog seeding of 105+ apparel products...');

  // Delete dummy item zcsc
  await pool.query("DELETE FROM products WHERE business_id = ? AND (name = 'zcsc' OR name LIKE 'Test%')", [BUSINESS_ID]);

  const productsToInsert = [];
  let count = 0;

  for (let i = 0; i < 112; i++) {
    const template = clothingTemplates[i % clothingTemplates.length];
    const color = colors[i % colors.length];
    const size = sizes[i % sizes.length];
    const img = sampleImages[i % sampleImages.length];

    const variationName = `${template.title} (${color}, ${size})`;
    const sku = `APP-${template.cat.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()}-${1000 + i}`;
    
    const priceOffset = (i % 7) * 65;
    const price = template.basePrice + priceOffset; // ALL strictly > 100!
    const cost = Math.round(price * 0.52);
    const stock = 20 + ((i * 11) % 90); // 20 to 110 pcs
    const lowStockThreshold = 5;

    const id = crypto.randomUUID();

    productsToInsert.push([
      id,
      BUSINESS_ID,
      null, // category_id
      variationName,
      sku,
      price,
      cost,
      stock,
      lowStockThreshold,
      'pcs',
      1, // is_active
      template.desc + ` Color: ${color}. Size: ${size}.`,
      img
    ]);
    count++;
  }

  const sql = `INSERT INTO products (id, business_id, category_id, name, sku, price, cost, stock_quantity, low_stock_threshold, unit, is_active, description, image_url) VALUES ?`;
  
  await pool.query(sql, [productsToInsert]);

  console.log(`Successfully added ${count} premium apparel products for janajaydeb36@gmail.com!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding products:', err);
  process.exit(1);
});
