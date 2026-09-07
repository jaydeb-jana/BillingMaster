export interface MasterUnit {
  value: string;
  label: string;
  category: 
    | 'Count & Packaging'
    | 'Weight & Mass'
    | 'Volume & Liquid'
    | 'Length & Linear'
    | 'Area & Surface'
    | 'Food & Serving'
    | 'Time & Service'
    | 'Digital & Data'
    | 'Custom';
  hint: string;
  defaultEnabled?: boolean;
}

export const MASTER_UNITS_LIST: MasterUnit[] = [
  // --- Count & Packaging ---
  { value: 'pcs', label: 'Pcs — Pieces / Units', category: 'Count & Packaging', hint: 'Countable individual items (Shirts, Bottles, Cables)', defaultEnabled: true },
  { value: 'box', label: 'Box — Box / Case', category: 'Count & Packaging', hint: 'Cartons, boxes, or multi-item packages', defaultEnabled: true },
  { value: 'pkt', label: 'Pkt — Packet / Pouch', category: 'Count & Packaging', hint: 'Sealed pouches, snack bags, or packets', defaultEnabled: true },
  { value: 'btl', label: 'Btl — Bottle', category: 'Count & Packaging', hint: 'Bottled liquids, drinks, cosmetics, oils', defaultEnabled: true },
  { value: 'dzn', label: 'Dzn — Dozen (12 pcs)', category: 'Count & Packaging', hint: 'Pack or set of 12 items (Eggs, Bananas)', defaultEnabled: true },
  { value: 'set', label: 'Set — Set / Kit', category: 'Count & Packaging', hint: 'Matching pair or multi-piece tool/garment sets', defaultEnabled: true },
  { value: 'pr', label: 'Pair — Pair', category: 'Count & Packaging', hint: 'Two matching items (Shoes, Socks, Gloves)', defaultEnabled: true },
  { value: 'roll', label: 'Roll — Roll', category: 'Count & Packaging', hint: 'Rolls of tape, foil, paper, or carpet', defaultEnabled: true },
  { value: 'bndl', label: 'Bndl — Bundle', category: 'Count & Packaging', hint: 'Bundled rods, pipes, planks, paper sheets', defaultEnabled: true },
  { value: 'jar', label: 'Jar — Jar / Container', category: 'Count & Packaging', hint: 'Glass or plastic jars (Jam, Pickle, Cream)', defaultEnabled: true },
  { value: 'can', label: 'Can — Can / Tin', category: 'Count & Packaging', hint: 'Metal cans (Beverages, Paint, Ghee)', defaultEnabled: true },
  { value: 'bag', label: 'Bag — Bag / Sack', category: 'Count & Packaging', hint: 'Bags or sacks (Rice, Flour, Cement)', defaultEnabled: true },
  { value: 'strip', label: 'Strip — Strip / Blister', category: 'Count & Packaging', hint: 'Medicine tablet strips or blister packs', defaultEnabled: true },
  { value: 'crate', label: 'Crate — Crate', category: 'Count & Packaging', hint: 'Plastic or wooden crates (Milk, Fruit)', defaultEnabled: false },
  { value: 'ctn', label: 'Carton — Shipping Carton', category: 'Count & Packaging', hint: 'Bulk corrugated shipping boxes', defaultEnabled: false },
  { value: 'tube', label: 'Tube — Squeeze Tube', category: 'Count & Packaging', hint: 'Ointments, toothpaste, paste, sealant', defaultEnabled: false },
  { value: 'tin', label: 'Tin — Tin Container', category: 'Count & Packaging', hint: 'Sealed metal tin containers', defaultEnabled: false },
  { value: 'bucket', label: 'Bucket — Bucket / Pail', category: 'Count & Packaging', hint: 'Pails of paint, chemicals, or grease', defaultEnabled: false },
  { value: 'barrel', label: 'Barrel — Barrel / Drum', category: 'Count & Packaging', hint: 'Large liquid drums or oil barrels', defaultEnabled: false },
  { value: 'sheet', label: 'Sheet — Sheet / Board', category: 'Count & Packaging', hint: 'Plywood, metal sheets, paper boards', defaultEnabled: false },
  { value: 'tray', label: 'Tray — Tray', category: 'Count & Packaging', hint: 'Egg trays, seedling trays, bakery trays', defaultEnabled: false },
  { value: 'sachet', label: 'Sachet — Sachet', category: 'Count & Packaging', hint: 'Single-use shampoo, ketchup, or tea sachets', defaultEnabled: false },
  { value: 'bale', label: 'Bale — Compressed Bale', category: 'Count & Packaging', hint: 'Cotton bales, scrap bales', defaultEnabled: false },

  // --- Weight & Mass ---
  { value: 'kg', label: 'kg — Kilograms', category: 'Weight & Mass', hint: 'Standard mass (Rice, Sugar, Atta, Vegetables)', defaultEnabled: true },
  { value: 'g', label: 'g — Grams', category: 'Weight & Mass', hint: 'Small weight (Spices, Tea, Soap, Biscuits)', defaultEnabled: true },
  { value: 'mg', label: 'mg — Milligrams', category: 'Weight & Mass', hint: 'Fine precision weight (Pharma, Powders)', defaultEnabled: false },
  { value: 'qtl', label: 'Qtl — Quintal (100 kg)', category: 'Weight & Mass', hint: 'Agricultural bulk produce (Grain sacks)', defaultEnabled: false },
  { value: 'ton', label: 'Ton — Metric Ton (1000 kg)', category: 'Weight & Mass', hint: 'Heavy industrial materials (Steel, Coal, Cement)', defaultEnabled: false },
  { value: 'lb', label: 'lb — Pound', category: 'Weight & Mass', hint: 'Weight in pounds (Supplements, Imports)', defaultEnabled: false },
  { value: 'oz', label: 'oz — Ounce', category: 'Weight & Mass', hint: 'Precious metals, gourmet spices', defaultEnabled: false },

  // --- Volume & Liquid ---
  { value: 'litre', label: 'L / Litre — Litres', category: 'Volume & Liquid', hint: 'Liquid volume (Oil, Milk, Juice, Paint)', defaultEnabled: true },
  { value: 'ml', label: 'ml — Millilitres', category: 'Volume & Liquid', hint: 'Small liquid volume (250 ml, 500 ml bottles)', defaultEnabled: true },
  { value: 'cl', label: 'cl — Centilitres', category: 'Volume & Liquid', hint: 'Beverage and liquor bottle volumes', defaultEnabled: false },
  { value: 'gal', label: 'Gal — Gallon', category: 'Volume & Liquid', hint: 'Large fluid containers (Paint, Chemicals)', defaultEnabled: false },
  { value: 'pt', label: 'Pint — Pint', category: 'Volume & Liquid', hint: 'Beverage or dairy servings', defaultEnabled: false },
  { value: 'fl_oz', label: 'fl oz — Fluid Ounce', category: 'Volume & Liquid', hint: 'Cosmetic fluids and perfumes', defaultEnabled: false },
  { value: 'm3', label: 'm³ — Cubic Meter', category: 'Volume & Liquid', hint: 'Concrete, timber, bulk gas volume', defaultEnabled: false },

  // --- Length & Linear ---
  { value: 'mtr', label: 'Mtr — Meters', category: 'Length & Linear', hint: 'Fabric, cable, wire, piping length', defaultEnabled: true },
  { value: 'ft', label: 'Ft — Feet / Foot', category: 'Length & Linear', hint: 'Linear measurement (Timber, Banner, Wire)', defaultEnabled: true },
  { value: 'yd', label: 'Yd — Yard / Yards', category: 'Length & Linear', hint: 'Cloth, fencing wire, rope', defaultEnabled: true },
  { value: 'cm', label: 'cm — Centimeters', category: 'Length & Linear', hint: 'Ribbons, zippers, small hardware', defaultEnabled: false },
  { value: 'mm', label: 'mm — Millimeters', category: 'Length & Linear', hint: 'Precision screws, wire gauges', defaultEnabled: false },
  { value: 'in', label: 'In — Inches', category: 'Length & Linear', hint: 'Pipe diameters, glass cuts, screen sizes', defaultEnabled: false },
  { value: 'km', label: 'km — Kilometers', category: 'Length & Linear', hint: 'Transport distance, cabling routes', defaultEnabled: false },

  // --- Area & Surface ---
  { value: 'sqft', label: 'Sq Ft — Square Feet', category: 'Area & Surface', hint: 'Tiles, flooring, glass, plywood, granite', defaultEnabled: true },
  { value: 'sqm', label: 'Sq M — Square Meters', category: 'Area & Surface', hint: 'Roofing, carpets, land plots', defaultEnabled: false },
  { value: 'sqyd', label: 'Sq Yd — Square Yards', category: 'Area & Surface', hint: 'Real estate plots, lawn grass', defaultEnabled: false },
  { value: 'acre', label: 'Acre — Acre', category: 'Area & Surface', hint: 'Agricultural land, real estate', defaultEnabled: false },
  { value: 'hectare', label: 'Hectare — Hectare', category: 'Area & Surface', hint: 'Large farm land, forestry', defaultEnabled: false },
  { value: 'sqin', label: 'Sq In — Square Inches', category: 'Area & Surface', hint: 'Small glass cuts, stickers, labels', defaultEnabled: false },

  // --- Food & Serving ---
  { value: 'plate', label: 'Plate — Plate / Serving', category: 'Food & Serving', hint: 'Restaurant meals, snacks, catering portions', defaultEnabled: true },
  { value: 'cup', label: 'Cup — Cup / Mug', category: 'Food & Serving', hint: 'Hot beverages, ice cream, soup', defaultEnabled: false },
  { value: 'bowl', label: 'Bowl — Bowl', category: 'Food & Serving', hint: 'Curry, soup, dessert servings', defaultEnabled: false },
  { value: 'glass', label: 'Glass — Glass', category: 'Food & Serving', hint: 'Juice, lassi, beverage drinks', defaultEnabled: false },
  { value: 'portion', label: 'Portion — Portion', category: 'Food & Serving', hint: 'Buffet or meal portions', defaultEnabled: false },
  { value: 'scoop', label: 'Scoop — Scoop', category: 'Food & Serving', hint: 'Ice cream scoops, protein powder', defaultEnabled: false },
  { value: 'slice', label: 'Slice — Slice', category: 'Food & Serving', hint: 'Pizza, cake, bread slices', defaultEnabled: false },

  // --- Time & Service ---
  { value: 'hr', label: 'Hr — Hours', category: 'Time & Service', hint: 'Hourly service, labor, rental time', defaultEnabled: true },
  { value: 'day', label: 'Day — Days', category: 'Time & Service', hint: 'Daily rental, vehicle hire', defaultEnabled: false },
  { value: 'service', label: 'Service — Service Call', category: 'Time & Service', hint: 'Maintenance, installation, repair jobs', defaultEnabled: true },
  { value: 'visit', label: 'Visit — Service Visit', category: 'Time & Service', hint: 'Consultation, technician home visits', defaultEnabled: false },
  { value: 'project', label: 'Project — Fixed Project', category: 'Time & Service', hint: 'Fixed contract scope or design project', defaultEnabled: false },
  { value: 'mo', label: 'Month — Monthly Sub', category: 'Time & Service', hint: 'Monthly retainers or subscriptions', defaultEnabled: false },

  // --- Digital & Data ---
  { value: 'gb', label: 'GB — Gigabytes', category: 'Digital & Data', hint: 'Data packages, cloud storage', defaultEnabled: false },
  { value: 'mb', label: 'MB — Megabytes', category: 'Digital & Data', hint: 'Mobile internet data plans', defaultEnabled: false },
  { value: 'tb', label: 'TB — Terabytes', category: 'Digital & Data', hint: 'Server backup storage', defaultEnabled: false },
  { value: 'license', label: 'License — User License', category: 'Digital & Data', hint: 'SaaS user licenses, app seats', defaultEnabled: false },
];

