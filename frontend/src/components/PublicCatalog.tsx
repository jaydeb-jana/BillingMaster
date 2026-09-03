import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import {
  Store, Search, Phone, MessageSquare, AlertCircle, CheckCircle2,
  Package, X, Share2, Filter, ShoppingBag
} from 'lucide-react';
import { db } from '@/lib/api';

// Helper to extract product image safely
function getProductImageUrl(p: any): string {
  if (!p) return '';
  if (p.image_url) return p.image_url;
  if (p.image) return p.image;
  if (p.photo_url) return p.photo_url;
  if (p.notes && typeof p.notes === 'string' && (p.notes.startsWith('{') || p.notes.startsWith('['))) {
    try {
      const parsed = JSON.parse(p.notes);
      if (parsed.image_url) return parsed.image_url;
      if (parsed.image) return parsed.image;
    } catch (e) {}
  }
  return '';
}

export function PublicCatalog() {
  const params = useParams<{ id?: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outstock' | 'lowstock'>('all');

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      try {
        setLoading(true);
        const [prods, bizes] = await Promise.all([
          db.list('products', {}).catch(() => []),
          db.list('businesses', {}).catch(() => []),
        ]);
        if (active) {
          setProducts(prods || []);
          if (bizes && bizes.length > 0) {
            setBusiness(bizes[0]);
          }
        }
      } catch (err) {
        console.error('Error loading public catalog:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCatalog();
    return () => { active = false; };
  }, [params.id]);

  const businessName = business?.name || 'BillingMaster Enterprise';
  const businessPhone = business?.phone || '+91 98765 43210';

  const inStockCount = products.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) > 4).length;
  const lowStockCount = products.filter(p => {
    const qty = Number(p.stock_quantity ?? p.stock ?? 0);
    return qty > 0 && qty <= 4;
  }).length;
  const outOfStockCount = products.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) <= 0).length;

  const filteredProducts = products.filter((p) => {
    const qty = Number(p.stock_quantity ?? p.stock ?? 0);
    const matchesSearch = !search ||
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.hsn_code && String(p.hsn_code).includes(search));

    if (!matchesSearch) return false;
    if (stockFilter === 'instock') return qty > 4;
    if (stockFilter === 'lowstock') return qty > 0 && qty <= 4;
    if (stockFilter === 'outstock') return qty <= 0;
    return true;
  });

  const openWhatsApp = (productName?: string) => {
    const cleanPhone = businessPhone.replace(/[^0-9]/g, '');
    const msg = productName
      ? `Hello ${businessName}! I am viewing your online catalog and am interested in: "${productName}". Please let me know the availability and ordering process.`
      : `Hello ${businessName}! I am viewing your online product catalog. Please assist me with product inquiries.`;
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Store size={22} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">{businessName}</h1>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Digital Product Catalog</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => openWhatsApp()}
            className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-2xs"
          >
            <MessageSquare size={15} />
            <span className="hidden sm:inline">Contact</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6 pb-20">


        {/* Stock Overview Stat Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/80 bg-card p-4 text-center shadow-2xs">
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Total Catalog Items</p>
            <p className="text-xl font-black text-foreground mt-1">{products.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center shadow-2xs">
            <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">In Stock</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{inStockCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center shadow-2xs">
            <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Low Stock</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{lowStockCount}</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center shadow-2xs">
            <p className="text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider">Out of Stock</p>
            <p className="text-xl font-black text-red-600 dark:text-red-400 mt-1">{outOfStockCount}</p>
          </div>
        </div>

        {/* Search & Stock Filter Bar */}
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, category, or HSN code..."
              className="w-full rounded-2xl bg-card border border-border/80 pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setStockFilter('all')}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                stockFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border/80 text-muted-foreground hover:bg-muted'
              }`}
            >
              All Items ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('instock')}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                stockFilter === 'instock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              In Stock ({inStockCount})
            </button>
            <button
              onClick={() => setStockFilter('lowstock')}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                stockFilter === 'lowstock'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('outstock')}
              className={`rounded-xl px-3.5 py-1.5 font-bold transition-colors whitespace-nowrap ${
                stockFilter === 'outstock'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-muted-foreground">Loading catalog items...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-border/80 bg-card p-12 text-center space-y-3">
            <Package size={40} className="mx-auto text-muted-foreground/40" />
            <h3 className="text-sm font-bold text-foreground">No Products Found</h3>
            <p className="text-xs text-muted-foreground">Try adjusting your search query or filter selection.</p>
            <button
              onClick={() => { setSearch(''); setStockFilter('all'); }}
              className="text-xs font-extrabold text-primary hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const qty = Number(p.stock_quantity ?? p.stock ?? 0);
              const unit = p.unit || 'pcs';
              const price = Number(p.selling_price || p.price || 0);
              const imgUrl = getProductImageUrl(p);

              let badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              let statusText = `In Stock (${qty} ${unit})`;
              if (qty <= 0) {
                badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                statusText = `Out of Stock (0 ${unit})`;
              } else if (qty <= 4) {
                badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                statusText = `Low Stock (${qty} ${unit})`;
              }

              return (
                <div
                  key={p.id}
                  className="group rounded-3xl border border-border/80 bg-card p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {imgUrl && (
                      <div className="relative mb-3 h-44 w-full overflow-hidden rounded-2xl bg-muted/30 border border-border/50">
                        <img
                          src={imgUrl}
                          alt={p.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {p.name}
                      </h4>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${badgeColor}`}>
                        {statusText}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Category: {p.category || p.category_name || 'General'}</span>
                      {p.hsn_code && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono font-bold">
                          HSN {p.hsn_code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Retail Price</p>
                      <p className="text-base font-black text-primary">₹{price.toLocaleString('en-IN')}</p>
                    </div>

                    <button
                      onClick={() => openWhatsApp(p.name)}
                      className="rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Contact on WhatsApp"
                    >
                      <MessageSquare size={13} />
                      <span>Inquire</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
