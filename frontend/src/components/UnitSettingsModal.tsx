import React, { useState, useEffect, useMemo } from 'react';
import { useBodyScrollLock } from '@/lib/useScrollReset';
import { 
  X, 
  Search, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  SlidersHorizontal, 
  Tag, 
  Trash2, 
  Ruler, 
  Scale, 
  Box, 
  Droplet, 
  Square, 
  Utensils, 
  Clock, 
  HardDrive,
  Camera,
  Smartphone,
  Monitor,
  Barcode,
  Volume2,
  VolumeX,
  Package,
  Sparkles,
  ShieldAlert,
  Layers,
  Settings,
  RefreshCw,
  Cpu,
  KeyRound,
  Check,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  MasterUnit, 
  MASTER_UNITS_LIST, 
  getStoredEnabledCodes, 
  getStoredCustomUnits, 
  getStoredStarredCodes,
  saveUnitSettings, 
  getDefaultEnabledCodes 
} from '../constants/unitOptions';
import {
  ProductHardwareSettings,
  getStoredProductSettings,
  saveProductSettings,
  DEFAULT_PRODUCT_SETTINGS
} from '../constants/productSettings';

interface ProductSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

type TabType = 'units' | 'hardware' | 'defaults';

const UNIT_CATEGORIES = [
  { id: 'Starred', label: 'Starred Favorites', icon: Star },
  { id: 'All', label: 'All Units', icon: SlidersHorizontal },
  { id: 'Count & Packaging', label: 'Count & Packaging', icon: Box },
  { id: 'Weight & Mass', label: 'Weight & Mass', icon: Scale },
  { id: 'Volume & Liquid', label: 'Volume & Liquid', icon: Droplet },
  { id: 'Length & Linear', label: 'Length & Linear', icon: Ruler },
  { id: 'Area & Surface', label: 'Area & Surface', icon: Square },
  { id: 'Food & Serving', label: 'Food & Serving', icon: Utensils },
  { id: 'Time & Service', label: 'Time & Service', icon: Clock },
  { id: 'Digital & Data', label: 'Digital & Data', icon: HardDrive },
  { id: 'Custom', label: 'Custom Units', icon: Tag },
];

