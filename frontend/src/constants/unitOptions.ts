export interface MasterUnit {
  value: string;
  label: string;
  category: 
    | 'Count & Packaging'
    | 'Length & Linear'
    | 'Weight & Mass'
    | 'Volume & Liquid'
    | 'Area & Surface'
    | 'Food & Serving'
    | 'Time & Service'
    | 'Digital & Data'
    | 'Custom';
  hint: string;
  defaultEnabled?: boolean;
}

export const MASTER_UNITS_LIST: MasterUnit[] = [
  // ==========================================
  // 1. COUNT & PACKAGING
  // ==========================================
  { value: 'pcs', label: 'Pcs — Pieces (Single Item)', category: 'Count & Packaging', hint: 'For single items: Shirts, Pants, Mobile, Tools, Toys', defaultEnabled: true },
  { value: 'pr', label: 'Pair — Pair (2 Items)', category: 'Count & Packaging', hint: 'For paired items: Shoes, Slippers, Sandals, Socks, Gloves', defaultEnabled: true },
  { value: 'box', label: 'Box — Box / Case', category: 'Count & Packaging', hint: 'For boxed goods: Sweet boxes, Mobile box, Medicine box', defaultEnabled: true },
  { value: 'pkt', label: 'Pkt — Packet / Pouch', category: 'Count & Packaging', hint: 'For packets: Biscuits, Spices, Chips, Tea pouches', defaultEnabled: true },
  { value: 'dzn', label: 'Dzn — Dozen (12 Items)', category: 'Count & Packaging', hint: 'For 12 items: Eggs, Bananas, Socks, Handkerchiefs', defaultEnabled: true },
  { value: 'unt', label: 'Unt — Device / Unit', category: 'Count & Packaging', hint: 'For devices & gadgets: Phones, Laptops, Machines', defaultEnabled: true },

  // ==========================================
  // 2. WEIGHT & MASS (Grocery & Hardware)
  // ==========================================
  { value: 'kg', label: 'Kg — Kilogram (Weight)', category: 'Weight & Mass', hint: 'For solid weight: Rice, Dal, Sugar, Potatoes, Nails, Steel', defaultEnabled: true },
  { value: 'g', label: 'Gm — Gram (Light Weight)', category: 'Weight & Mass', hint: 'For light weight: Tea, Spices, Soap, Cardamom, Dry fruits', defaultEnabled: true },
  { value: 'qtl', label: 'Qtl — Quintal (100 Kg)', category: 'Weight & Mass', hint: 'For bulk goods: 100 kg grain bags, TMT steel rods', defaultEnabled: true },
  { value: 'ton', label: 'Ton — Metric Ton (1000 Kg)', category: 'Weight & Mass', hint: 'For heavy bulk: Sand, Stones, Iron rods, Cement', defaultEnabled: true },

  // ==========================================
  // 3. VOLUME & LIQUID (Grocery & Hardware)
  // ==========================================
  { value: 'litre', label: 'Ltr — Litre (Liquid)', category: 'Volume & Liquid', hint: 'For liquids: Cooking oil, Milk, Paint, Water, Coolant', defaultEnabled: true },
  { value: 'ml', label: 'ml — Millilitre (Liquid)', category: 'Volume & Liquid', hint: 'For small liquid bottles: Hair oil, Syrup, Soft drinks', defaultEnabled: true },
  { value: 'cft', label: 'CFT — Cubic Feet (Sand & Wood)', category: 'Volume & Liquid', hint: 'For timber & sand: Wood logs, Sand, Stone chips, Marble', defaultEnabled: true },

  // ==========================================
  // 4. LENGTH, LINEAR & TEXTILE (Cloth, Hardware, Pipes)
  // ==========================================
  { value: 'mtr', label: 'Mtr — Meter (Length)', category: 'Length & Linear', hint: 'For cloth & wire: Fabric length, Electric cable, PVC pipe', defaultEnabled: true },
  { value: 'yd', label: 'Yd — Yard / Gaj (Cloth)', category: 'Length & Linear', hint: 'For cloth shops: 2-Yard cloth, Ribbon, Lace, Borders', defaultEnabled: true },
  { value: 'thn', label: 'Than — Fabric Bolt (Full Roll)', category: 'Length & Linear', hint: 'For cloth shops: Full roll of cloth (Than / 20m - 40m)', defaultEnabled: true },
  { value: 'ft', label: 'Ft — Feet / Foot (Length)', category: 'Length & Linear', hint: 'For linear length: Timber wood, PVC pipes, Banners', defaultEnabled: true },
  { value: 'in', label: 'In — Inch (Length)', category: 'Length & Linear', hint: 'For small measurements: Screws, Pipe width, Display size', defaultEnabled: true },
  { value: 'cm', label: 'cm — Centimeter', category: 'Length & Linear', hint: 'For tailoring: Small cloth borders, Ribbons, Zippers', defaultEnabled: true },
  { value: 'mm', label: 'mm — Millimeter', category: 'Length & Linear', hint: 'For precision hardware: Nut-bolts, Screws, Drill bits', defaultEnabled: true },
  { value: 'len', label: 'Len — Length (Pipe / Rod)', category: 'Length & Linear', hint: 'For full length rods: 10 ft or 20 ft PVC pipe, Conduit pipe', defaultEnabled: true },

  // ==========================================
  // 5. AREA & SURFACE (Tiles, Plywood, Glass)
  // ==========================================
  { value: 'sqft', label: 'Sq Ft — Square Feet (Area)', category: 'Area & Surface', hint: 'For surface area: Floor tiles, Wall tiles, Plywood, Glass', defaultEnabled: true },
  { value: 'sqm', label: 'Sq M — Square Meter', category: 'Area & Surface', hint: 'For large area: Floor carpets, Roofing sheets, Big mats', defaultEnabled: true },
];

