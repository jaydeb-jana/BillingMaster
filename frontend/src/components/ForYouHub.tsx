import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles, FileText, Calendar, Share2, Users, BarChart3, Store,
  Send, Gift, CheckCircle2, Calculator, ArrowRight, Download,
  ExternalLink, Copy, Check, Clock, ShieldCheck, DollarSign,
  TrendingUp, RefreshCw, X, MessageSquare, Phone, Percent,
  Building2, Briefcase, Plus, FileSpreadsheet, AlertCircle,
  QrCode, Printer, Smartphone, ChevronRight, ChevronDown, CheckCheck, Mail, Search, Pencil, Sliders, Barcode, MapPin, Navigation, Globe, Trash2,
  Eye, EyeOff, Server, Key, Loader2, AlertTriangle, BadgeCheck, Settings, Shuffle, RotateCcw
} from 'lucide-react';
import { db, auth, request, getBusinessCatalogHandle, checkCatalogHandleAvailability, getBusinessId } from '@/lib/api';
import { useScrollReset, resetScrollRef, useBodyScrollLock } from '@/lib/useScrollReset';
import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';
import jsPDF from 'jspdf';
import { CatalogQrModal } from '@/components/CatalogQrModal';

interface ForYouHubProps {
  onNavigate?: (path: string) => void;
}