const STORAGE_KEY_ENABLED = 'billingmaster_enabled_units';
const STORAGE_KEY_CUSTOM = 'billingmaster_custom_units';
const STORAGE_KEY_STARRED = 'billingmaster_starred_units';

export function getDefaultEnabledCodes(): string[] {
  return MASTER_UNITS_LIST.filter(u => u.defaultEnabled).map(u => u.value);
}

export function getDefaultStarredCodes(): string[] {
  return ['pcs', 'kg', 'litre', 'box', 'pkt', 'btl', 'dzn', 'ft', 'sqft', 'plate'];
}

export function getStoredStarredCodes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STARRED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse stored starred unit codes:', e);
  }
  return getDefaultStarredCodes();
}

export function saveStarredCodes(starredCodes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(starredCodes));
  } catch (e) {
    console.error('Failed to save starred unit codes:', e);
  }
}

export function getStoredCustomUnits(): MasterUnit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse stored custom units:', e);
  }
  return [];
}

export function getStoredEnabledCodes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENABLED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse stored enabled unit codes:', e);
  }
  return getDefaultEnabledCodes();
}

export function saveUnitSettings(enabledCodes: string[], customUnits: MasterUnit[], starredCodes?: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(enabledCodes));
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customUnits));
    if (starredCodes) {
      localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(starredCodes));
    }
  } catch (e) {
    console.error('Failed to save unit settings to localStorage:', e);
  }
}