const STORAGE_KEY_ENABLED = 'billingmaster_enabled_units';
const STORAGE_KEY_CUSTOM = 'billingmaster_custom_units';
const STORAGE_KEY_STARRED = 'billingmaster_starred_units';

const EXCLUDED_CODES = new Set([
  'lic', 'service', 'hr', 'day', 'visit', 'project',
  'set', 'pack', 'grs', 'bag', 'ctn', 'bndl', 'roll', 'coil', 'can', 'bucket', 'jar', 'sheet', 'strip', 'sachet', 'tray', 'crate', 'barrel', 'bale', 'tube', 'tin',
  'mg', 'lb', 'oz',
  'plate', 'cup', 'glass', 'bowl', 'portion', 'scoop', 'slice',
  'mo', 'gb', 'mb', 'tb',
  'cl', 'gal', 'fl_oz', 'm3', 'sqyd', 'sqin', 'acre', 'decimal', 'km'
]);

export function getDefaultEnabledCodes(): string[] {
  return MASTER_UNITS_LIST.filter(u => u.defaultEnabled).map(u => u.value);
}

export function getDefaultStarredCodes(): string[] {
  return [
    'pcs', 'kg', 'g', 'litre', 'ml', 
    'mtr', 'yd', 'thn', 'ft', 'in', 
    'sqft', 'cft', 
    'box', 'pkt', 'pr', 'dzn', 'qtl', 'ton'
  ];
}

export function getStoredStarredCodes(): string[] {
  const defaultStarred = getDefaultStarredCodes().filter(c => !EXCLUDED_CODES.has(c));
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STARRED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...defaultStarred, ...parsed])).filter(c => !EXCLUDED_CODES.has(c));
      }
    }
  } catch (e) {
    console.error('Failed to parse stored starred unit codes:', e);
  }
  return defaultStarred;
}

export function saveStarredCodes(starredCodes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(starredCodes.filter(c => !EXCLUDED_CODES.has(c))));
  } catch (e) {
    console.error('Failed to save starred unit codes:', e);
  }
}

export function getStoredCustomUnits(): MasterUnit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(u => !EXCLUDED_CODES.has(u.value));
    }
  } catch (e) {
    console.error('Failed to parse stored custom units:', e);
  }
  return [];
}

export function getStoredEnabledCodes(): string[] {
  const defaultCodes = getDefaultEnabledCodes().filter(c => !EXCLUDED_CODES.has(c));
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENABLED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...defaultCodes, ...parsed])).filter(c => !EXCLUDED_CODES.has(c));
      }
    }
  } catch (e) {
    console.error('Failed to parse stored enabled unit codes:', e);
  }
  return defaultCodes;
}

export function saveUnitSettings(enabledCodes: string[], customUnits: MasterUnit[], starredCodes?: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(enabledCodes.filter(c => !EXCLUDED_CODES.has(c))));
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customUnits.filter(u => !EXCLUDED_CODES.has(u.value))));
    if (starredCodes) {
      localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(starredCodes.filter(c => !EXCLUDED_CODES.has(c))));
    }
  } catch (e) {
    console.error('Failed to save unit settings to localStorage:', e);
  }
}

export function getCombinedUnits(customUnits: MasterUnit[] = getStoredCustomUnits()): MasterUnit[] {
  return [...MASTER_UNITS_LIST, ...customUnits].filter(u => !EXCLUDED_CODES.has(u.value));
}

export function getDropdownOptionsForUnits(
  enabledCodes: string[], 
  currentUnit?: string, 
  starredCodes: string[] = getStoredStarredCodes()
): { label: string; value: string; hint: string }[] {
  const allUnits = getCombinedUnits();
  const defaultCodes = getDefaultEnabledCodes().filter(c => !EXCLUDED_CODES.has(c));
  const enabledSet = new Set([...defaultCodes, ...enabledCodes]);
  const starredSet = new Set(starredCodes);

  let list = allUnits.filter(u => enabledSet.has(u.value) && !EXCLUDED_CODES.has(u.value));

  // If existing product has a unit that's not currently enabled, keep it visible so data isn't hidden
  if (currentUnit) {
    const lower = currentUnit.toLowerCase();
    const alreadyIncluded = list.some(u => u.value.toLowerCase() === lower);
    if (!alreadyIncluded && !EXCLUDED_CODES.has(lower)) {
      const existingInMaster = allUnits.find(u => u.value.toLowerCase() === lower);
      if (existingInMaster) {
        list.push(existingInMaster);
      } else {
        list.push({
          value: currentUnit,
          label: `${currentUnit.toUpperCase()} — Custom Unit`,
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