export const ProductSettingsModal: React.FC<ProductSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<TabType>('units');

  // --- Units Tab State ---
  const [enabledCodes, setEnabledCodes] = useState<string[]>([]);
  const [starredCodes, setStarredCodes] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<MasterUnit[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);

  // New Custom Unit Form
  const [newVal, setNewVal] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newCategory, setNewCategory] = useState<MasterUnit['category']>('Count & Packaging');
  const [newHint, setNewHint] = useState<string>('');

  // --- Hardware & Preference Settings State ---
  const [hwSettings, setHwSettings] = useState<ProductHardwareSettings>(DEFAULT_PRODUCT_SETTINGS);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [detectingCameras, setDetectingCameras] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const storedEnabled = getStoredEnabledCodes();
      const storedStarred = getStoredStarredCodes();
      // Ensure only currently enabled codes remain starred!
      const validStarred = storedStarred.filter(code => storedEnabled.includes(code));

      setEnabledCodes(storedEnabled);
      setStarredCodes(validStarred);
      setCustomUnits(getStoredCustomUnits());
      setHwSettings(getStoredProductSettings());
      setSearchQuery('');
      setShowAddCustom(false);
      fetchAvailableCameras();
    }
  }, [isOpen]);

  const fetchAvailableCameras = async () => {
    setDetectingCameras(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      }
    } catch (e) {
      console.error('Camera enumeration error:', e);
    } finally {
      setDetectingCameras(false);
    }
  };

  const allCombinedUnits = useMemo(() => {
    return [...MASTER_UNITS_LIST, ...customUnits];
  }, [customUnits]);

  const filteredUnits = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const starredSet = new Set(starredCodes);

    let list = allCombinedUnits.filter(u => {
      let matchesCat = false;
      if (selectedCategory === 'Starred') {
        matchesCat = starredSet.has(u.value) && enabledCodes.includes(u.value);
      } else if (selectedCategory === 'All') {
        matchesCat = true;
      } else {
        matchesCat = u.category === selectedCategory;
      }

      const matchesQuery = !q || (
        u.value.toLowerCase().includes(q) ||
        u.label.toLowerCase().includes(q) ||
        u.category.toLowerCase().includes(q) ||
        u.hint.toLowerCase().includes(q)
      );
      return matchesCat && matchesQuery;
    });

    // Sort starred active units to the VERY TOP of the grid!
    list.sort((a, b) => {
      const aStarred = enabledCodes.includes(a.value) && starredSet.has(a.value);
      const bStarred = enabledCodes.includes(b.value) && starredSet.has(b.value);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return 0;
    });

    return list;
  }, [allCombinedUnits, selectedCategory, searchQuery, starredCodes, enabledCodes]);

  const activeUnitsForDefault = useMemo(() => {
    const enabledSet = new Set(enabledCodes);
    const starredSet = new Set(starredCodes);

    let list = allCombinedUnits.filter(u => enabledSet.has(u.value));
    if (list.length === 0) {
      list = allCombinedUnits.filter(u => u.defaultEnabled);
    }

    // Sort starred units to the top!
    list.sort((a, b) => {
      const aStarred = starredSet.has(a.value);
      const bStarred = starredSet.has(b.value);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return 0;
    });

    return list;
  }, [allCombinedUnits, enabledCodes, starredCodes]);

  useEffect(() => {
    if (activeUnitsForDefault.length > 0) {
      const isCurrentValid = activeUnitsForDefault.some(u => u.value === hwSettings.defaultUnit);
      if (!isCurrentValid) {
        setHwSettings(prev => ({ ...prev, defaultUnit: activeUnitsForDefault[0].value }));
      }
    }
  }, [activeUnitsForDefault, hwSettings.defaultUnit]);

  if (!isOpen) return null;

  const toggleUnit = (val: string) => {
    setEnabledCodes(prev => {
      if (prev.includes(val)) {
        if (prev.length <= 1) {
          toast.warning('At least one unit must remain enabled.');
          return prev;
        }
        // Auto-remove star if unticked/disabled!
        setStarredCodes(starredPrev => starredPrev.filter(c => c !== val));
        return prev.filter(c => c !== val);
      } else {
        return [...prev, val];
      }
    });
  };

  const toggleStar = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enabledCodes.includes(val)) {
      toast.warning('Check/enable this unit first before adding it to Starred favorites.');
      return;
    }
    setStarredCodes(prev => {
      if (prev.includes(val)) {
        toast.info('Unit unstarred.');
        return prev.filter(c => c !== val);
      } else {
        toast.success('Unit starred ⭐ (pinned to top)!');
        return [...prev, val];
      }
    });
  };

  const handleAddCustomUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVal = newVal.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanLabel = newLabel.trim();
    if (!cleanVal || !cleanLabel) {
      toast.warning('Please enter unit code and display label.');
      return;
    }

    const exists = allCombinedUnits.some(u => u.value.toLowerCase() === cleanVal);
    if (exists) {
      toast.warning(`A unit with code "${cleanVal}" already exists.`);
      return;
    }

    const created: MasterUnit = {
      value: cleanVal,
      label: `${cleanLabel} (${cleanVal})`,
      category: newCategory,
      hint: newHint.trim() || 'Custom store unit',
      defaultEnabled: true,
    };

    const updatedCustoms = [...customUnits, created];
    setCustomUnits(updatedCustoms);
    setEnabledCodes(prev => [...prev, cleanVal]);
    setStarredCodes(prev => [...prev, cleanVal]);
    setNewVal('');
    setNewLabel('');
    setNewHint('');
    setShowAddCustom(false);
    toast.success(`Custom unit "${cleanLabel}" added, enabled, and starred ⭐!`);
  };

  const handleDeleteCustomUnit = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedCustoms = customUnits.filter(u => u.value !== val);
    setCustomUnits(updatedCustoms);
    setEnabledCodes(prev => prev.filter(c => c !== val));
    setStarredCodes(prev => prev.filter(c => c !== val));
    toast.success('Custom unit removed.');
  };

  const handleSaveAll = () => {
    if (enabledCodes.length === 0) {
      toast.warning('Please enable at least one unit before saving.');
      return;
    }
    saveUnitSettings(enabledCodes, customUnits, starredCodes);
    saveProductSettings(hwSettings);
    toast.success('Product & hardware settings saved successfully!');
    onSaveSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 backdrop-blur-md p-3 sm:p-6 print:hidden animate-in fade-in-0 duration-200">
      <div className="flex flex-col w-full max-w-4xl max-h-[92dvh] rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Settings size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                <span>Product & Hardware Control Settings</span>
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Configure measurement units, camera scanners, USB barcode machines, and inventory defaults.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="rounded-2xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer"
            title="Close Settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Navigation Tabs */}
        <div className="flex items-center border-b border-border/80 bg-background/80 px-5 shrink-0 overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'units'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>Measurement Units ({enabledCodes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hardware')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'hardware'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Barcode size={15} />
            <span>Barcode & Scanner Hardware</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defaults')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'defaults'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Layers size={15} />
            <span>Product & Inventory Defaults</span>
          </button>
        </div>

        {/* --- TAB CONTENT 1: UNITS --- */}
        {activeTab === 'units' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 sm:p-5 border-b border-border/60 bg-background/50 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search unit by code, name, category (e.g. Kg, Liter, Feet, Box)..."
                    className="w-full rounded-2xl bg-card border border-border/80 pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Add Custom Unit Form */}
              {showAddCustom && (
                <form onSubmit={handleAddCustomUnit} className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in-0 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <Tag size={14} className="text-primary" />
                      <span>Create Custom Unit</span>
                    </span>
                    <button type="button" onClick={() => setShowAddCustom(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-4">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Unit Code *</label>
                      <input
                        type="text"
                        value={newVal}
                        onChange={(e) => setNewVal(e.target.value)}
                        placeholder="e.g. pkt_xl, tin_5l"
                        className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Display Label *</label>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. XL Pack, 5L Tin"
                        className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                      >
                        {UNIT_CATEGORIES.filter(c => c.id !== 'All' && c.id !== 'Custom' && c.id !== 'Starred').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">Hint Description</label>
                      <input
                        type="text"
                        value={newHint}
                        onChange={(e) => setNewHint(e.target.value)}
                        placeholder="e.g. Large bulk pack"
                        className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCustom(false)}
                      className="px-3 py-1 text-xs font-bold rounded-xl border border-border bg-card text-muted-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 text-xs font-black rounded-xl bg-primary text-primary-foreground shadow-2xs cursor-pointer"
                    >
                      Add & Enable Unit
                    </button>
                  </div>
                </form>
              )}

              {/* Unit Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {UNIT_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  const isStarCat = cat.id === 'Starred';
                  const countInCat = cat.id === 'Starred'
                    ? starredCodes.length
                    : cat.id === 'All' 
                      ? allCombinedUnits.length 
                      : allCombinedUnits.filter(u => u.category === cat.id).length;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-black shrink-0 transition-all cursor-pointer border ${
                        isActive 
                          ? (isStarCat ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-primary text-primary-foreground border-primary shadow-xs')
                          : (isStarCat ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20' : 'bg-card text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground')
                      }`}
                    >
                      <Icon size={13} className={isStarCat ? 'fill-amber-400 text-amber-500' : ''} />
                      <span>{cat.label}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : (isStarCat ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground')
                      }`}>
                        {countInCat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Units Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {filteredUnits.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Star size={32} className="mx-auto text-amber-400 opacity-40" />
                  <p className="text-sm font-bold text-foreground">
                    {selectedCategory === 'Starred' ? 'No Starred Units yet' : 'No units found'}
                  </p>
                  <p className="text-xs">
                    {selectedCategory === 'Starred' 
                      ? 'Click the ⭐ star icon on any unit card to pin it to your favorites.' 
                      : 'Try searching for another keyword or select a different category.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredUnits.map(unit => {
                    const isChecked = enabledCodes.includes(unit.value);
                    const isStarred = isChecked && starredCodes.includes(unit.value);
                    const isCustom = unit.category === 'Custom';
                    return (
                      <div
                        key={unit.value}
                        onClick={() => toggleUnit(unit.value)}
                        className={`relative group p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                          isChecked 
                            ? 'bg-primary/10 border-primary/60 shadow-2xs ring-1 ring-primary/30' 
                            : 'bg-card border-border/70 hover:border-primary/40 hover:bg-muted/40 hover:shadow-xs hover:-translate-y-0.5 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Checkbox */}
                          <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition-all ${
                            isChecked 
                              ? 'bg-primary text-primary-foreground border-primary shadow-2xs' 
                              : 'border-border bg-background group-hover:border-primary/50'
                          }`}>
                            {isChecked && <Check size={13} strokeWidth={3.5} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-foreground truncate">{unit.label}</span>
                              {isCustom && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                              {unit.hint}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-bold">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 uppercase font-black">{unit.value}</span>
                              <span>• {unit.category}</span>
                            </div>
                          </div>
                        </div>

                        {/* Top-Right Action Controls (Star & Delete) */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Star Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => toggleStar(unit.value, e)}
                            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                              isStarred 
                                ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-500/30' 
                                : isChecked
                                  ? 'text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10'
                                  : 'text-muted-foreground/20 hover:text-amber-500/60 hover:bg-amber-500/10 opacity-40'
                            }`}
                            title={
                              !isChecked 
                                ? 'Enable/check this unit first before starring' 
                                : isStarred 
                                  ? 'Unstar unit' 
                                  : 'Star unit (Pin to top)'
                            }
                          >
                            <Star size={16} className={isStarred ? 'fill-amber-400 text-amber-500' : ''} />
                          </button>

                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomUnit(unit.value, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                              title="Delete custom unit"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB CONTENT 2: BARCODE & SCANNER HARDWARE --- */}
        {activeTab === 'hardware' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            
            {/* Primary Scanner Hardware Selector */}
            <div>
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                <Barcode size={15} className="text-primary" />
                <span>Primary Barcode Scanner Device Mode</span>
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Select how you scan product barcodes in your store or warehouse.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Phone Camera */}
                <button
                  type="button"
                  onClick={() => setHwSettings({ ...hwSettings, scannerMode: 'phone_camera' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    hwSettings.scannerMode === 'phone_camera'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Smartphone size={20} />
                    </div>
                    {hwSettings.scannerMode === 'phone_camera' && <CheckCircle2 size={18} className="text-primary" />}
                  </div>
                  <h5 className="text-xs font-black text-foreground">Mobile Phone Camera</h5>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Use smartphone rear camera with torch/flash toggle for mobile billing.
                  </p>
                </button>

                {/* 2. Laptop / PC Webcam */}
                <button
                  type="button"
                  onClick={() => setHwSettings({ ...hwSettings, scannerMode: 'pc_webcam' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    hwSettings.scannerMode === 'pc_webcam'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Monitor size={20} />
                    </div>
                    {hwSettings.scannerMode === 'pc_webcam' && <CheckCircle2 size={18} className="text-primary" />}
                  </div>
                  <h5 className="text-xs font-black text-foreground">Laptop / PC Webcam</h5>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Use integrated laptop camera or connected USB HD webcam.
                  </p>
                </button>

                {/* 3. USB Physical Barcode Machine */}
                <button
                  type="button"
                  onClick={() => setHwSettings({ ...hwSettings, scannerMode: 'usb_machine' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    hwSettings.scannerMode === 'usb_machine'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Cpu size={20} />
                    </div>
                    {hwSettings.scannerMode === 'usb_machine' && <CheckCircle2 size={18} className="text-primary" />}
                  </div>
                  <h5 className="text-xs font-black text-foreground">USB Barcode Reader Machine</h5>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Plug & Play handheld laser / 2D scanner gun with instant Enter key detection.
                  </p>
                </button>
              </div>
            </div>

            {/* Video Input Device Picker (Webcam / Camera Selection) */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-black text-foreground">Camera Source Device</label>
                  <p className="text-[11px] text-muted-foreground">Select which connected camera sensor to use for barcode scanning.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchAvailableCameras}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} className={detectingCameras ? 'animate-spin' : ''} />
                  <span>Refresh Devices</span>
                </button>
              </div>

              <select
                value={hwSettings.selectedDeviceId || ''}
                onChange={(e) => setHwSettings({ ...hwSettings, selectedDeviceId: e.target.value })}
                className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold"
              >
                <option value="">Auto-Detect Default Camera</option>
                {availableCameras.map(cam => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera Device (${cam.deviceId.slice(0, 8)}...)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Hardware Preference Toggles */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Scanner Preferences</h4>
              
              {/* Audio Sound Beep */}
              <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-colors select-none ${
                hwSettings.soundBeepEnabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${hwSettings.soundBeepEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {hwSettings.soundBeepEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-foreground">Play Audio Beep Sound</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Plays a pleasant audio chime when a barcode is scanned successfully.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hwSettings.soundBeepEnabled}
                  onChange={(e) => setHwSettings({ ...hwSettings, soundBeepEnabled: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </label>

              {/* Auto Submit on Scanner Enter */}
              <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-colors select-none ${
                hwSettings.autoSubmitScannerKey ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${hwSettings.autoSubmitScannerKey ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-foreground">Auto-Submit on Scanner Enter Key</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Automatically select product when physical USB barcode reader sends carriage return.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hwSettings.autoSubmitScannerKey}
                  onChange={(e) => setHwSettings({ ...hwSettings, autoSubmitScannerKey: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </label>

              {/* Continuous Scan Mode */}
              <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-colors select-none ${
                hwSettings.continuousScan ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${hwSettings.continuousScan ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Camera size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-foreground">Continuous Scan Mode</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Keep camera scanner window open for scanning multiple items consecutively without closing.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hwSettings.continuousScan}
                  onChange={(e) => setHwSettings({ ...hwSettings, continuousScan: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </label>
            </div>

          </div>
        )}

        {/* --- TAB CONTENT 3: PRODUCT DEFAULTS & INVENTORY --- */}
        {activeTab === 'defaults' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <h4 className="text-xs font-black text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers size={15} className="text-primary" />
              <span>New Product Form Defaults</span>
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Default Unit */}
              <div>
                <label className="block text-xs font-bold mb-1">Default Unit of Measurement</label>
                <select
                  value={hwSettings.defaultUnit}
                  onChange={(e) => setHwSettings({ ...hwSettings, defaultUnit: e.target.value })}
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold"
                >
                  {activeUnitsForDefault.map(u => (
                    <option key={u.value} value={u.value}>
                      {starredCodes.includes(u.value) ? `⭐ ${u.label}` : u.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Pre-selected unit when creating a new product.</p>
              </div>

              {/* Default Item Type */}
              <div>
                <label className="block text-xs font-bold mb-1">Default Item Type</label>
                <select
                  value={hwSettings.defaultItemType}
                  onChange={(e) => setHwSettings({ ...hwSettings, defaultItemType: e.target.value as any })}
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold"
                >
                  <option value="physical">Physical Product (Stock tracked)</option>
                  <option value="service">Virtual Service (Consulting / Labor)</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Default selected type in Add Product modal.</p>
              </div>

              {/* Auto Barcode Prefix */}
              <div>
                <label className="block text-xs font-bold mb-1">Auto Barcode / SKU Prefix</label>
                <input
                  type="text"
                  value={hwSettings.barcodePrefix}
                  onChange={(e) => setHwSettings({ ...hwSettings, barcodePrefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. PRD-, SKU-, ITEM-"
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold uppercase"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Prefix added when auto-generating barcode numbers.</p>
              </div>

              {/* Default Return Days */}
              <div>
                <label className="block text-xs font-bold mb-1">Default Product Return Window (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={hwSettings.defaultReturnDays}
                  onChange={(e) => setHwSettings({ ...hwSettings, defaultReturnDays: parseInt(e.target.value, 10) || 7 })}
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Default return eligibility days for invoice items.</p>
              </div>

              {/* Low Stock Threshold */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-500" />
                  <span>Low Stock Warning Threshold (Quantity)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={hwSettings.lowStockThreshold}
                  onChange={(e) => setHwSettings({ ...hwSettings, lowStockThreshold: parseInt(e.target.value, 10) || 5 })}
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-semibold"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Products with stock quantity falling to or below this threshold will display a low stock alert tag.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-extrabold text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1 bg-card border border-border/80 px-3 py-1.5 rounded-xl shadow-2xs">
              <strong className="text-primary font-black">{enabledCodes.length}</strong> units active
            </span>
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-3 py-1.5 rounded-xl shadow-2xs">
              <Star size={13} className="fill-amber-400 text-amber-500" />
              <strong className="font-black">{starredCodes.length}</strong> starred
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-card border border-border/80 px-3 py-1.5 rounded-xl shadow-2xs">
              Scanner: <strong className="text-foreground font-black capitalize">{hwSettings.scannerMode.replaceAll('_', ' ')}</strong>
            </span>
          </div>

          <div className="flex items-center w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveAll}
              className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3 text-xs sm:text-sm font-black shadow-md hover:shadow-lg active:scale-98 cursor-pointer transition-all"
            >
              <CheckCircle2 size={17} />
              <span>Save Product Settings</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const UnitSettingsModal = ProductSettingsModal;