export function getCombinedUnits(customUnits: MasterUnit[] = getStoredCustomUnits()): MasterUnit[] {
  return [...MASTER_UNITS_LIST, ...customUnits];
}

export function getDropdownOptionsForUnits(
  enabledCodes: string[], 
  currentUnit?: string, 
  starredCodes: string[] = getStoredStarredCodes()
): { label: string; value: string; hint: string }[] {
  const allUnits = getCombinedUnits();
  const enabledSet = new Set(enabledCodes);
  const starredSet = new Set(starredCodes);

  let list = allUnits.filter(u => enabledSet.has(u.value));

  // If existing product has a unit that's not currently enabled, keep it visible so data isn't hidden
  if (currentUnit) {
    const lower = currentUnit.toLowerCase();
    const alreadyIncluded = list.some(u => u.value.toLowerCase() === lower);
    if (!alreadyIncluded) {
      const existingInMaster = allUnits.find(u => u.value.toLowerCase() === lower);
      if (existingInMaster) {
        list.push(existingInMaster);
      } else {
        list.push({
          value: currentUnit,
          label: `${currentUnit.toUpperCase()} — Custom`,
          category: 'Custom',
          hint: 'Existing product unit'
        });
      }
    }
  }

  // Sort starred units to top!
  list.sort((a, b) => {
    const aStarred = starredSet.has(a.value);
    const bStarred = starredSet.has(b.value);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return 0;
  });

  return list.map(u => ({
    label: starredSet.has(u.value) ? `⭐ ${u.label}` : u.label,
    value: u.value,
    hint: u.hint
  }));
}