function LocationMapPickerModal({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number | null, lng: number | null, address?: string) => void;
  onClose: () => void;
}) {
  const defaultLat = initialLat || 22.5726; // Default Kolkata / India fallback
  const defaultLng = initialLng || 88.3639;
  const [lat, setLat] = useState<number>(defaultLat);
  const [lng, setLng] = useState<number>(defaultLng);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const mapRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const leafletMarkerInstance = useRef<any>(null);

  // Click-outside listener to dismiss search results when tapping anywhere
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initMap() {
      if (!(window as any).L) {
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        if (!document.getElementById('leaflet-js')) {
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(script);
          await new Promise((resolve) => { script.onload = resolve; });
        }
      }

      const L = (window as any).L;
      if (L && mapRef.current && isMounted) {
        if (leafletMapInstance.current) {
          leafletMapInstance.current.remove();
        }

        const map = L.map(mapRef.current).setView([lat, lng], 13);
        leafletMapInstance.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        leafletMarkerInstance.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          if (isMounted) {
            setLat(pos.lat);
            setLng(pos.lng);
            setSearchResults([]);
          }
        });

        map.on('click', (e: any) => {
          const clickLat = e.latlng.lat;
          const clickLng = e.latlng.lng;
          marker.setLatLng([clickLat, clickLng]);
          if (isMounted) {
            setLat(clickLat);
            setLng(clickLng);
            setSearchResults([]);
          }
        });
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  const updateMapPosition = (newLat: number, newLng: number, zoomLevel = 16) => {
    setLat(newLat);
    setLng(newLng);
    if (leafletMapInstance.current && leafletMarkerInstance.current) {
      leafletMapInstance.current.setView([newLat, newLng], zoomLevel);
      leafletMarkerInstance.current.setLatLng([newLat, newLng]);
    }
  };

  const handleSearchLocation = async () => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) return;

    try {
      setSearching(true);

      // 1. Check if user pasted Lat,Lng coordinates or Google Maps URL with coordinates
      const coordMatch = rawQuery.match(/(-?\d+\.\d+)\s*[,:\s]\s*(-?\d+\.\d+)/);
      if (coordMatch) {
        const pLat = parseFloat(coordMatch[1]);
        const pLng = parseFloat(coordMatch[2]);
        if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
          updateMapPosition(pLat, pLng, 17);
          toast.success(`Position set to coordinates: ${pLat.toFixed(4)}°, ${pLng.toFixed(4)}°`);

          // Reverse geocode to fetch human readable address
          try {
            const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pLat}&lon=${pLng}`, {
              headers: { 'Accept-Language': 'en' },
            });
            const revData = await revRes.json();
            if (revData && revData.display_name) {
              setSelectedAddress(revData.display_name);
            }
          } catch (err) {
            console.error('Reverse geocode error:', err);
          }
          setSearchResults([]);
          return;
        }
      }

      // 2. Multi-tier text search for Indian locations & landmarks
      // Tier 1: Search restricted to India with countrycodes=in
      let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=in&q=${encodeURIComponent(rawQuery)}`;
      let res = await fetch(searchUrl, { headers: { 'Accept-Language': 'en' } });
      let data = await res.json();

      // Tier 2: If no results found, append ', India' and retry
      if (!data || data.length === 0) {
        const isIndiaIncluded = /india|\bin\b/i.test(rawQuery);
        if (!isIndiaIncluded) {
          const fallbackIndiaUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=in&q=${encodeURIComponent(rawQuery + ', India')}`;
          res = await fetch(fallbackIndiaUrl, { headers: { 'Accept-Language': 'en' } });
          data = await res.json();
        }
      }

      // Tier 3: Global fallback if India-restricted queries return no results
      if (!data || data.length === 0) {
        const globalUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(rawQuery)}`;
        res = await fetch(globalUrl, { headers: { 'Accept-Language': 'en' } });
        data = await res.json();
      }

      if (data && data.length > 0) {
        setSearchResults(data);
        const first = data[0];
        const nLat = parseFloat(first.lat);
        const nLng = parseFloat(first.lon);
        updateMapPosition(nLat, nLng, 16);
        setSelectedAddress(first.display_name);
        toast.success(`Found ${data.length} matching location(s)`);
      } else {
        toast.error('No matching Indian locations found. Try adding city or state name (e.g. Park Street, Kolkata).');
        setSearchResults([]);
      }
    } catch (e) {
      console.error('Error searching location:', e);
      toast.error('Failed to search location.');
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        updateMapPosition(uLat, uLng, 17);
        toast.success(`GPS Location set: ${uLat.toFixed(4)}°, ${uLng.toFixed(4)}°`);
      },
      (err) => {
        console.error('GPS error:', err);
        toast.error('Could not access GPS location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="card-shell w-full max-w-2xl p-6 animate-rise shadow-2xl border border-border flex flex-col space-y-4 max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Interactive Store Location Picker</h3>
              <p className="text-xs text-muted-foreground font-medium">Search address or click on map to pinpoint store location</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & GPS button */}
        <div ref={searchWrapperRef} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchLocation();
                  if (e.key === 'Escape') setSearchResults([]);
                }}
                placeholder="Search Indian city, area, pincode, shop name or paste Google Maps Lat,Lng..."
                className="w-full rounded-xl bg-background border border-border pl-9 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md transition-colors"
                  title="Clear search query"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchLocation}
              disabled={searching || !searchQuery.trim()}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs shrink-0"
            >
              {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchResults([]);
                handleUseCurrentGPS();
              }}
              className="rounded-xl bg-card border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
              title="Detect Current GPS Location"
            >
              <Navigation size={14} className="text-rose-500" />
              <span className="hidden sm:inline">Use GPS</span>
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 pl-1">
            <Sparkles size={11} className="text-amber-500 shrink-0" />
            <span>Search Indian places (e.g. Park Street Kolkata, Barasat) or paste Lat,Lng (e.g. 22.5726, 88.3639)</span>
          </p>

          {searchResults.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-2 max-h-40 overflow-y-auto divide-y divide-border/60 text-xs shadow-lg animate-in fade-in duration-100">
              {searchResults.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const rLat = parseFloat(r.lat);
                    const rLng = parseFloat(r.lon);
                    updateMapPosition(rLat, rLng, 17);
                    setSelectedAddress(r.display_name);
                    setSearchResults([]);
                  }}
                  className="p-2.5 hover:bg-muted/70 cursor-pointer transition-colors flex items-center justify-between gap-3 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className="font-semibold text-foreground truncate">{r.display_name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                    Pin Here
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Canvas Container */}
        <div
          onClick={() => setSearchResults([])}
          className="relative min-h-[300px] w-full rounded-2xl overflow-hidden border border-border shadow-inner bg-muted/30"
        >
          <div ref={mapRef} className="h-[300px] w-full z-10" />
        </div>

        {/* Status & Confirm Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Selected Store Coordinates</p>
            <p className="text-xs font-mono font-bold text-foreground truncate">
              {lat.toFixed(6)}° N, {lng.toFixed(6)}° E
            </p>
            {selectedAddress && (
              <p className="text-[11px] text-muted-foreground font-medium truncate max-w-md">{selectedAddress}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(initialLat != null || initialLng != null) && (
              <button
                type="button"
                onClick={() => onConfirm(null, null, '')}
                className="rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 px-3.5 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Remove set store location coordinates"
              >
                <Trash2 size={13} />
                <span>Remove Location</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(lat, lng, selectedAddress)}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-extrabold flex items-center gap-1.5 shadow-md"
            >
              <Check size={15} />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface EmailTemplateConfig {
  id: string;
  name: string;
  shortName?: string;
  category: 'Billing & Sales' | 'Customer Care' | 'Reminders';
  subject: string;
  headerTitle: string;
  bodyText: string;
  ctaText: string;
  accentColor: string;
  isCustomized?: boolean;
}

const DEFAULT_EMAIL_TEMPLATES: EmailTemplateConfig[] = [
  {
    id: 'invoice_created',
    name: 'Invoice Created (Tax Invoice)',
    shortName: 'Invoice Created',
    category: 'Billing & Sales',
    subject: 'Tax Invoice #{invoice_number} from {store_name}',
    headerTitle: 'Tax Invoice & Bill Summary',
    bodyText: 'Dear {customer_name},\n\nThank you for shopping with {store_name}! Your tax invoice #{invoice_number} for total amount ₹{grand_total} has been issued.\n\nPlease find your bill summary below. You can view or download your detailed invoice anytime using the button below.\n\nThank you for your business!',
    ctaText: 'View & Download Invoice',
    accentColor: '#f97316',
  },
  {
    id: 'payment_receipt',
    name: 'Payment Receipt Confirmation',
    shortName: 'Payment Receipt',
    category: 'Billing & Sales',
    subject: 'Payment Received for Invoice #{invoice_number} - {store_name}',
    headerTitle: 'Payment Receipt & Confirmation',
    bodyText: 'Dear {customer_name},\n\nWe have successfully received your payment of ₹{grand_total} for invoice #{invoice_number}.\n\nYour account balance is now updated. Thank you for your prompt payment and continued partnership!',
    ctaText: 'View Receipt Details',
    accentColor: '#16a34a',
  },
  {
    id: 'payment_reminder',
    name: 'Payment Due Notice',
    shortName: 'Payment Due',
    category: 'Reminders',
    subject: 'Reminder: Invoice #{invoice_number} Payment Due - {store_name}',
    headerTitle: 'Payment Due Reminder',
    bodyText: 'Dear {customer_name},\n\nThis is a friendly reminder that invoice #{invoice_number} for ₹{grand_total} is due on {due_date}.\n\nPlease clear your balance at your earliest convenience to maintain active services and uninterrupted support.',
    ctaText: 'Pay / Clear Balance',
    accentColor: '#dc2626',
  },
  {
    id: 'welcome_customer',
    name: 'Welcome New Customer',
    shortName: 'Welcome Customer',
    category: 'Customer Care',
    subject: 'Welcome to {store_name}!',
    headerTitle: 'Welcome to Our Store!',
    bodyText: 'Dear {customer_name},\n\nWelcome to {store_name}! We are thrilled to have you onboard as a valued customer.\n\nShould you need any assistance, product quotes, or billing support, our team is always ready to support you.',
    ctaText: 'Explore Catalog & Offers',
    accentColor: '#2563eb',
  },
  {
    id: 'retarget_customer',
    name: 'Customer Retargeting',
    shortName: 'Customer Retargeting',
    category: 'Customer Care',
    subject: 'We Miss You at {store_name}! Is Everything Okay?',
    headerTitle: 'Customer Care & Satisfaction Check',
    bodyText: 'Dear {customer_name},\n\nWe noticed it has been a while since your last purchase at {store_name}! We hope everything is going well.\n\nWas there any issue or concern with your previous order? Your satisfaction is our top priority! If you experienced any inconvenience, need product support, or have feedback for us, please let us know by replying to this email.\n\nWe would love to welcome you back with our latest arrivals and exclusive member benefits!',
    ctaText: 'Visit Store & View Offers',
    accentColor: '#8b5cf6',
  },
];

const renderSampleText = (text: string, storeName?: string) => {
  if (!text) return '';
  const actualStore = storeName || 'BillingMaster Store';
  return text
    .replace(/{store_name}/g, actualStore)
    .replace(/{customer_name}/g, 'Rahul Banerjee')
    .replace(/{invoice_number}/g, 'INV-2026-0842')
    .replace(/{grand_total}/g, '14,850.00')
    .replace(/{amount_paid}/g, '14,850.00')
    .replace(/{due_date}/g, '15 Sep 2026')
    .replace(/{quote_number}/g, 'QT-2026-0034')
    .replace(/{valid_until}/g, '20 Sep 2026')
    .replace(/{payment_link}/g, '#');
};

export function ForYouHub({ onNavigate }: ForYouHubProps) {
  const [, setLocation] = useLocation();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  useScrollReset(activeModal);

  // Workspace data
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom Catalog Handle Edit State
  const [isEditingCatalogHandle, setIsEditingCatalogHandle] = useState(false);
  const [catalogHandleInput, setCatalogHandleInput] = useState('');
  const [savingCatalogHandle, setSavingCatalogHandle] = useState(false);
  const [handleAvailabilityState, setHandleAvailabilityState] = useState<'unchecked' | 'checking' | 'available' | 'taken' | 'invalid'>('unchecked');
  const [checkedHandleText, setCheckedHandleText] = useState('');
  const [suggestedHandles, setSuggestedHandles] = useState<string[]>([]);

  // Copied feedback & search states
  const [copied, setCopied] = useState(false);
  const [hsnSearchQuery, setHsnSearchQuery] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogStockFilter, setCatalogStockFilter] = useState<'all' | 'instock' | 'outstock' | 'lowstock'>('all');

  // Store Catalog Preferences & Geofencing State
  const [isStoreEnabled, setIsStoreEnabled] = useState<boolean>(true);
  const [showSalesRate, setShowSalesRate] = useState<boolean>(true);
  const [showBarcodes, setShowBarcodes] = useState<boolean>(true);
  const [locationRadiusKm, setLocationRadiusKm] = useState<string>('');
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const [detectingStoreGps, setDetectingStoreGps] = useState<boolean>(false);
  const [showLocationMapModal, setShowLocationMapModal] = useState<boolean>(false);
  const [savingCatalogSettings, setSavingCatalogSettings] = useState<boolean>(false);

  // Initial / Saved State for dirty tracking
  const [savedSettings, setSavedSettings] = useState<{
    isStoreEnabled: boolean;
    showSalesRate: boolean;
    showBarcodes: boolean;
    locationRadiusKm: string;
    storeLat: number | null;
    storeLng: number | null;
  }>({
    isStoreEnabled: true,
    showSalesRate: true,
    showBarcodes: true,
    locationRadiusKm: '',
    storeLat: null,
    storeLng: null,
  });

  const isSettingsDirty = useMemo(() => {
    if (isStoreEnabled !== savedSettings.isStoreEnabled) return true;
    if (showSalesRate !== savedSettings.showSalesRate) return true;
    if (showBarcodes !== savedSettings.showBarcodes) return true;
    if (locationRadiusKm !== savedSettings.locationRadiusKm) return true;
    if (storeLat !== savedSettings.storeLat) return true;
    if (storeLng !== savedSettings.storeLng) return true;
    return false;
  }, [isStoreEnabled, showSalesRate, showBarcodes, locationRadiusKm, storeLat, storeLng, savedSettings]);

  const handleSetRadiusValue = (val: string) => {
    const numVal = Number(val);
    if (val.trim() !== '' && numVal > 0 && (storeLat == null || storeLng == null)) {
      toast.error('Please set your store location coordinates first! Use "Pick Location on Map" or "Detect GPS".');
      setShowLocationMapModal(true);
      return;
    }
    setLocationRadiusKm(val);
  };

  // Load active business & workspace data
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        const session = auth.session();
        const activeBid = await getBusinessId();
        const [prods, invs, custs, exps, bizes, settingsList] = await Promise.all([
          db.list('products', {}).catch(() => []),
          db.list('invoices', {}).catch(() => []),
          db.list('customers', {}).catch(() => []),
          db.list('expenses', {}).catch(() => []),
          db.list('businesses', activeBid ? { id: activeBid } : {}).catch(() => []),
          db.list('settings', activeBid ? { business_id: activeBid } : {}).catch(() => []),
        ]);
        if (active) {
          setProducts(prods || []);
          setInvoices(invs || []);
          setCustomers(custs || []);
          setExpenses(exps || []);
          if (bizes && bizes.length > 0) {
            const matched = bizes.find((b: any) => activeBid && String(b.id) === String(activeBid)) || bizes[0];
            setBusiness(matched);
          }
          if (settingsList && settingsList.length > 0) {
            const s = settingsList.find((st: any) => activeBid && String(st.business_id) === String(activeBid)) || settingsList[0];
            const initStoreEnabled = s.is_catalog_enabled !== undefined && s.is_catalog_enabled !== null ? Boolean(Number(s.is_catalog_enabled)) : true;
            const initSales = s.show_sales_rate !== undefined && s.show_sales_rate !== null ? Boolean(Number(s.show_sales_rate)) : true;
            const initBarcodes = s.show_barcodes !== undefined && s.show_barcodes !== null ? Boolean(Number(s.show_barcodes)) : true;
            const initRadius = s.location_radius_km !== undefined && s.location_radius_km !== null ? String(s.location_radius_km) : '';
            const initLat = s.store_lat !== undefined && s.store_lat !== null ? Number(s.store_lat) : null;
            const initLng = s.store_lng !== undefined && s.store_lng !== null ? Number(s.store_lng) : null;

            setIsStoreEnabled(initStoreEnabled);
            setShowSalesRate(initSales);
            setShowBarcodes(initBarcodes);
            setLocationRadiusKm(initRadius);
            setStoreLat(initLat);
            setStoreLng(initLng);

            setSavedSettings({
              isStoreEnabled: initStoreEnabled,
              showSalesRate: initSales,
              showBarcodes: initBarcodes,
              locationRadiusKm: initRadius,
              storeLat: initLat,
              storeLng: initLng,
            });
          }
        }
      } catch (err) {
        console.error('Error loading for-you data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  const handleSaveAllCatalogSettings = async (overrideUpdates?: Record<string, any>) => {
    try {
      setSavingCatalogSettings(true);
      const activeBid = business?.id || (await getBusinessId());
      if (!activeBid) return;

      const targetStoreEnabled = overrideUpdates?.is_catalog_enabled !== undefined ? Boolean(overrideUpdates.is_catalog_enabled) : isStoreEnabled;
      const targetSalesRate = overrideUpdates?.show_sales_rate !== undefined ? Boolean(overrideUpdates.show_sales_rate) : showSalesRate;
      const targetBarcodes = overrideUpdates?.show_barcodes !== undefined ? Boolean(overrideUpdates.show_barcodes) : showBarcodes;
      const targetRadiusStr = overrideUpdates?.location_radius_km !== undefined 
        ? (overrideUpdates.location_radius_km === null ? '' : String(overrideUpdates.location_radius_km)) 
        : locationRadiusKm;
      const targetLat = overrideUpdates?.store_lat !== undefined ? overrideUpdates.store_lat : storeLat;
      const targetLng = overrideUpdates?.store_lng !== undefined ? overrideUpdates.store_lng : storeLng;

      const numRadius = targetRadiusStr.trim() === '' || Number(targetRadiusStr) <= 0 ? null : Number(targetRadiusStr);
      const payload = {
        business_id: activeBid,
        is_catalog_enabled: targetStoreEnabled ? 1 : 0,
        show_sales_rate: targetSalesRate ? 1 : 0,
        show_barcodes: targetBarcodes ? 1 : 0,
        location_radius_km: numRadius,
        store_lat: targetLat,
        store_lng: targetLng,
        ...(overrideUpdates || {}),
      };
      await db.upsert('settings', payload);

      setSavedSettings({
        isStoreEnabled: targetStoreEnabled,
        showSalesRate: targetSalesRate,
        showBarcodes: targetBarcodes,
        locationRadiusKm: targetRadiusStr,
        storeLat: targetLat,
        storeLng: targetLng,
      });

      toast.success('Catalog preferences & geofencing saved!');
    } catch (err: any) {
      console.error('Error saving catalog settings:', err);
      toast.error('Failed to save catalog preferences.');
    } finally {
      setSavingCatalogSettings(false);
    }
  };

  const businessName = business?.name || 'BillingMaster';
  const businessPhone = business?.phone || '+91 98765 43210';
  const businessGstin = business?.gstin || '';
  const currentCatalogHandle = getBusinessCatalogHandle(business);
  const storeUrl = typeof window !== 'undefined' ? `${window.location.origin}/catalog/${currentCatalogHandle}` : `/catalog/${currentCatalogHandle}`;

  // Smart Calculator State
  const [calcMode, setCalcMode] = useState<'gst' | 'margin' | 'reverse'>('gst');
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcGstRate, setCalcGstRate] = useState<number>(18);
  const [calcCostPrice, setCalcCostPrice] = useState<number>(500);
  const [calcSellingPrice, setCalcSellingPrice] = useState<number>(750);

  // Attendance State (Local Persistence)
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [staffList, setStaffList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lms_staff_attendance');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Rahul Sharma', role: 'Store Manager', status: 'present', salary: 25000, advance: 0 },
      { id: '2', name: 'Amit Kumar', role: 'Billing Operator', status: 'present', salary: 18000, advance: 2000 },
      { id: '3', name: 'Pooja Verma', role: 'Sales Associate', status: 'half_day', salary: 15000, advance: 0 },
      { id: '4', name: 'Vikram Singh', role: 'Inventory Executive', status: 'present', salary: 16000, advance: 0 },
    ];
  });

  const updateStaffStatus = (id: string, status: string) => {
    const updated = staffList.map(s => s.id === id ? { ...s, status } : s);
    setStaffList(updated);
    localStorage.setItem('lms_staff_attendance', JSON.stringify(updated));
  };

  // WhatsApp Marketing State
  const [selectedCampaign, setSelectedCampaign] = useState<string>('festive');
  const [customMsg, setCustomMsg] = useState<string>(
    `🎉 Exclusive Special Offer from ${businessName}!\nGet up to 20% discount on top products this week. Visit us or place your order directly on WhatsApp!\n\n📞 Call/WhatsApp: ${businessPhone}`
  );
  const [targetCustomer, setTargetCustomer] = useState<string>('all');

  // Email Marketing & Nodemailer SMTP State
  const [emailSubTab, setEmailSubTab] = useState<'setup' | 'campaign'>('setup');
  const [selectedEmailCampaign, setSelectedEmailCampaign] = useState<string>('offers');
  const [emailSubject, setEmailSubject] = useState<string>(`✨ Special Offer & New Arrivals from ${businessName}`);
  const [emailBody, setEmailBody] = useState<string>(
    `Dear Valued Customer,\n\nWe are delighted to share our latest product arrivals and exclusive promotions at ${businessName}.\n\nVisit our store or contact us directly to explore our curated catalog with exclusive seasonal savings!\n\nBest regards,\n${businessName}\nPhone: ${businessPhone}`
  );
  const [emailCopied, setEmailCopied] = useState<boolean>(false);

  // Multiple Gmail Accounts State & Persistence
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountConfig[]>(() => {
    try {
      const raw = localStorage.getItem('billingmaster_gmail_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse billingmaster_gmail_accounts', e);
    }

    // Migration from single legacy account
    const legacyUser = localStorage.getItem('billingmaster_smtp_user');
    const legacyPass = localStorage.getItem('billingmaster_smtp_pass');
    const legacySender = localStorage.getItem('billingmaster_smtp_sender_name');
    const legacyVerified = localStorage.getItem('billingmaster_smtp_verified') === 'true';

    if (legacyUser && legacyPass) {
      const migrated: GmailAccountConfig[] = [{
        id: 'gmail_' + Date.now(),
        senderName: legacySender || businessName || '',
        user: legacyUser,
        pass: legacyPass,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        isDefault: true,
        isVerified: legacyVerified,
      }];
      localStorage.setItem('billingmaster_gmail_accounts', JSON.stringify(migrated));
      return migrated;
    }
    return [];
  });

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAddingEmail, setIsAddingEmail] = useState<boolean>(false);
  const [testRecipients, setTestRecipients] = useState<Record<string, string>>({});
  const [testingAccId, setTestingAccId] = useState<string | null>(null);

  // Form Fields State
  const [smtpSenderName, setSmtpSenderName] = useState<string>('');
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(465);
  const [smtpSecure, setSmtpSecure] = useState<boolean>(true);
  const [smtpVerified, setSmtpVerified] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);

  // Reset Gmail Studio add/edit form state whenever modal is dismissed
  useEffect(() => {
    if (activeModal !== 'email-marketing') {
      setIsAddingEmail(false);
      setEditingAccountId(null);
      setSmtpSenderName('');
      setSmtpUser('');
      setSmtpPass('');
      setShowSmtpPass(false);
    }
  }, [activeModal]);

  // Dispatch Strategy & Per-Account Limit States
  const [selectedDispatchAccountIds, setSelectedDispatchAccountIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('billingmaster_selected_gmail_account_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Automatically initialize all connected accounts if selection is empty
  useEffect(() => {
    if (gmailAccounts.length > 0 && selectedDispatchAccountIds.length === 0) {
      const initialIds = gmailAccounts.map(a => a.id);
      setSelectedDispatchAccountIds(initialIds);
      localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(initialIds));
    }
  }, [gmailAccounts]);

  const [dailyMessageLimit, setDailyMessageLimit] = useState<number>(() => {
    const raw = localStorage.getItem('billingmaster_email_daily_limit_per_acc');
    const val = raw ? parseInt(raw, 10) || 400 : 400;
    return Math.min(450, val);
  });

  const [showDispatchSettingsModal, setShowDispatchSettingsModal] = useState<boolean>(false);
  const [showCatalogQrModal, setShowCatalogQrModal] = useState<boolean>(false);

  // Email Template Manager States & Persistence
  const [showTemplateManagerModal, setShowTemplateManagerModal] = useState<boolean>(false);
  const isAnyModalOpen = Boolean(activeModal || showDispatchSettingsModal || showTemplateManagerModal || showLocationMapModal || showCatalogQrModal);
  useBodyScrollLock(isAnyModalOpen);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateConfig[]>(() => {
    try {
      const raw = localStorage.getItem('billingmaster_email_templates');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return DEFAULT_EMAIL_TEMPLATES.map(def => {
            const found = parsed.find((p: any) => p.id === def.id);
            return found ? { ...def, ...found, isCustomized: true } : def;
          });
        }
      }
    } catch (e) {}
    return DEFAULT_EMAIL_TEMPLATES;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('invoice_created');
  const [templateTabMode, setTemplateTabMode] = useState<'preview' | 'edit'>('preview');

  const activeTemplate = useMemo(() => {
    return emailTemplates.find(t => t.id === selectedTemplateId) || emailTemplates[0];
  }, [emailTemplates, selectedTemplateId]);

  const [editSubject, setEditSubject] = useState<string>('');
  const [editHeaderTitle, setEditHeaderTitle] = useState<string>('');
  const [editBodyText, setEditBodyText] = useState<string>('');
  const [editCtaText, setEditCtaText] = useState<string>('');
  const [editAccentColor, setEditAccentColor] = useState<string>('#f97316');

  // Sync edit form fields whenever active template changes or modal opens
  useEffect(() => {
    if (activeTemplate) {
      setEditSubject(activeTemplate.subject);
      setEditHeaderTitle(activeTemplate.headerTitle);
      setEditBodyText(activeTemplate.bodyText);
      setEditCtaText(activeTemplate.ctaText);
      setEditAccentColor(activeTemplate.accentColor);
    }
  }, [selectedTemplateId, showTemplateManagerModal]);

  const handleInsertTag = (tag: string, targetField: 'subject' | 'body' | 'header' | 'cta') => {
    if (targetField === 'subject') setEditSubject(prev => prev + ' ' + tag);
    if (targetField === 'header') setEditHeaderTitle(prev => prev + ' ' + tag);
    if (targetField === 'body') setEditBodyText(prev => prev + ' ' + tag);
    if (targetField === 'cta') setEditCtaText(prev => prev + ' ' + tag);
  };

  const handleSaveActiveTemplate = () => {
    const updated = emailTemplates.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          subject: editSubject,
          headerTitle: editHeaderTitle,
          bodyText: editBodyText,
          ctaText: editCtaText,
          accentColor: editAccentColor,
          isCustomized: true,
        };
      }
      return t;
    });
    setEmailTemplates(updated);
    localStorage.setItem('billingmaster_email_templates', JSON.stringify(updated));
    setShowTemplateManagerModal(false);
    setActiveModal(null);
    toast.success('Template Saved Successfully!', {
      description: `Customized settings saved for "${activeTemplate.name}".`,
    });
  };

  const handleResetActiveTemplate = () => {
    const defaultTpl = DEFAULT_EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!defaultTpl) return;

    setEditSubject(defaultTpl.subject);
    setEditHeaderTitle(defaultTpl.headerTitle);
    setEditBodyText(defaultTpl.bodyText);
    setEditCtaText(defaultTpl.ctaText);
    setEditAccentColor(defaultTpl.accentColor);

    const updated = emailTemplates.map(t => {
      if (t.id === selectedTemplateId) {
        return { ...defaultTpl, isCustomized: false };
      }
      return t;
    });
    setEmailTemplates(updated);
    localStorage.setItem('billingmaster_email_templates', JSON.stringify(updated));
    toast.info('Reset to System Default', {
      description: `Restored standard email layout for "${defaultTpl.name}".`,
    });
  };

  // Toggle account selection with minimum 1 account protection
  const toggleAccountSelection = (accId: string, shouldCheck: boolean) => {
    if (shouldCheck) {
      const updated = Array.from(new Set([...selectedDispatchAccountIds, accId]));
      setSelectedDispatchAccountIds(updated);
      localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(updated));
    } else {
      if (selectedDispatchAccountIds.length <= 1 && selectedDispatchAccountIds.includes(accId)) {
        toast.warning('At least 1 Gmail account must remain selected for sending emails.');
        return;
      }
      const updated = selectedDispatchAccountIds.filter(id => id !== accId);
      setSelectedDispatchAccountIds(updated);
      localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(updated));
    }
  };

  // Close or Back Handler for Gmail Studio Modal
  const handleCloseGmailStudio = () => {
    if (isAddingEmail) {
      setIsAddingEmail(false);
      setEditingAccountId(null);
      setSmtpSenderName('');
      setSmtpUser('');
      setSmtpPass('');
      setShowSmtpPass(false);
    } else {
      setActiveModal(null);
    }
  };

  // Open Form to Add New Gmail Account
  const handleOpenAddAccount = () => {
    if (gmailAccounts.length >= 20) {
      toast.warning('Maximum Limit Reached', {
        description: 'You can store up to a maximum of 20 Gmail accounts.',
      });
      return;
    }
    setEditingAccountId(null);
    setSmtpSenderName(businessName || '');
    setSmtpUser('');
    setSmtpPass('');
    setSmtpHost('smtp.gmail.com');
    setSmtpPort(465);
    setSmtpSecure(true);
    setSmtpVerified(false);
    setIsAddingEmail(true);
  };

  // Open Form to Edit Existing Gmail Account
  const handleOpenEditAccount = (acc: GmailAccountConfig) => {
    setEditingAccountId(acc.id);
    setSmtpSenderName(acc.senderName || businessName || '');
    setSmtpUser(acc.user);
    setSmtpPass(acc.pass);
    setSmtpHost(acc.host || 'smtp.gmail.com');
    setSmtpPort(acc.port || 465);
    setSmtpSecure(acc.secure !== false);
    setSmtpVerified(acc.isVerified);
    setIsAddingEmail(true);
  };

  // Save & Test Gmail Account Handler
  const handleTestAndSaveAccount = async () => {
    if (!smtpUser.trim() || !smtpPass.trim()) {
      toast.warning('Please enter both your Gmail address and Google App Password.');
      return;
    }
    if (!smtpUser.includes('@')) {
      toast.warning('Please enter a valid Gmail address (e.g. name@gmail.com).');
      return;
    }

    setIsTestingConnection(true);
    try {
      const res = await request('/api/email/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
        }),
      });

      if (res?.success) {
        const cleanUser = smtpUser.trim();
        const cleanPass = smtpPass.trim();
        const cleanSender = smtpSenderName.trim() || businessName;

        let updatedList: GmailAccountConfig[] = [...gmailAccounts];

        if (editingAccountId) {
          // Updating existing account
          updatedList = updatedList.map((a) => {
            if (a.id === editingAccountId) {
              return {
                ...a,
                senderName: cleanSender,
                user: cleanUser,
                pass: cleanPass,
                host: smtpHost.trim(),
                port: smtpPort,
                secure: smtpSecure,
                isVerified: true,
              };
            }
            return a;
          });
        } else {
          // Check if email already exists
          const existingIdx = updatedList.findIndex((a) => a.user.toLowerCase() === cleanUser.toLowerCase());
          if (existingIdx >= 0) {
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              senderName: cleanSender,
              pass: cleanPass,
              host: smtpHost.trim(),
              port: smtpPort,
              secure: smtpSecure,
              isVerified: true,
            };
          } else {
            if (updatedList.length >= 20) {
              toast.warning('Maximum Limit Reached', {
                description: 'You can store up to a maximum of 20 Gmail accounts.',
              });
              setIsTestingConnection(false);
              return;
            }
            // Adding brand new account
            const isFirst = updatedList.length === 0;
            const newAcc: GmailAccountConfig = {
              id: 'gmail_' + Date.now(),
              senderName: cleanSender,
              user: cleanUser,
              pass: cleanPass,
              host: smtpHost.trim(),
              port: smtpPort,
              secure: smtpSecure,
              isDefault: isFirst,
              isVerified: true,
            };
            updatedList.push(newAcc);

            // Auto-select newly added account for dispatching
            const newSelectedIds = [...selectedDispatchAccountIds, newAcc.id];
            setSelectedDispatchAccountIds(newSelectedIds);
            localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(newSelectedIds));
          }
        }

        setGmailAccounts(updatedList);
        localStorage.setItem('billingmaster_gmail_accounts', JSON.stringify(updatedList));

        // Sync primary for legacy fallback
        const primary = updatedList[0];
        if (primary) {
          localStorage.setItem('billingmaster_smtp_sender_name', primary.senderName);
          localStorage.setItem('billingmaster_smtp_user', primary.user);
          localStorage.setItem('billingmaster_smtp_pass', primary.pass);
          localStorage.setItem('billingmaster_smtp_verified', 'true');
        }

        setIsAddingEmail(false);
        setEditingAccountId(null);
        toast.success('Gmail Account Saved & Connected!', {
          description: `Successfully verified and saved ${cleanUser}.`,
        });
      } else {
        toast.error('Connection Failed', {
          description: res?.error || 'Could not verify Gmail SMTP credentials.',
        });
      }
    } catch (err: any) {
      console.error('SMTP connection test error:', err);
      toast.error('Connection Failed', {
        description: err?.message || 'Invalid Gmail App Password or SMTP configuration.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Delete Gmail Account Handler
  const handleDeleteAccount = (accId: string) => {
    const accToDelete = gmailAccounts.find((a) => a.id === accId);
    if (!accToDelete) return;

    const updated = gmailAccounts.filter((a) => a.id !== accId);
    setGmailAccounts(updated);
    localStorage.setItem('billingmaster_gmail_accounts', JSON.stringify(updated));

    const updatedSelectedIds = selectedDispatchAccountIds.filter(id => id !== accId);
    setSelectedDispatchAccountIds(updatedSelectedIds);
    localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(updatedSelectedIds));

    const primary = updated[0];
    if (primary) {
      localStorage.setItem('billingmaster_smtp_sender_name', primary.senderName);
      localStorage.setItem('billingmaster_smtp_user', primary.user);
      localStorage.setItem('billingmaster_smtp_pass', primary.pass);
      localStorage.setItem('billingmaster_smtp_verified', 'true');
    } else {
      localStorage.removeItem('billingmaster_smtp_user');
      localStorage.removeItem('billingmaster_smtp_pass');
      localStorage.removeItem('billingmaster_smtp_verified');
    }

    toast.success(`Removed ${accToDelete.user}`);
  };

  // Save Settings Handler
  const handleSaveDispatchSettings = () => {
    const safeLimit = Math.min(450, Math.max(1, dailyMessageLimit));
    if (dailyMessageLimit > 450) {
      setDailyMessageLimit(450);
    }
    localStorage.setItem('billingmaster_selected_gmail_account_ids', JSON.stringify(selectedDispatchAccountIds));
    localStorage.setItem('billingmaster_email_daily_limit_per_acc', safeLimit.toString());
    setShowDispatchSettingsModal(false);
    toast.success('Dispatch Settings Saved!', {
      description: `Active Accounts: ${selectedDispatchAccountIds.length > 0 ? selectedDispatchAccountIds.length : 'All'} • Daily Limit: ${safeLimit} msgs/account`,
    });
  };

  // Send Test Email for a specific Account
  const handleSendTestForAccount = async (acc: GmailAccountConfig) => {
    const customRecipient = testRecipients[acc.id]?.trim();
    const recipient = customRecipient || acc.user;

    if (!recipient || !recipient.includes('@')) {
      toast.warning('Please enter a valid recipient email address.');
      return;
    }

    setTestingAccId(acc.id);
    try {
      const res = await request('/api/email/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: acc.host || 'smtp.gmail.com',
          port: acc.port || 465,
          secure: acc.secure !== false,
          user: acc.user,
          pass: acc.pass,
          fromName: acc.senderName || businessName,
          recipients: [recipient],
          subject: `⚡ BillingMaster Test Email — ${acc.user}`,
          body: `Hello,\n\nThis is a test email sent from BillingMaster Gmail Studio via Gmail SMTP.\n\nAccount: ${acc.user}\nTime: ${new Date().toLocaleString('en-IN')}\n\nYour Gmail connection is working properly!`,
        }),
      });

      if (res?.success && res.totalSent > 0) {
        toast.success(`Test Email Sent to ${recipient}!`, {
          description: `Delivered via ${acc.user}. Check inbox/spam folder.`,
        });
      } else {
        toast.error('Test Delivery Failed', {
          description: res?.error || res?.results?.[0]?.error || 'Failed to send test email.',
        });
      }
    } catch (err: any) {
      console.error('Test email send error:', err);
      toast.error('Test Delivery Failed', {
        description: err?.message || 'Server error delivering test email.',
      });
    } finally {
      setTestingAccId(null);
    }
  };

  // Send Quick Test Email Handler
  const handleSendTestEmail = async () => {
    const recipient = testEmailRecipient.trim() || smtpUser.trim();
    if (!recipient || !recipient.includes('@')) {
      toast.warning('Please enter a valid email address to receive the test message.');
      return;
    }
    if (!smtpUser.trim() || !smtpPass.trim()) {
      toast.warning('Please configure your Gmail account and App Password first.');
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const res = await request('/api/email/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
          fromName: smtpSenderName.trim() || businessName,
          recipients: [recipient],
          subject: `⚡ BillingMaster Gmail Test — Connection Successful!`,
          body: `Hello,\n\nThis is a test email sent from BillingMaster Email Marketing Studio via Gmail SMTP.\n\nConnection Details:\n- Sender Name: ${smtpSenderName.trim() || businessName}\n- Gmail User: ${smtpUser.trim()}\n- SMTP Host: ${smtpHost.trim()}:${smtpPort}\n- Time: ${new Date().toLocaleString('en-IN')}\n\nYour Gmail SMTP is fully functional and ready to deliver email campaigns!`,
        }),
      });

      if (res?.success && res.totalSent > 0) {
        toast.success(`Test Email Delivered to ${recipient}!`, {
          description: 'Check your inbox/spam folder to confirm email delivery.',
        });
      } else {
        toast.error('Failed to Send Test Email', {
          description: res?.error || res?.results?.[0]?.error || 'Failed to deliver test email.',
        });
      }
    } catch (err: any) {
      console.error('Test email send error:', err);
      toast.error('Failed to Send Test Email', {
        description: err?.message || 'Server error while sending test email.',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Send Bulk Email Campaign Handler
  const handleSendCampaignNodemailer = async () => {
    if (gmailAccounts.length === 0) {
      toast.warning('Please add and connect at least one Gmail account first.');
      setEmailSubTab('setup');
      return;
    }

    const activeAccounts = gmailAccounts.filter(a => selectedDispatchAccountIds.length === 0 || selectedDispatchAccountIds.includes(a.id));
    const accountsToUse = activeAccounts.length > 0 ? activeAccounts : gmailAccounts;

    const availableEmailContacts = customers.filter(c => c.email && c.email.includes('@')).map(c => c.email);
    const recipientsToSend = selectedRecipients.length > 0
      ? selectedRecipients
      : availableEmailContacts;

    if (recipientsToSend.length === 0) {
      toast.warning('No valid recipient email addresses found. Please select at least one customer with a valid email address.');
      return;
    }

    if (!emailSubject.trim()) {
      toast.warning('Please enter an email subject line.');
      return;
    }

    if (!emailBody.trim()) {
      toast.warning('Please enter email body text.');
      return;
    }

    setIsSendingCampaign(true);

    const isMultiAccount = accountsToUse.length > 1;
    const dispatchMode = isMultiAccount ? 'random' : 'specific';
    const modeLabel = isMultiAccount ? `Randomized (${accountsToUse.length} Accounts)` : `Single Sender (${accountsToUse[0]?.user || ''})`;
    const toastId = toast.loading(`Sending campaign via ${modeLabel} to ${recipientsToSend.length} recipient(s)...`);

    const primarySender = accountsToUse[0] || gmailAccounts[0];

    try {
      const res = await request('/api/email/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: primarySender?.host || 'smtp.gmail.com',
          port: primarySender?.port || 465,
          secure: primarySender?.secure !== false,
          user: primarySender?.user,
          pass: primarySender?.pass,
          fromName: primarySender?.senderName || businessName,
          accounts: accountsToUse,
          dispatchMode: dispatchMode,
          dailyLimitPerAccount: dailyMessageLimit,
          recipients: recipientsToSend,
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        }),
      });

      toast.dismiss(toastId);

      if (res?.success) {
        toast.success(`Email Campaign Executed!`, {
          description: `Successfully delivered ${res.totalSent} of ${recipientsToSend.length} email(s) via ${modeLabel}.`,
        });
      } else {
        toast.error('Campaign Execution Issues', {
          description: res?.error || `Delivered: ${res?.totalSent || 0}, Failed: ${res?.totalFailed || 0}`,
        });
      }
    } catch (err: any) {
      console.error('Campaign send error:', err);
      toast.dismiss(toastId);
      toast.error('Campaign Failed', {
        description: err?.message || 'Failed to dispatch email campaign.',
      });
    } finally {
      setIsSendingCampaign(false);
    }
  };

  // Reward Points State
  const [pointsPer100, setPointsPer100] = useState<number>(5);
  const [pointValueInRs, setPointValueInRs] = useState<number>(1);

  // Calculations for GST & Financials
  const salesSummary = useMemo(() => {
    const totalSales = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || inv.total || 0), 0);
    const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.tax_amount || 0), 0);
    const totalExpenses = expenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
    const grossMargin = totalSales > 0 ? ((totalSales - totalExpenses) / totalSales) * 100 : 0;
    const netProfit = totalSales - totalExpenses;

    const b2bInvoices = invoices.filter(inv => inv.customer_gstin || inv.gstin);
    const b2cInvoices = invoices.filter(inv => !inv.customer_gstin && !inv.gstin);

    return {
      totalSales,
      totalTax,
      totalExpenses,
      grossMargin: grossMargin.toFixed(1),
      netProfit,
      b2bCount: b2bInvoices.length,
      b2bTotal: b2bInvoices.reduce((a, b) => a + Number(b.total_amount || b.total || 0), 0),
      b2cCount: b2cInvoices.length,
      b2cTotal: b2cInvoices.reduce((a, b) => a + Number(b.total_amount || b.total || 0), 0),
    };
  }, [invoices, expenses]);

  // Export CA Package
  const exportCaPackage = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${businessName} — Financial Statement Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Business Name: ${businessName}`, 14, 28);
    doc.text(`GSTIN: ${businessGstin || 'Unregistered / Retail'}`, 14, 34);
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-IN')}`, 14, 40);

    doc.line(14, 45, 196, 45);

    doc.setFontSize(12);
    doc.text(`1. Executive Summary`, 14, 54);
    doc.setFontSize(10);
    doc.text(`Total Gross Sales: Rs ${salesSummary.totalSales.toLocaleString('en-IN')}`, 14, 62);
    doc.text(`Total GST Collected: Rs ${salesSummary.totalTax.toLocaleString('en-IN')}`, 14, 68);
    doc.text(`Total Business Expenses: Rs ${salesSummary.totalExpenses.toLocaleString('en-IN')}`, 14, 74);
    doc.text(`Estimated Net Profit: Rs ${salesSummary.netProfit.toLocaleString('en-IN')}`, 14, 80);

    doc.line(14, 86, 196, 86);
    doc.setFontSize(12);
    doc.text(`2. Tax & Compliance Breakdown (GSTR-1 & GSTR-3B)`, 14, 95);
    doc.setFontSize(10);
    doc.text(`B2B Taxable Invoices: ${salesSummary.b2bCount} (Rs ${salesSummary.b2bTotal.toLocaleString('en-IN')})`, 14, 103);
    doc.text(`B2C Retail Invoices: ${salesSummary.b2cCount} (Rs ${salesSummary.b2cTotal.toLocaleString('en-IN')})`, 14, 109);
    doc.text(`Total Invoices Logged: ${invoices.length}`, 14, 115);
    doc.text(`Active Customers: ${customers.length}`, 14, 121);
    doc.text(`Active Catalog Items: ${products.length}`, 14, 127);

    doc.save(`CA_Report_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export Tally Compatible XML/JSON
  const exportTallyData = () => {
    const tallyExport = {
      COMPANY: businessName,
      GSTIN: businessGstin,
      EXPORT_DATE: new Date().toISOString(),
      VOUCHERS: invoices.map(inv => ({
        VOUCHER_NUMBER: inv.invoice_number || inv.id,
        DATE: inv.issue_date || inv.created_at,
        PARTY_NAME: inv.customer_name || 'Cash Customer',
        AMOUNT: inv.total_amount || inv.total || 0,
        TAX_AMOUNT: inv.tax_amount || 0,
        STATUS: inv.payment_status || inv.status || 'Paid',
      })),
      CUSTOMERS: customers.map(c => ({
        NAME: c.name || c.full_name,
        PHONE: c.phone,
        GSTIN: c.gstin || '',
        BALANCE: c.current_balance || 0,
      })),
    };

    const blob = new Blob([JSON.stringify(tallyExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Data_${businessName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = (message: string, phone = '') => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-primary to-teal-800 p-6 sm:p-9 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
            <Sparkles size={14} className="text-yellow-300 animate-pulse" />
            <span>Operational & Growth Utilities Suite</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Toolkit <span className="text-yellow-300">✨</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-2xl">
              All-in-one suite of specialized commercial calculators, GST tax directories, loyalty reward engines, and CA compliance exports.
            </p>
          </div>


        </div>

        {/* Decorative ambient blur elements */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 h-48 w-48 rounded-full bg-yellow-400/20 blur-2xl pointer-events-none" />
      </div>

      {/* GROUP 1: Commercial & Tax Utilities */}
      <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">1</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Commercial & Tax Utilities</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Instant Real-time Engines</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Tool 1: Smart GST & Margin Calculator */}
                  <div
                    onClick={() => setActiveModal('smart-calculator')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform border border-amber-500/20 shadow-xs">
                        <Calculator size={26} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors">
                            Smart GST & Profit Margin Calculator
                          </h3>
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Interactive Tool
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Calculate GST inclusive/exclusive prices, reverse tax rates from MRP, profit margin %, and retail markup in real-time.
                        </p>
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                          <span className="inline-flex items-center gap-1">
                            <span>Open Commercial Calculator</span>
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">3 Modes Included</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tool 2: HSN & GST Rate Directory */}
                  <div
                    onClick={() => setActiveModal('gst-finder')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                        <Percent size={26} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors">
                            HSN & GST Tax Slab Directory
                          </h3>
                          <span className="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Official Directory
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Lookup official Indian GST tax slabs (0%, 5%, 12%, 18%, 28%) and HSN/SAC codes across all retail goods and services.
                        </p>
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                          <span className="inline-flex items-center gap-1">
                            <span>Search HSN & SAC Codes</span>
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">Searchable Directory</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* GROUP 2: Compliance & CA Audit Suite */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold">2</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Compliance & CA Audit Suite</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">GST & Tally Integration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Tool 1: GST Filing */}
                  <div
                    onClick={() => setActiveModal('gst-filing')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                          <FileText size={24} />
                        </div>
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          GSTR-1 & 3B
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        GST Return Filing Breakdown
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Automated B2B/B2C taxable buckets, total GST collected, and monthly tax liability summaries.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Launch Tax Summary</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 2: CA Reports Sharing */}
                  <div
                    onClick={() => setActiveModal('ca-reports')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform border border-cyan-500/20 shadow-xs">
                          <ShieldCheck size={24} />
                        </div>
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          PDF Audit Pack
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        1-Click CA Audit Package
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Export formatted 5-section PDF financial statement packs for your Chartered Accountant.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Export CA Package</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 3: Tally Export */}
                  <div
                    onClick={() => setActiveModal('tally-export')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-500/20 shadow-xs">
                          <Download size={24} />
                        </div>
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          XML & JSON
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Data Export to Tally ERP
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Download company sales vouchers, party ledgers, and inventory XML for Tally sync.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Export Tally Vouchers</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>

              {/* GROUP 3: Sales & Marketing Engine */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Sales & Marketing Engine</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Boost Revenue & Loyalty</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Tool 1: WhatsApp Marketing */}
                  <div
                    onClick={() => toast.info('Coming Soon!', { description: 'WhatsApp Marketing will be available in an upcoming update.' })}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform border border-emerald-500/20 shadow-xs">
                          <MessageSquare size={24} />
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Coming Soon
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        WhatsApp Marketing
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Personalized WhatsApp greeting flyers, promo brochures, and digital visiting cards.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>WhatsApp Center</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 2: Gmail Studio */}
                  <div
                    onClick={() => setActiveModal('email-marketing')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                          <Mail size={24} />
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                          smtpVerified 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        }`}>
                          {smtpVerified ? 'Gmail Connected' : 'Gmail SMTP'}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Gmail Studio
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Add &amp; manage your store&apos;s Gmail account credentials &amp; SMTP configuration.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>{smtpVerified ? 'Open Gmail Studio' : 'Add Gmail Account'}</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 3: Reward Points */}
                  <div
                    onClick={() => setActiveModal('reward-points')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform border border-amber-500/20 shadow-xs">
                          <Gift size={24} />
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Loyalty Engine
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Reward Points & Cashback
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Configure customer purchase loyalty points, cashback rates, and auto-redemption rules.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Manage Rewards</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 4: Online Store */}
                  <div
                    onClick={() => setActiveModal('online-store')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-500/20 shadow-xs">
                          <Store size={24} />
                        </div>
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Digital Catalog
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Online Store Catalog
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Share your digital product catalog link with customers for instant WhatsApp ordering.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Share Store Link</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

      {/* ========================================================================= */}
      {/* MODALS & DETAILED INTERACTIVE TOOLS                                        */}
      {/* ========================================================================= */}

      {/* MODAL 1: Smart Calculator */}
      {activeModal === 'smart-calculator' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Calculator size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Smart Commercial Calculator</h3>
                  <p className="text-xs text-muted-foreground font-medium">GST, Margin & Markup Real-time Engine</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Calculator Mode Switcher Tabs */}
            <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted/70 p-1.5 text-xs font-extrabold">
              <button
                onClick={() => setCalcMode('gst')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'gst' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                GST Calculator
              </button>
              <button
                onClick={() => setCalcMode('margin')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'margin' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Profit Margin %
              </button>
              <button
                onClick={() => setCalcMode('reverse')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'reverse' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Reverse GST (MRP)
              </button>
            </div>

            {/* Mode 1: GST Calculator */}
            {calcMode === 'gst' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Net Base Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={calcAmount || ''}
                      onChange={(e) => setCalcAmount(Number(e.target.value))}
                      placeholder="0.00"
                      className="input-shell pl-8 w-full text-lg font-black text-foreground tracking-tight"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">Select GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2.5 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]' 
                            : 'bg-card border-border/80 hover:bg-muted text-foreground'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Breakdown Card */}
                {(() => {
                  const taxAmount = (calcAmount * calcGstRate) / 100;
                  const total = calcAmount + taxAmount;
                  const cgst = taxAmount / 2;
                  const sgst = taxAmount / 2;
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Net Base Price:</span>
                        <span className="font-bold text-foreground">₹{calcAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">CGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">SGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">Total Tax ({calcGstRate}%):</span>
                        <span className="font-black text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-black text-foreground border-t border-border/80 pt-3">
                        <span className="text-xs uppercase tracking-wider font-extrabold text-foreground/80">Final Invoice Total</span>
                        <span className="text-lg font-black text-primary bg-primary/10 px-3 py-1 rounded-xl">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mode 2: Profit Margin & Markup */}
            {calcMode === 'margin' && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Cost Price / Buy (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={calcCostPrice || ''}
                        onChange={(e) => setCalcCostPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className="input-shell pl-7 w-full text-sm font-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Selling Price / MRP (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={calcSellingPrice || ''}
                        onChange={(e) => setCalcSellingPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className="input-shell pl-7 w-full text-sm font-black"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const profit = calcSellingPrice - calcCostPrice;
                  const marginPct = calcSellingPrice > 0 ? (profit / calcSellingPrice) * 100 : 0;
                  const markupPct = calcCostPrice > 0 ? (profit / calcCostPrice) * 100 : 0;
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Net Profit Per Unit:</span>
                        <span className={`font-black text-sm ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          ₹{profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Gross Profit Margin:</span>
                        <span className="font-black text-foreground">{marginPct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">Cost Markup Percentage:</span>
                        <span className="font-black text-primary">{markupPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mode 3: Reverse GST */}
            {calcMode === 'reverse' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">MRP / Gross Amount with GST (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={calcAmount || ''}
                      onChange={(e) => setCalcAmount(Number(e.target.value))}
                      placeholder="0.00"
                      className="input-shell pl-8 w-full text-lg font-black text-foreground tracking-tight"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">Included GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2.5 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]' 
                            : 'bg-card border-border/80 hover:bg-muted text-foreground'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const basePrice = (calcAmount * 100) / (100 + calcGstRate);
                  const taxAmount = calcAmount - basePrice;
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Actual Base Price (Pre-Tax):</span>
                        <span className="font-black text-foreground">₹{basePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Extracted GST ({calcGstRate}%):</span>
                        <span className="font-black text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">CGST + SGST Split:</span>
                        <span className="font-black text-foreground bg-muted px-2.5 py-1 rounded-lg">₹{(taxAmount / 2).toFixed(2)} + ₹{(taxAmount / 2).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WhatsApp Marketing & Greetings */}
      {activeModal === 'whatsapp-marketing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">WhatsApp Marketing Center</h3>
                  <p className="text-[11px] text-muted-foreground">Create promotional campaigns & personal greetings</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campaign Preset Tabs */}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-foreground">Select Campaign Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'festive', label: 'Festive Greeting', desc: 'Special festival discount' },
                  { id: 'new_arrivals', label: 'New Arrivals', desc: 'Fresh product catalog' },
                  { id: 'clearance', label: 'Sale & Clearance', desc: 'End of season discounts' },
                ].map(camp => (
                  <button
                    key={camp.id}
                    onClick={() => {
                      setSelectedCampaign(camp.id);
                      if (camp.id === 'festive') {
                        setCustomMsg(`🎉 Festive Greetings from ${businessName}!\nWishing you and your family happiness & prosperity. Enjoy flat 15% discount on all purchases this month!\n\n📍 Visit our store or order on WhatsApp: ${businessPhone}`);
                      } else if (camp.id === 'new_arrivals') {
                        setCustomMsg(`✨ Fresh Stock Alert from ${businessName}!\nWe have added new collection items to our catalog. Check out the latest products with best market prices.\n\n🛒 Contact us now: ${businessPhone}`);
                      } else {
                        setCustomMsg(`🔥 MEGA CLEARANCE SALE at ${businessName}!\nGet up to 30% OFF on selected products while stock lasts. Limited time offer!\n\n📞 Order now: ${businessPhone}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedCampaign === camp.id
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-foreground">{camp.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{camp.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground">Message Content</label>
                <button
                  onClick={() => copyToClipboard(customMsg)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy Message'}</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="input-shell w-full text-xs font-medium leading-relaxed p-3"
              />
            </div>

            {/* Quick Customer Broadcast List */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-foreground">
                Send to Customer ({customers.length} Contacts Available)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                {customers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No customer contacts found. Add customers in the Customers tab to broadcast.
                  </div>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-foreground">{c.name || c.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.phone || 'No phone'}</p>
                      </div>
                      {c.phone && (
                        <button
                          onClick={() => handleShareWhatsApp(customMsg, c.phone)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold shadow-2xs"
                        >
                          <Send size={11} />
                          <span>Send WhatsApp</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* General Share Action */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => handleShareWhatsApp(customMsg)}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
              >
                <Share2 size={14} />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2.5: Gmail Studio */}
      {activeModal === 'email-marketing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-2xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Gmail Studio</h3>
                  <p className="text-[11px] text-muted-foreground">Add &amp; manage your store&apos;s Gmail account credentials for automated system emails</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTemplateManagerModal(true)}
                  title="Email Templates Manager"
                  className="px-2.5 py-1.5 text-xs font-extrabold rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <FileText size={15} className="text-primary" />
                  <span>Templates</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDispatchSettingsModal(true)}
                  title="Dispatch &amp; Limit Settings"
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                >
                  <Settings size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseGmailStudio}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Gmail Studio Content */}
            <div className="mt-5 space-y-4 animate-fade-in">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Gmail Accounts</h4>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {gmailAccounts.length}/20
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDispatchSettingsModal(true)}
                      className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 cursor-pointer hover:bg-amber-500/20 transition-colors"
                    >
                      <Settings size={10} />
                      <span>
                        {selectedDispatchAccountIds.length > 1 || (selectedDispatchAccountIds.length === 0 && gmailAccounts.length > 1)
                          ? `Randomized (${selectedDispatchAccountIds.length || gmailAccounts.length} Active)`
                          : `Single Sender (${selectedDispatchAccountIds.length || (gmailAccounts.length ? 1 : 0)} Active)`}
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Store &amp; verify Gmail SMTP credentials (Max 20 accounts)</p>
                </div>

                {!isAddingEmail && (
                  <button
                    type="button"
                    onClick={handleOpenAddAccount}
                    className="px-3.5 py-2 text-xs font-extrabold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  >
                    <Plus size={16} />
                    <span>Add Gmail</span>
                  </button>
                )}
              </div>

              {/* VIEW MODE: Saved Gmail Account Cards OR Empty State */}
              {!isAddingEmail && (
                <div className="space-y-4">
                  {gmailAccounts.length > 0 ? (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {gmailAccounts.map((acc) => {
                        const isDispatchActive = selectedDispatchAccountIds.includes(acc.id);
                        return (
                          <div
                            key={acc.id}
                            className={`p-4 rounded-2xl border ${
                              isDispatchActive
                                ? 'border-emerald-500/40 bg-emerald-500/5'
                                : 'border-border bg-card'
                            } space-y-3.5 shadow-2xs transition-all`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                                    isDispatchActive
                                      ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                                      : 'bg-primary/10 text-primary border border-primary/20'
                                  } font-black shadow-xs`}
                                >
                                  <Mail size={20} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-xs sm:text-sm font-black text-foreground truncate">
                                      {acc.senderName || businessName}
                                    </h5>
                                    {isDispatchActive && (
                                      <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-600 text-white shrink-0 shadow-2xs">
                                        ACTIVE SENDER
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-mono font-bold text-muted-foreground truncate mt-0.5">
                                    {acc.user}
                                  </p>
                                </div>
                              </div>

                              <span className="hidden sm:inline-flex px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 items-center gap-1 shrink-0">
                                <BadgeCheck size={13} /> Connected
                              </span>
                            </div>

                            {/* Quick Test Email Bar per Account */}
                            <div className="p-2.5 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
                              <label className="block text-[10px] font-bold text-muted-foreground">
                                Send Quick Test Email
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={testRecipients[acc.id] || ''}
                                  onChange={(e) =>
                                    setTestRecipients({ ...testRecipients, [acc.id]: e.target.value })
                                  }
                                  placeholder={`Recipient (default: ${acc.user})`}
                                  className="input-shell flex-1 text-xs font-medium p-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendTestForAccount(acc)}
                                  disabled={testingAccId === acc.id}
                                  className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                                >
                                  {testingAccId === acc.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Send size={12} />
                                  )}
                                  <span>Send Test</span>
                                </button>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedDispatchAccountIds.includes(acc.id)}
                                    onChange={(e) => toggleAccountSelection(acc.id, e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                                  />
                                  <span>Include in Dispatch</span>
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAccount(acc)}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Pencil size={12} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAccount(acc.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Empty State Card with Add Gmail Button */
                    <div className="p-6 sm:p-8 rounded-2xl border-2 border-dashed border-border text-center space-y-3.5 bg-muted/20">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mx-auto border border-primary/20 shadow-xs">
                        <Mail size={24} />
                      </div>
                      <div>
                        <h5 className="text-sm font-black text-foreground">No Gmail Account Added Yet</h5>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
                          Click <strong>Add Gmail</strong> below to enter your Gmail address and 16-character Google App Password for system email delivery.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddAccount}
                        className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-extrabold shadow-md cursor-pointer hover:scale-102 transition-transform"
                      >
                        <Plus size={18} />
                        <span>Add Gmail</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FORM EDIT MODE: Add/Configure Gmail Account */}
              {isAddingEmail && (
                <div className="space-y-4 p-4.5 rounded-2xl border border-border bg-card shadow-xs animate-rise">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold">
                        <Plus size={16} />
                      </div>
                      <h5 className="text-xs font-black text-foreground">
                        {editingAccountId ? 'Edit Gmail Account Credentials' : 'Add Gmail Account Credentials'}
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingEmail(false)}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded-lg hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-bold text-foreground">
                        Sender Name (Display Name on Outgoing Emails)
                      </label>
                      <input
                        type="text"
                        value={smtpSenderName}
                        onChange={(e) => setSmtpSenderName(e.target.value)}
                        placeholder="e.g. My Business Name / Jaydeb Jana"
                        className="input-shell w-full text-xs font-semibold p-3"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-bold text-foreground">
                        Gmail Address <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="email"
                        value={smtpUser}
                        onChange={(e) => {
                          setSmtpUser(e.target.value);
                          setSmtpVerified(false);
                        }}
                        placeholder="e.g. yourstore@gmail.com"
                        className="input-shell w-full text-xs font-semibold p-3"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-foreground">
                          Google App Password (16-Digit) <span className="text-destructive">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {showSmtpPass ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{showSmtpPass ? 'Hide Code' : 'Show Code'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          value={smtpPass}
                          onChange={(e) => {
                            setSmtpPass(e.target.value);
                            setSmtpVerified(false);
                          }}
                          placeholder="e.g. abcd efgh ijkl mnop (16 letters)"
                          className="input-shell w-full text-xs font-mono font-bold p-3 pr-10 tracking-wider"
                        />
                        <Key size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Do NOT use your personal Gmail login password. Use a 16-character <strong>Google App Password</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Primary Save & Connect Button */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestAndSaveAccount}
                      disabled={isTestingConnection}
                      className="btn-primary w-full py-3 text-xs sm:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Verifying &amp; Saving Gmail Connection...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Save &amp; Connect Gmail Account</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Step-by-Step Google App Password Guide */}
                  <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-foreground space-y-1.5">
                    <p className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <ShieldCheck size={15} />
                      <span>How to Get Your 16-Digit Google App Password:</span>
                    </p>
                    <ol className="text-xs space-y-1 pl-5 list-decimal text-muted-foreground leading-relaxed">
                      <li>Open Google Account settings (<a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">myaccount.google.com/security</a>).</li>
                      <li>Ensure <strong>2-Step Verification</strong> is ON under <em>How you sign in to Google</em>.</li>
                      <li>Type <strong>App Passwords</strong> in the top search bar (or Security &gt; App Passwords).</li>
                      <li>Create an App Password for &quot;Mail&quot; and copy the 16-character code.</li>
                      <li>Paste it into the password field above and click <strong>Save &amp; Connect Gmail Account</strong>.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseGmailStudio}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPARATE MODAL: Gmail Dispatch & Limit Settings */}
      {showDispatchSettingsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Gmail Dispatch &amp; Limit Settings</h3>
                  <p className="text-[11px] text-muted-foreground">Select active Gmail accounts &amp; set daily message limits</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchSettingsModal(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4">
              {/* Account Selection Section */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-black text-foreground uppercase tracking-wider">
                    Select Active Dispatch Accounts
                  </label>
                </div>

                <div className="p-3 rounded-2xl border border-border bg-card space-y-2 max-h-[220px] overflow-y-auto">
                  {gmailAccounts.length > 0 ? (
                    gmailAccounts.map((acc) => {
                      const isChecked = selectedDispatchAccountIds.includes(acc.id);
                      return (
                        <label
                          key={acc.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'border-primary/40 bg-primary/5 text-foreground'
                              : 'border-border/60 bg-muted/20 opacity-60 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => toggleAccountSelection(acc.id, e.target.checked)}
                              className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {acc.senderName || businessName}
                              </p>
                              <p className="text-[11px] font-mono text-muted-foreground truncate">
                                {acc.user}
                              </p>
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                              ACTIVE
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No Gmail accounts added yet.</p>
                  )}
                </div>

                {/* Automatic Mode Indicator */}
                {selectedDispatchAccountIds.length > 1 ? (
                  <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center gap-2.5 text-xs">
                    <Shuffle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-extrabold">Automatic Randomized Dispatch Active</span>
                      <p className="text-[11px] opacity-90">Outgoing emails will automatically rotate &amp; randomize across all {selectedDispatchAccountIds.length} selected accounts.</p>
                    </div>
                  </div>
                ) : selectedDispatchAccountIds.length === 1 ? (
                  <div className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-900 dark:text-blue-200 flex items-center gap-2.5 text-xs">
                    <Mail size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <div>
                      <span className="font-extrabold">Single Sender Active</span>
                      <p className="text-[11px] opacity-90">All emails will be delivered using {gmailAccounts.find(a => a.id === selectedDispatchAccountIds[0])?.user || 'the selected account'}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2.5 text-xs">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>No account selected! Please tick at least one Gmail account to send emails.</span>
                  </div>
                )}
              </div>

              {/* Daily Max Message Limit Section */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-black text-foreground uppercase tracking-wider">
                  Per-Account Daily Max Message Limit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={450}
                    value={dailyMessageLimit}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      if (val > 450) {
                        toast.warning('Maximum Safety Limit (450 msgs/day)', {
                          description: 'Setting a limit above 450 messages/day per account can harm or suspend your Google account.',
                        });
                        setDailyMessageLimit(450);
                      } else {
                        setDailyMessageLimit(Math.max(1, val));
                      }
                    }}
                    className="input-shell w-full text-sm font-extrabold p-3 pr-28"
                    placeholder="400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                    msgs / account
                  </span>
                </div>
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>Maximum limit is capped at 450 msgs/day per account to protect your Google account from suspension.</span>
                </p>
                <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground flex justify-between items-center">
                  <span>Combined Daily Capacity:</span>
                  <span className="font-mono font-bold text-foreground">
                    {(selectedDispatchAccountIds.length || gmailAccounts.length)} accounts × {dailyMessageLimit} = {((selectedDispatchAccountIds.length || gmailAccounts.length) * dailyMessageLimit).toLocaleString()} emails/day
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDispatchSettingsModal(false)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDispatchSettings}
                className="btn-primary px-5 py-2.5 text-xs font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check size={16} />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPARATE MODAL: Gmail Studio Email Template Manager */}
      {showTemplateManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-5xl p-4 sm:p-5 animate-rise shadow-2xl border border-border max-h-[95vh] h-[90vh] flex flex-col">
            
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-xs">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-foreground">Email Template Manager</h3>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      {emailTemplates.length} Presets Available
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Select a template to edit fields on the left and see live HTML preview update on the right.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateManagerModal(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Selector Pills / Sub-Header Bar */}
            <div className="mt-3 pb-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {emailTemplates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-xs scale-[1.02]'
                          : 'border-border bg-card hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tpl.accentColor }} />
                      <span>{tpl.shortName || tpl.name}</span>
                      {tpl.isCustomized && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Customized" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="hidden md:flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Preview Syncing</span>
              </div>
            </div>

            {/* Main Split Body Layout: Left Column = Edit Fields | Right Column = Live HTML Preview */}
            <div className="py-3 flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              
              {/* LEFT COLUMN: EDIT TEMPLATE FORM */}
              <div className="lg:col-span-6 space-y-3 overflow-y-auto pr-1">
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-foreground space-y-1">
                  <p className="text-xs font-black text-primary flex items-center gap-1.5">
                    <Pencil size={14} />
                    <span>Edit Template ({activeTemplate.name})</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Changes made here instantly update the live preview on the right. Click quick tags to insert dynamic placeholders.
                  </p>
                </div>

                {/* Field 1: Subject Line */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Subject Line
                    </label>
                  </div>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="input-shell w-full text-xs font-bold p-2.5"
                    placeholder="Tax Invoice #{invoice_number} from {store_name}"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Insert Tag:</span>
                    {['{invoice_number}', '{store_name}', '{customer_name}', '{grand_total}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertTag(tag, 'subject')}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 2: Header Banner Title */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Header Banner Title
                  </label>
                  <input
                    type="text"
                    value={editHeaderTitle}
                    onChange={(e) => setEditHeaderTitle(e.target.value)}
                    className="input-shell w-full text-xs font-bold p-2.5"
                    placeholder="Tax Invoice & Bill Summary"
                  />
                </div>

                {/* Field 3: Email Body Text */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Email Body Text
                  </label>
                  <textarea
                    rows={4}
                    value={editBodyText}
                    onChange={(e) => setEditBodyText(e.target.value)}
                    className="input-shell w-full text-xs font-medium p-2.5 resize-y leading-relaxed font-sans"
                    placeholder="Dear {customer_name}, thank you for your purchase..."
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Insert Tag:</span>
                    {['{customer_name}', '{store_name}', '{invoice_number}', '{grand_total}', '{due_date}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertTag(tag, 'body')}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 4: CTA Button Label & Color Theme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      CTA Button Label
                    </label>
                    <input
                      type="text"
                      value={editCtaText}
                      onChange={(e) => setEditCtaText(e.target.value)}
                      className="input-shell w-full text-xs font-bold p-2.5"
                      placeholder="View & Download Invoice"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Color Theme
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      {['#f97316', '#16a34a', '#2563eb', '#dc2626', '#8b5cf6', '#0f172a'].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setEditAccentColor(hex)}
                          className={`h-7 w-7 rounded-xl transition-all cursor-pointer border-2 ${
                            editAccentColor === hex ? 'border-foreground scale-110 shadow-xs' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE HTML PREVIEW */}
              <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-950 p-3 sm:p-4 rounded-2xl border border-border flex flex-col space-y-3 overflow-hidden font-sans min-h-0">
                {/* Email Subject Header Bar */}
                <div className="bg-card border border-border rounded-xl p-2.5 shadow-xs flex items-center justify-between text-xs gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-muted-foreground truncate">
                    <Mail size={14} className="shrink-0 text-primary" />
                    <span className="font-semibold text-foreground shrink-0">Subject:</span>
                    <span className="font-bold text-foreground truncate">
                      {renderSampleText(editSubject, businessName)}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    Live HTML
                  </span>
                </div>

                {/* Scrollable HTML Email Mockup Canvas Card */}
                <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-y-auto flex-1 text-slate-800 dark:text-slate-100 scrollbar-thin">
                  <div className="flex flex-col justify-between min-h-full">
                    <div>
                      {/* Header Banner */}
                      <div
                        className="p-4 sm:p-5 text-white text-center transition-colors relative shrink-0"
                        style={{ backgroundColor: editAccentColor }}
                      >
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xs mb-1.5">
                          <FileText size={20} />
                        </div>
                        <h3 className="text-base sm:text-lg font-black tracking-tight">{renderSampleText(editHeaderTitle, businessName)}</h3>
                        <p className="text-[10px] font-semibold opacity-90 mt-0.5">BillingMaster Automated Email</p>
                      </div>

                      {/* Body Text */}
                      <div className="p-4 sm:p-5 space-y-3 text-xs leading-relaxed">
                        <div className="whitespace-pre-line text-slate-700 dark:text-slate-200 font-medium">
                          {renderSampleText(editBodyText, businessName)}
                        </div>

                        {/* Mock Invoice Items Table for Billing Templates */}
                        {(selectedTemplateId === 'invoice_created' || selectedTemplateId === 'payment_receipt' || selectedTemplateId === 'payment_reminder') && (
                          <div className="my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                            <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-200 dark:border-slate-700">
                              <div>
                                <p className="font-extrabold text-slate-900 dark:text-white">Invoice #INV-2026-0842</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Date: 07 Sep 2026</p>
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                Tax Invoice
                              </span>
                            </div>

                            <table className="w-full text-[11px] text-left">
                              <thead>
                                <tr className="text-[9px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                  <th className="py-1">Description</th>
                                  <th className="py-1 text-center">Qty</th>
                                  <th className="py-1 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                                <tr>
                                  <td className="py-1 font-medium">Premium Billing POS Suite</td>
                                  <td className="py-1 text-center">1</td>
                                  <td className="py-1 text-right font-mono">₹12,500.00</td>
                                </tr>
                                <tr>
                                  <td className="py-1 font-medium">GST &amp; Setup Services</td>
                                  <td className="py-1 text-center">1</td>
                                  <td className="py-1 text-right font-mono">₹2,350.00</td>
                                </tr>
                              </tbody>
                            </table>

                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Total Amount:</span>
                              <span className="text-sm font-black text-slate-900 dark:text-white font-mono">₹14,850.00</span>
                            </div>
                          </div>
                        )}

                        {/* CTA Button */}
                        <div className="py-2 text-center">
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="inline-flex items-center justify-center px-6 py-3 text-xs font-extrabold text-white rounded-xl shadow-md transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                            style={{ backgroundColor: editAccentColor }}
                          >
                            {renderSampleText(editCtaText, businessName)}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5 shrink-0">
                      <p className="font-bold text-slate-600 dark:text-slate-400">{businessName} • Automated Notification</p>
                      <p>123 Commerce Way, Salt Lake Sector 5, Kolkata, WB 700091</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Bottom Footer Action Bar */}
            <div className="pt-3 border-t border-border flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleSaveActiveTemplate}
                className="btn-primary px-6 py-2.5 text-xs font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check size={16} />
                <span>Save Template</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: Staff Attendance & Payroll */}
      {activeModal === 'attendance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-2xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Staff Attendance & Payroll</h3>
                  <p className="text-[11px] text-muted-foreground">Daily attendance register and monthly salary overview</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Date Selector */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Attendance Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="input-shell text-xs py-1.5 px-2.5 font-bold"
                />
              </div>
              <div className="text-xs font-extrabold text-foreground">
                Total Staff: <span className="text-primary">{staffList.length}</span>
              </div>
            </div>

            {/* Staff Attendance Table */}
            <div className="mt-4 rounded-xl border border-border/70 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/70">
                  <tr>
                    <th className="p-3">Staff Name & Role</th>
                    <th className="p-3">Monthly Salary</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-card">
                  {staffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-bold text-foreground">{staff.name}</p>
                        <p className="text-[10px] text-muted-foreground">{staff.role}</p>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        ₹{Number(staff.salary).toLocaleString('en-IN')}/mo
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          staff.status === 'present'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : staff.status === 'half_day'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-destructive/15 text-destructive'
                        }`}>
                          {staff.status === 'present' ? 'Present' : staff.status === 'half_day' ? 'Half Day' : 'Absent'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex rounded-lg border border-border overflow-hidden text-[10px] font-bold">
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'present')}
                            className={`px-2 py-1 ${staff.status === 'present' ? 'bg-emerald-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'half_day')}
                            className={`px-2 py-1 ${staff.status === 'half_day' ? 'bg-amber-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            HD
                          </button>
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'absent')}
                            className={`px-2 py-1 ${staff.status === 'absent' ? 'bg-destructive text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            A
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payroll Summary Footer */}
            <div className="mt-4 rounded-xl bg-muted/40 p-3.5 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-muted-foreground font-semibold">Total Monthly Payroll: </span>
                <strong className="text-foreground">
                  ₹{staffList.reduce((acc, s) => acc + Number(s.salary), 0).toLocaleString('en-IN')}
                </strong>
              </div>
              <button
                onClick={() => {
                  toast.success('Attendance recorded and saved successfully in local register.');
                  setActiveModal(null);
                }}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-bold"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GST Rate Finder */}
      {activeModal === 'gst-finder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Percent size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">GST Rate & HSN Directory</h3>
                  <p className="text-xs text-muted-foreground font-medium">Standard Indian GST Tax Slabs & Official Codes</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Directory Search & Filter */}
            <div className="mt-4 shrink-0 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={hsnSearchQuery}
                onChange={(e) => setHsnSearchQuery(e.target.value)}
                placeholder="Search HSN code (e.g. 8517), product name, or slab rate..."
                className="input-shell pl-9 pr-8 w-full text-xs font-bold"
              />
              {hsnSearchQuery && (
                <button
                  onClick={() => setHsnSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* HSN & Slab Rate Items List */}
            <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1">
              {[
                { hsn: '0000', item: 'Fresh Fruits, Vegetables, Milk, Salt, Curd & Grain', rate: '0%', taxDetails: 'Nil Rated (Exempted)', type: 'Exempt Goods' },
                { hsn: '1006', item: 'Packaged Food Items, Edible Oil, Tea, Coffee, Sugar', rate: '5%', taxDetails: '2.5% CGST + 2.5% SGST', type: 'Essential Goods' },
                { hsn: '6101', item: 'Apparel & Readymade Clothing (> ₹1,000 value)', rate: '12%', taxDetails: '6.0% CGST + 6.0% SGST', type: 'Standard Rate 1' },
                { hsn: '8517', item: 'Smartphones, Electronic Hardware, IT Services, Telecom', rate: '18%', taxDetails: '9.0% CGST + 9.0% SGST', type: 'Standard Rate 2' },
                { hsn: '8703', item: 'Automobiles, Air Conditioners, Luxury Goods, Cigarettes', rate: '28%', taxDetails: '14.0% CGST + 14.0% SGST', type: 'Luxury Rate' },
              ]
                .filter((item) => {
                  const q = hsnSearchQuery.toLowerCase();
                  return item.hsn.includes(q) || item.item.toLowerCase().includes(q) || item.rate.includes(q) || item.type.toLowerCase().includes(q);
                })
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="shrink-0 rounded-xl bg-muted px-2.5 py-1.5 text-xs font-black font-mono text-foreground border border-border/60">
                        HSN {item.hsn}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-extrabold text-foreground leading-snug">
                          {item.item}
                        </h4>
                        <span className="inline-block text-[10px] font-bold text-muted-foreground mt-0.5">
                          {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                      <div className="text-left sm:text-right">
                        <span className="inline-block text-xs sm:text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-xl">
                          {item.rate}
                        </span>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                          {item.taxDetails}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-5 shrink-0 flex justify-end pt-3 border-t border-border/60">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CA Reports Sharing */}
      {activeModal === 'ca-reports' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Chartered Accountant (CA) Package</h3>
                  <p className="text-[11px] text-muted-foreground">1-click audit & compliance report</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 space-y-2">
                <div className="flex justify-between">
                  <span>Business Name:</span>
                  <strong className="text-foreground">{businessName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>GSTIN Status:</span>
                  <strong className="text-foreground">{businessGstin || 'Retail / Non-GST'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Invoices Logged:</span>
                  <strong className="text-foreground">{invoices.length} Invoices</strong>
                </div>
                <div className="flex justify-between">
                  <span>Gross Sales Total:</span>
                  <strong className="text-primary">₹{salesSummary.totalSales.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Tax Liability:</span>
                  <strong className="text-foreground">₹{salesSummary.totalTax.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              <p>
                This generated PDF package includes sales summaries, customer ledger balances, GSTR-1 taxable buckets, and expense breakdown for your CA to file tax returns.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={exportCaPackage}
                className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Download size={15} />
                <span>Download CA Package PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Tally Export */}
      {activeModal === 'tally-export' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Data Export to Tally</h3>
                  <p className="text-[11px] text-muted-foreground">Tally Prime & ERP 9 compatible XML/JSON</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <p>
                Export all your sales vouchers, customer ledgers, and inventory masters into a standardized structured format directly importable into Tally ERP 9 / Tally Prime.
              </p>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1 text-[11px]">
                <div>&bull; {invoices.length} Sales Voucher Entries</div>
                <div>&bull; {customers.length} Sundry Debtors (Party Ledgers)</div>
                <div>&bull; {products.length} Stock Item Masters</div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={exportTallyData}
                className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Download size={15} />
                <span>Download Tally JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: e-Invoice Suite */}
      {activeModal === 'einvoice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">e-Invoice & e-Way Bill Suite</h3>
                  <p className="text-[11px] text-muted-foreground">Government Portal IRN & e-Way Compliance</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">GSTIN Status:</span>
                  <span className="font-bold text-primary">{businessGstin || 'Not Configured (Optional for Retail)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">e-Invoice Applicability:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">B2B Commercial Invoices</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">e-Way Bill Limit:</span>
                  <span className="font-bold text-foreground">Consignments &gt; ₹50,000</span>
                </div>
              </div>
              <p>
                All B2B invoices generated in BillingMaster include standardized QR codes with digital payload hashes, HSN codes, and tax rates.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Cloud Sync & Storage */}
      {activeModal === 'cloud-sync' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Cloud Sync & Desktop Station</h3>
                  <p className="text-[11px] text-muted-foreground">Live real-time encrypted connection</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <CheckCheck size={18} className="shrink-0" />
                <div>
                  <p className="font-bold">Real-time Cloud Sync Active</p>
                  <p className="text-[10px] opacity-90">All changes sync instantaneously across mobile & desktop devices.</p>
                </div>
              </div>

              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Encrypted Storage:</span>
                  <strong className="text-foreground">AES-256 Cloud DB</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Offline Capability:</span>
                  <strong className="text-foreground">Enabled via IndexedDB Cache</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span>Multi-Device Access:</span>
                  <strong className="text-foreground">Simultaneous multi-counter POS</strong>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* MODAL 10: Online Store / Digital Catalog (Read-Only Stock Inspector) */}
      {activeModal === 'online-store' && (() => {
        const visibleCatalogProducts = products.filter((p: any) => {
          if (p.show_in_catalog === 0 || p.show_in_catalog === false || p.show_in_catalog === '0' || p.show_in_catalog === 'false') {
            return false;
          }
          if (p.notes && typeof p.notes === 'string' && (p.notes.startsWith('{') || p.notes.startsWith('['))) {
            try {
              const parsed = JSON.parse(p.notes);
              if (parsed.show_in_catalog === false || parsed.show_in_catalog === 0 || parsed.show_in_catalog === '0' || parsed.show_in_catalog === 'false') {
                return false;
              }
            } catch (e) {}
          }
          return true;
        });

        const inStockCount = visibleCatalogProducts.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) > 4).length;
        const lowStockCount = visibleCatalogProducts.filter(p => {
          const qty = Number(p.stock_quantity ?? p.stock ?? 0);
          return qty > 0 && qty <= 4;
        }).length;
        const outOfStockCount = visibleCatalogProducts.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) <= 0).length;

        const filteredCatalog = visibleCatalogProducts.filter(p => {
          const qty = Number(p.stock_quantity ?? p.stock ?? 0);
          const matchesSearch = !catalogSearch || 
            (p.name && p.name.toLowerCase().includes(catalogSearch.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(catalogSearch.toLowerCase())) ||
            (p.hsn_code && String(p.hsn_code).includes(catalogSearch));

          if (!matchesSearch) return false;
          if (catalogStockFilter === 'instock') return qty > 4;
          if (catalogStockFilter === 'lowstock') return qty > 0 && qty <= 4;
          if (catalogStockFilter === 'outstock') return qty <= 0;
          return true;
        });

        const cleanCurrentInput = catalogHandleInput.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
        const isCurrentlyAvailable = handleAvailabilityState === 'available' && checkedHandleText === cleanCurrentInput && cleanCurrentInput.length >= 3;

        const handleCheckCatalogHandle = async () => {
          const cleanHandle = catalogHandleInput.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
          if (!cleanHandle || cleanHandle.length < 3) {
            toast.error('Catalog handle must be at least 3 characters long (letters, numbers, hyphens, underscores).');
            setHandleAvailabilityState('invalid');
            return;
          }

          try {
            setHandleAvailabilityState('checking');
            const result = await checkCatalogHandleAvailability(cleanHandle, business?.id);

            if (!result.available) {
              if (result.suggestedHandles && result.suggestedHandles.length > 0) {
                setSuggestedHandles(result.suggestedHandles);
              } else {
                setSuggestedHandles([`${cleanHandle}-1`, `${cleanHandle}-store`, `${cleanHandle}-official`]);
              }
              const storeOwner = result.takenBy ? ` by another store ("${result.takenBy}")` : ' by another store';
              toast.error(`The catalog handle "${cleanHandle}" is already taken${storeOwner}. Please choose a different handle.`);
              setHandleAvailabilityState('taken');
              setCheckedHandleText('');
              return;
            }

            setSuggestedHandles([]);
            toast.success(`Catalog handle "${cleanHandle}" is available! Click "Save Handle" to claim it.`);
            setHandleAvailabilityState('available');
            setCheckedHandleText(cleanHandle);
          } catch (err: any) {
            console.error('Error checking catalog handle:', err);
            toast.error('Failed to check handle availability. Please try again.');
            setHandleAvailabilityState('unchecked');
          }
        };

        const handleSaveCatalogHandle = async () => {
          const cleanHandle = catalogHandleInput.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
          if (!cleanHandle || cleanHandle.length < 3) {
            toast.error('Catalog handle must be at least 3 characters long.');
            return;
          }

          if (!isCurrentlyAvailable) {
            toast.error('Please check handle availability first before saving.');
            return;
          }

          try {
            setSavingCatalogHandle(true);
            let updatedOrNew: any = null;
            if (business && business.id) {
              updatedOrNew = await db.update('businesses', business.id, {
                catalog_slug: cleanHandle,
                catalog_handle: cleanHandle,
              });
            } else {
              updatedOrNew = await db.insert('businesses', {
                name: businessName,
                catalog_slug: cleanHandle,
                catalog_handle: cleanHandle,
              });
            }

            setBusiness(updatedOrNew || { ...business, catalog_slug: cleanHandle, catalog_handle: cleanHandle });
            toast.success(`Catalog link updated to "/catalog/${cleanHandle}" successfully!`);
            setIsEditingCatalogHandle(false);
            setHandleAvailabilityState('unchecked');
            setCheckedHandleText('');
          } catch (err: any) {
            console.error('Error saving catalog handle:', err);
            const errMsg = err?.message || 'Failed to update catalog handle. Please try again.';
            if (errMsg.toLowerCase().includes('already taken') || errMsg.toLowerCase().includes('duplicate')) {
              toast.error(errMsg);
              setHandleAvailabilityState('taken');
              setCheckedHandleText('');
            } else {
              toast.error(errMsg);
            }
          } finally {
            setSavingCatalogHandle(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="card-shell w-full max-w-3xl sm:max-w-4xl p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
                    <Store size={22} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Digital Store Catalog & Stock Inspector</h3>
                    <p className="text-xs text-muted-foreground font-medium">Read-Only Stock Availability & Price Directory</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditingCatalogHandle(false);
                    setHandleAvailabilityState('unchecked');
                    setCheckedHandleText('');
                    setActiveModal(null);
                  }}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">

                {/* Live Store Link Bar with Edit Feature */}
                {!isEditingCatalogHandle ? (
                  <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Shareable Read-Only Catalog Link</p>
                        <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-mono font-bold border border-primary/20">/catalog/{currentCatalogHandle}</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-foreground truncate mt-0.5">
                        {storeUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogHandleInput(currentCatalogHandle);
                          setIsEditingCatalogHandle(true);
                          setHandleAvailabilityState('unchecked');
                          setCheckedHandleText('');
                        }}
                        className="rounded-xl bg-card border border-border/80 px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                        title="Edit Custom Store Link Handle / Slug"
                      >
                        <Pencil size={13} className="text-primary" />
                        <span>Edit Handle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(storeUrl)}
                        className="rounded-xl bg-card border border-border/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCatalogQrModal(true)}
                        className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-2 text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        title="Generate & Customize Store Catalog QR Code"
                      >
                        <QrCode size={14} />
                        <span>QR Code</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-card border-2 border-primary/40 space-y-3 shadow-md animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Pencil size={14} className="text-primary" />
                        <span>Edit Custom Catalog Handle / Slug</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingCatalogHandle(false);
                          setHandleAvailabilityState('unchecked');
                          setCheckedHandleText('');
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs font-bold"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center rounded-xl bg-muted border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                        <span className="px-3 py-2 text-xs font-mono font-bold text-muted-foreground bg-muted/80 border-r border-border shrink-0 select-none">
                          {window.location.origin}/catalog/
                        </span>
                        <input
                          type="text"
                          value={catalogHandleInput}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                            setCatalogHandleInput(val);
                            if (val !== checkedHandleText) {
                              setHandleAvailabilityState('unchecked');
                            }
                          }}
                          placeholder="e.g. my-fashion-store"
                          className="w-full bg-transparent px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none"
                          autoFocus
                        />
                      </div>

                      {/* Status indicator / instructions */}
                      <div className="text-[11px] font-medium pt-0.5">
                        {handleAvailabilityState === 'checking' && (
                          <p className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                            <RefreshCw size={12} className="animate-spin" />
                            Checking availability in database...
                          </p>
                        )}
                        {isCurrentlyAvailable && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            Handle &quot;{cleanCurrentInput}&quot; is available! Click &quot;Save Handle&quot; below to claim it.
                          </p>
                        )}
                        {handleAvailabilityState === 'taken' && (
                          <div className="space-y-1.5 pt-0.5">
                            <p className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                              <AlertCircle size={13} className="shrink-0" />
                              Handle &quot;{cleanCurrentInput}&quot; is already taken by another store.
                            </p>
                            {suggestedHandles.length > 0 && (
                              <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[11px]">
                                <span className="text-muted-foreground font-semibold">Available suggestions:</span>
                                {suggestedHandles.map(sugg => (
                                  <button
                                    key={sugg}
                                    type="button"
                                    onClick={() => {
                                      setCatalogHandleInput(sugg);
                                      setHandleAvailabilityState('unchecked');
                                      setSuggestedHandles([]);
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    +{sugg}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {(handleAvailabilityState === 'unchecked' || (!isCurrentlyAvailable && handleAvailabilityState !== 'taken' && handleAvailabilityState !== 'checking')) && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Sparkles size={12} className="text-amber-500 shrink-0" />
                            <span>Click &quot;Check Availability&quot; to verify if handle is available before saving.</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingCatalogHandle(false);
                          setHandleAvailabilityState('unchecked');
                          setCheckedHandleText('');
                        }}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                        disabled={savingCatalogHandle || handleAvailabilityState === 'checking'}
                      >
                        Cancel
                      </button>

                      {/* Step 1: Check Availability Button */}
                      <button
                        type="button"
                        onClick={handleCheckCatalogHandle}
                        disabled={handleAvailabilityState === 'checking' || savingCatalogHandle || !catalogHandleInput.trim()}
                        className={`rounded-xl px-4 py-2 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs border ${
                          isCurrentlyAvailable
                            ? 'bg-muted text-muted-foreground border-border hover:bg-muted'
                            : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'
                        }`}
                      >
                        {handleAvailabilityState === 'checking' ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        <span>{handleAvailabilityState === 'checking' ? 'Checking...' : isCurrentlyAvailable ? 'Re-check Handle' : 'Check Availability'}</span>
                      </button>

                      {/* Step 2: Save Handle Button */}
                      <button
                        type="button"
                        onClick={handleSaveCatalogHandle}
                        disabled={!isCurrentlyAvailable || savingCatalogHandle}
                        className={`rounded-xl px-4 py-2 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition-all ${
                          isCurrentlyAvailable
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                            : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                        }`}
                      >
                        {savingCatalogHandle ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>{savingCatalogHandle ? 'Saving Handle...' : 'Save Handle'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Catalog Display Preferences & Restriction Controls */}
                <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders size={16} className="text-primary" />
                      <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Catalog Preferences & Restrictions</h4>
                    </div>
                  </div>

                  {/* Main Toggle Switch: Online Store Status (Active / Disabled) */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    isStoreEnabled 
                      ? 'bg-emerald-500/5 border-emerald-500/30' 
                      : 'bg-rose-500/5 border-rose-500/30'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-xl border shrink-0 ${
                          isStoreEnabled 
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}>
                          <Store size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-black text-foreground">Online Store Status</h5>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isStoreEnabled 
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}>
                              {isStoreEnabled ? '● Live / Online' : '○ Store Closed'}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                            {isStoreEnabled 
                              ? 'Your digital catalog is LIVE. Anyone with the store link can view products.' 
                              : 'Your digital catalog is CLOSED. Visitors opening your store link will see a Store Closed message.'}
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch Button */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isStoreEnabled}
                        onClick={() => setIsStoreEnabled(!isStoreEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isStoreEnabled ? 'bg-emerald-600' : 'bg-muted-foreground/40'
                        }`}
                        title={isStoreEnabled ? 'Disable / Turn Off Online Store Catalog' : 'Enable / Turn On Online Store Catalog'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isStoreEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Top Row: 2-Column Grid for Show Sales Rate & Show Barcode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Control 1: Show Sales Rate */}
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <TrendingUp size={15} />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">Show Sales Rate</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={showSalesRate}
                          onChange={(e) => setShowSalesRate(e.target.checked)}
                          className="w-4.5 h-4.5 rounded-md text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                        Display monthly/yearly sales rate stats & velocity graphs on product pages.
                      </p>
                    </div>

                    {/* Control 2: Show Barcode */}
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <Barcode size={15} />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">Show Product Barcode</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={showBarcodes}
                          onChange={(e) => setShowBarcodes(e.target.checked)}
                          className="w-4.5 h-4.5 rounded-md text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                        Display scannable vector barcode graphics & SKU numbers on product pages.
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Full-Width Geofenced Location Access Restriction Block */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <MapPin size={15} />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-foreground">Location Access Restriction (Geofencing)</h5>
                          <p className="text-[10px] text-muted-foreground font-medium">Restrict digital catalog access to local visitors within set radius</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLocationMapModal(true)}
                          className="rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                        >
                          <Globe size={13} className="text-primary" />
                          <span>Pick Location on Map</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                              toast.error('Geolocation is not supported by your browser.');
                              return;
                            }
                            setDetectingStoreGps(true);
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                setStoreLat(lat);
                                setStoreLng(lng);
                                setDetectingStoreGps(false);
                                toast.success(`Store GPS detected: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°. Click "Save Preferences" below.`);
                              },
                              (err) => {
                                console.error('GPS detection error:', err);
                                setDetectingStoreGps(false);
                                toast.error('Could not access GPS location. Please check browser permissions.');
                              },
                              { enableHighAccuracy: true, timeout: 10000 }
                            );
                          }}
                          disabled={detectingStoreGps}
                          className="rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                        >
                          <RefreshCw size={13} className={detectingStoreGps ? "animate-spin" : "text-rose-500"} />
                          <span>{detectingStoreGps ? "Detecting..." : "Detect GPS"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Location Settings: Custom Input + Preset Chips */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2.5 border-t border-border/50">
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-extrabold text-foreground shrink-0">Access Radius (m):</label>
                        <div className="relative w-36 sm:w-40">
                          <input
                            type="number"
                            min="0"
                            max="100000"
                            placeholder="Unlimited (0)"
                            value={locationRadiusKm}
                            onChange={(e) => handleSetRadiusValue(e.target.value)}
                            className="w-full rounded-xl bg-card border border-border pl-3 pr-8 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">m</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider shrink-0 mr-0.5">Presets:</span>
                        {[
                          { label: 'Disabled', val: '' },
                          { label: '100 m', val: '100' },
                          { label: '500 m', val: '500' },
                          { label: '1000 m', val: '1000' },
                          { label: '2000 m', val: '2000' },
                          { label: '5000 m', val: '5000' },
                          { label: '10000 m', val: '10000' },
                        ].map((chip) => {
                          const isActive = (chip.val === '' && (!locationRadiusKm || Number(locationRadiusKm) <= 0)) || locationRadiusKm === chip.val;
                          return (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => handleSetRadiusValue(chip.val)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all border shrink-0 ${
                                isActive
                                  ? 'bg-primary text-primary-foreground border-transparent shadow-xs'
                                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                            >
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* GPS Status Indicator */}
                    <div className="text-[11px] font-medium pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-muted-foreground">
                      {storeLat != null && storeLng != null ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            Store Coordinates Set: {storeLat.toFixed(4)}° N, {storeLng.toFixed(4)}° E
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setStoreLat(null);
                              setStoreLng(null);
                              toast.info('Store location cleared. Click "Save Preferences" below to commit changes.');
                            }}
                            className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Clear set store location coordinates"
                          >
                            <Trash2 size={11} />
                            <span>Clear Location</span>
                          </button>
                        </div>
                      ) : locationRadiusKm && Number(locationRadiusKm) > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <AlertCircle size={13} className="shrink-0" />
                          Coordinates not set. Click &quot;Pick Location on Map&quot; or &quot;Detect GPS&quot; to set store position.
                        </span>
                      ) : (
                        <span />
                      )}
                      {locationRadiusKm && Number(locationRadiusKm) > 0 ? (
                        <span className="font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md shrink-0 self-start sm:self-auto">
                          Restricted to {locationRadiusKm} m
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0 self-start sm:self-auto">
                          Unlimited Access (Disabled)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Footer for Catalog Preferences */}
                  <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      {isSettingsDirty ? (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                          <Sparkles size={13} className="animate-pulse text-amber-500" />
                          You have unsaved preference changes
                        </span>
                      ) : (
                        <span className="text-muted-foreground/80 font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          All preferences up to date
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSaveAllCatalogSettings()}
                      disabled={!isSettingsDirty || savingCatalogSettings}
                      className={`w-full sm:w-auto rounded-xl px-5 py-2.5 text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                        isSettingsDirty && !savingCatalogSettings
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md cursor-pointer'
                          : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                      }`}
                    >
                      {savingCatalogSettings ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>{savingCatalogSettings ? 'Saving Preferences...' : 'Save Preferences'}</span>
                    </button>
                  </div>
                </div>

                {/* Stock Overview Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl border border-border/70 bg-card p-3 text-center">
                    <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Total Products</p>
                    <p className="text-base font-black text-foreground mt-0.5">{products.length}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">In Stock</p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{inStockCount}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase">Low Stock</p>
                    <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</p>
                  </div>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase">Out of Stock</p>
                    <p className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">{outOfStockCount}</p>
                  </div>
                </div>

                {/* Search & Stock Filter Bar */}
                <div className="space-y-2.5 pt-1">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter catalog by product name, category, or HSN..."
                      className="w-full rounded-xl bg-background border border-border/80 pl-9 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {catalogSearch && (
                      <button
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Stock Availability Filter Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setCatalogStockFilter('all')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      All Items ({products.length})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('instock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'instock'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      In Stock ({inStockCount})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('lowstock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'lowstock'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      Low Stock ({lowStockCount})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('outstock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'outstock'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      Out of Stock ({outOfStockCount})
                    </button>
                  </div>
                </div>

                {/* Filtered Product Items Inventory Table/List */}
                <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Store size={32} className="mx-auto text-muted-foreground/50" />
                      <p className="text-xs font-bold text-muted-foreground">No matching products found in catalog.</p>
                      <button
                        onClick={() => { setCatalogSearch(''); setCatalogStockFilter('all'); }}
                        className="text-xs font-extrabold text-primary hover:underline"
                      >
                        Reset Search Filters
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                      {filteredCatalog.map((p) => {
                        const qty = Number(p.stock_quantity ?? p.stock ?? 0);
                        const unit = p.unit || 'pcs';
                        const price = Number(p.selling_price || p.price || 0);

                        let badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                        let statusText = `In Stock (${qty} ${unit})`;
                        if (qty <= 0) {
                          badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                          statusText = `Out of Stock (0 ${unit})`;
                        } else if (qty <= 4) {
                          badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                          statusText = `Low Stock (${qty} ${unit})`;
                        }

                        const imgUrl = p.image_url || p.image || p.photo_url || (p.notes && typeof p.notes === 'string' && (p.notes.startsWith('{') || p.notes.startsWith('[')) ? (() => { try { const parsed = JSON.parse(p.notes); return parsed.image_url || parsed.image || ''; } catch (e) { return ''; } })() : '');

                        return (
                          <div key={p.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                            {imgUrl && (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="h-11 w-11 shrink-0 rounded-xl object-contain p-0.5 border border-border/80 bg-muted/30"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs sm:text-sm font-extrabold text-foreground truncate">{p.name}</p>
                                {p.hsn_code && (
                                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground">
                                    HSN {p.hsn_code}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Category: {p.category || p.category_name || 'General'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black border ${badgeColor}`}>
                                  {statusText}
                                </span>
                                <p className="text-xs font-black text-foreground mt-1">
                                  ₹{price.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Close Inspector
                </button>
                <button
                  onClick={() => handleShareWhatsApp(`Hello! Check our live product availability and stock inventory online:\n${storeUrl}\n\nFrom: ${businessName}`)}
                  className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold shadow-xs"
                >
                  <Share2 size={14} />
                  <span>Share Catalog Link on WhatsApp</span>
                </button>
              </div>

              {/* Interactive Location Map Picker Modal */}
              {showLocationMapModal && (
                <LocationMapPickerModal
                  initialLat={storeLat}
                  initialLng={storeLng}
                  onClose={() => setShowLocationMapModal(false)}
                  onConfirm={(newLat, newLng) => {
                    setStoreLat(newLat);
                    setStoreLng(newLng);
                    setShowLocationMapModal(false);
                    if (newLat === null || newLng === null) {
                      toast.info('Store location cleared. Click "Save Preferences" below to commit changes.');
                    } else {
                      toast.success(`Store location set to ${newLat.toFixed(4)}°, ${newLng.toFixed(4)}°!`);
                    }
                  }}
                />
              )}

              {/* Catalog QR Code Studio Modal */}
              <CatalogQrModal
                isOpen={showCatalogQrModal}
                onClose={() => setShowCatalogQrModal(false)}
                storeUrl={storeUrl}
                storeHandle={currentCatalogHandle}
                businessName={businessName}
                businessPhone={businessPhone}
                businessAddress={business?.address}
                businessGstin={businessGstin}
              />
            </div>
          </div>
        );
      })()}

      {/* MODAL 11: Reward Points */}
      {activeModal === 'reward-points' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Reward Points & Loyalty</h3>
                  <p className="text-[11px] text-muted-foreground">Cashback and customer repeat billing</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground">Points Earned per ₹100 Spent</label>
                <input
                  type="number"
                  value={pointsPer100}
                  onChange={(e) => setPointsPer100(Number(e.target.value))}
                  className="input-shell mt-1.5 w-full text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground">Point Value (1 Point = ₹)</label>
                <input
                  type="number"
                  value={pointValueInRs}
                  onChange={(e) => setPointValueInRs(Number(e.target.value))}
                  className="input-shell mt-1.5 w-full text-sm font-bold"
                />
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border border-border/60 text-muted-foreground leading-relaxed">
                Customers will automatically accumulate reward points with each invoice. Points can be redeemed at checkout to provide instant discounts.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  toast.success('Reward program settings updated successfully.');
                  setActiveModal(null);
                }}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Save Reward Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog QR Code Studio Modal */}
      <CatalogQrModal
        isOpen={showCatalogQrModal}
        onClose={() => setShowCatalogQrModal(false)}
        storeUrl={storeUrl}
        storeHandle={currentCatalogHandle}
        businessName={businessName}
        businessPhone={businessPhone}
        businessAddress={business?.address}
        businessGstin={businessGstin}
      />
    </div>
  );
}
