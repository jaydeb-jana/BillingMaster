import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, Plus, Trash2, Pencil, Search, Calendar, Clock,
  Tag, X, ChevronDown, Check, Store, Users, Truck, Megaphone, Receipt, Coffee,
  CalendarDays
} from 'lucide-react';

export interface ExpenseItem {
  id: string;
  category: string;
  custom_category?: string;
  amount: number;
  date: string;
  time: string;
  notes?: string;
  created_at?: string;
}

// Grouped comprehensive shop expense categories
export interface CategoryGroup {
  groupName: string;
  icon: any;
  items: string[];
}

export const EXPENSE_CATEGORIES_GROUPED: CategoryGroup[] = [
  {
    groupName: 'Store & Utilities',
    icon: Store,
    items: [
      'Shop / Showroom Rent',
      'Electricity & Power Bill',
      'Generator / Fuel / Diesel',
      'Water & Utility Bill',
      'Shop Cleaning & Housekeeping',
      'Maintenance, Electrical & Repairs',
      'Shop Renovation & Display Decor',
    ],
  },
  {
    groupName: 'Staff & Labor',
    icon: Users,
    items: [
      'Staff Monthly Salary',
      'Daily Labor Wages (Dihari)',
      'Staff Overtime & Allowances',
      'Staff Food, Tea & Refreshments',
      'Staff Festival Bonus & Incentives',
      'Staff Medical & Emergency Help',
    ],
  },
  {
    groupName: 'Stock & Logistics',
    icon: Truck,
    items: [
      'Goods Transport & Cargo Freight',
      'Courier, Parcel & Delivery Charges',
      'Loading & Unloading Fare (Coolie)',
      'Carry Bags, Cartons & Packaging',
      'Supplier / Vendor Cash Advance',
      'Raw Materials & Supplies',
    ],
  },
  {
    groupName: 'Office & Technology',
    icon: Megaphone,
    items: [
      'Printing, Bills, Books & Stationery',
      'Internet, Wi-Fi & Broadband',
      'Mobile & SIM Card Recharges',
      'Marketing, Banner & Pamphlet Ads',
      'Software & App Subscriptions',
      'Computer & POS Hardware Repairs',
    ],
  },
  {
    groupName: 'Financial & Government',
    icon: Receipt,
    items: [
      'Trade License & Municipality Fees',
      'GST, Tax & Professional Fees',
      'Bank Charges & Loan EMI',
      'Card Swiping / POS Machine Fees',
      'Insurance Premium',
      'Accountant & CA Service Fees',
    ],
  },
  {
    groupName: 'Customer & Operations',
    icon: Coffee,
    items: [
      'Customer Hospitality & Tea / Cold Drinks',
      'Customer Delivery Fare (Van / Bike)',
      'Damaged / Expired Goods Loss',
      'Cash Drawer Shortage / Rounding Diff',
      'Security Guard & CCTV Surveillance',
      'Donations, Puja & Festival Expenses',
      'Other Miscellaneous Expense',
    ],
  },
];

// Flat list for quick lookups
export const ALL_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES_GROUPED.flatMap((g) => g.items);

// Helper to get current formatted time (e.g. "09:30 PM")
function getCurrentFormattedTime(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  const strMins = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${strHours}:${strMins} ${ampm}`;
}

// Date helpers
function getFirstDayOfCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Custom Category Selector Dropdown Component for Form
function CustomCategorySelect({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return EXPENSE_CATEGORIES_GROUPED;
    const q = search.toLowerCase();
    return EXPENSE_CATEGORIES_GROUPED.map((grp) => ({
      ...grp,
      items: grp.items.filter((item) => item.toLowerCase().includes(q)),
    })).filter((grp) => grp.items.length > 0);
  }, [search]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-shell flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-all hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <div className="flex items-center gap-2 truncate">
          <Tag size={14} className="text-primary shrink-0" />
          <span className="truncate">{value || 'Select Expense Category'}</span>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[280px] max-w-sm rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-2xl backdrop-blur-md animate-rise sm:w-[340px]">
          {/* Search box inside dropdown */}
          <div className="relative mb-2 px-1">
            <Search size={13} className="absolute left-3.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search category (e.g. Rent, Tea, Salary)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-shell w-full pl-8 pr-2.5 py-1.5 text-xs"
              autoFocus
            />
          </div>

          {/* Grouped Category Options List */}
          <div className="max-h-60 overflow-y-auto space-y-3 px-1 py-1 pr-1.5 custom-scrollbar">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((grp) => {
                const GroupIcon = grp.icon;
                return (
                  <div key={grp.groupName} className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      <GroupIcon size={12} />
                      <span>{grp.groupName}</span>
                    </div>
                    <div className="space-y-0.5">
                      {grp.items.map((item) => {
                        const isSelected = value === item;
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              onChange(item);
                              setIsOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="truncate">{item}</span>
                            {isSelected && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching category found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Expenses() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ExpenseItem | null>(null);

  // Top Date Range Filter State - Default: 1st of Current Month to Today's Date
  const [startDate, setStartDate] = useState<string>(getFirstDayOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(getTodayDate);

  const [form, setForm] = useState({
    category: 'Shop / Showroom Rent',
    custom_category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: getCurrentFormattedTime(),
    notes: '',
  });

  const loadExpenses = () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem('billing_expenses_list');
      if (raw) {
        setExpenses(JSON.parse(raw));
      } else {
        setExpenses([]);
      }
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const saveExpensesToStorage = (list: ExpenseItem[]) => {
    setExpenses(list);
    localStorage.setItem('billing_expenses_list', JSON.stringify(list));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    const finalCategory = form.category === 'Other Miscellaneous Expense' && form.custom_category.trim()
      ? form.custom_category.trim()
      : form.category;

    if (editingExpense) {
      const updated = expenses.map((item) =>
        item.id === editingExpense.id
          ? {
              ...item,
              category: finalCategory,
              amount: Number(form.amount),
              date: form.date,
              time: form.time || getCurrentFormattedTime(),
              notes: form.notes,
            }
          : item
      );
      saveExpensesToStorage(updated);
    } else {
      const newItem: ExpenseItem = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        category: finalCategory,
        amount: Number(form.amount),
        date: form.date,
        time: form.time || getCurrentFormattedTime(),
        notes: form.notes,
        created_at: new Date().toISOString(),
      };
      saveExpensesToStorage([newItem, ...expenses]);
    }

    setShowModal(false);
    setEditingExpense(null);
    setForm({
      category: 'Shop / Showroom Rent',
      custom_category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      time: getCurrentFormattedTime(),
      notes: '',
    });
  };

  const handleEdit = (item: ExpenseItem) => {
    setEditingExpense(item);
    const isStandard = ALL_EXPENSE_CATEGORIES.includes(item.category);
    setForm({
      category: isStandard ? item.category : 'Other Miscellaneous Expense',
      custom_category: isStandard ? '' : item.category,
      amount: String(item.amount || ''),
      date: item.date || new Date().toISOString().split('T')[0],
      time: item.time || getCurrentFormattedTime(),
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    saveExpensesToStorage(updated);
    if (deleteConfirmItem?.id === id) {
      setDeleteConfirmItem(null);
    }
    if (editingExpense?.id === id) {
      setShowModal(false);
      setEditingExpense(null);
    }
  };

  // Filter calculation incorporating Date Range & Search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return expenses.filter((e) => {
      // Date Range Match
      let matchesDate = true;
      if (startDate && endDate) {
        matchesDate = (e.date || '') >= startDate && (e.date || '') <= endDate;
      } else if (startDate) {
        matchesDate = (e.date || '') >= startDate;
      } else if (endDate) {
        matchesDate = (e.date || '') <= endDate;
      }

      // Search Match
      const matchesSearch =
        !q ||
        e.category.toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q) ||
        (e.time || '').toLowerCase().includes(q) ||
        (e.date || '').toLowerCase().includes(q);

      return matchesDate && matchesSearch;
    });
  }, [expenses, startDate, endDate, search]);

  const totalExpenseAmount = useMemo(() => {
    return filtered.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[.18em] text-primary flex items-center gap-1.5">
          <Wallet size={14} /> Shop Outflow & Costs
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Expense Manager</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Track daily store expenditures, labor wages, rent, freight, tea, and overheads.</p>
      </div>

      {/* TOP DATE FILTER BAR - From Date (1st of Current Month) to To Date (Today) */}
      <div className="card-shell p-3.5 sm:p-4 bg-card border border-border/80 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays size={15} />
          </div>
          <span className="text-xs font-extrabold text-foreground">Date Range Filter</span>
        </div>

        {/* Date Inputs: From Date to To Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground w-12 shrink-0">From:</span>
            <div className="relative flex-1">
              <Calendar size={13} className="absolute left-2.5 top-2.5 text-primary" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-shell w-full pl-8 pr-2.5 py-1.5 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground w-12 shrink-0">To:</span>
            <div className="relative flex-1">
              <Calendar size={13} className="absolute left-2.5 top-2.5 text-primary" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-shell w-full pl-8 pr-2.5 py-1.5 text-xs font-semibold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metric summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Total Outflow Card with Action Button on the right */}
        <div className="card-shell p-4.5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Outflow</span>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'}
              </span>
            </div>
            <div className="mono mt-1 text-2xl font-bold text-destructive">
              INR {totalExpenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground">{filtered.length} expense entries recorded</span>
          </div>

          <button
            onClick={() => {
              setEditingExpense(null);
              setForm({
                category: 'Shop / Showroom Rent',
                custom_category: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                time: getCurrentFormattedTime(),
                notes: '',
              });
              setShowModal(true);
            }}
            className="btn-primary shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold shadow-sm"
          >
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>

        <div className="card-shell p-4.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Most Frequent Cost</span>
          <div className="mt-1 text-base sm:text-lg font-bold text-foreground truncate">
            {filtered.length > 0
              ? Object.entries(
                  filtered.reduce((acc, curr) => {
                    acc[curr.category] = (acc[curr.category] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
              : '—'}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {filtered.length > 0 ? 'Highest occurrence in selected range' : 'No entries recorded'}
          </span>
        </div>
      </div>

      {/* Full-width Instant Search Bar */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search notes, category, date, or time..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-shell w-full pl-9 pr-3 text-xs"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Expense List Table */}
      <div className="card-shell overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/70 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Category / Reason</th>
                <th className="px-4 py-3">Notes & Details</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">{item.date}</td>
                    <td className="mono px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        <Clock size={11} className="text-primary shrink-0" />
                        {item.time || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
                        <Tag size={12} /> {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground max-w-xs truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="mono px-4 py-3.5 text-right font-bold text-destructive whitespace-nowrap">
                      - INR {Number(item.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(item)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmItem(item)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">No expense entries found for the selected date range.</p>
                    <p className="text-xs">Adjust the date filter above or click "Add Expense" to log a new store expenditure.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal with Custom Dropdown & Time Input */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card-shell w-full max-w-lg bg-card p-6 shadow-2xl animate-rise border border-border/80">
            <div className="flex items-center justify-between border-b border-border/70 pb-3.5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Wallet size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    {editingExpense ? 'Edit Expense Record' : 'Log New Expense'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Record store outlays with exact time and categorization</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Custom Expense Category Dropdown */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Expense Category / Reason *
                </label>
                <CustomCategorySelect
                  value={form.category}
                  onChange={(cat) => setForm({ ...form, category: cat })}
                />
              </div>

              {/* If "Other Miscellaneous Expense" selected, show custom name input */}
              {form.category === 'Other Miscellaneous Expense' && (
                <div className="animate-rise">
                  <label className="block text-xs font-bold text-primary mb-1">
                    Specify Custom Expense Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Special shop decoration, Emergency plumbing..."
                    value={form.custom_category}
                    onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                    className="input-shell w-full px-3 py-2 text-xs font-semibold"
                  />
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Amount (INR) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">INR</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="input-shell w-full pl-12 pr-3 py-2 text-sm font-bold"
                  />
                </div>
              </div>

              {/* Date and Time Fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground">Date *</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, date: new Date().toISOString().split('T')[0] })}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Today
                    </button>
                  </div>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="input-shell w-full pl-8 pr-2.5 py-2 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground">Time (Hour : Minute) *</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, time: getCurrentFormattedTime() })}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Set Now
                    </button>
                  </div>
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 09:30 PM or 14:15"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="input-shell w-full pl-8 pr-2.5 py-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Description */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Notes & Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid electric bill for showroom or tea snacks for 5 guests..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-shell mt-1 w-full p-2.5 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2.5 pt-3.5 border-t border-border/70">
                {editingExpense ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmItem(editingExpense)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Delete Record</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="input-shell px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary rounded-xl px-5 py-2 text-xs font-bold shadow-sm"
                  >
                    {editingExpense ? 'Save Changes' : 'Record Expense'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Bypasses iframe alert/confirm issues) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-sm bg-card p-6 shadow-2xl animate-rise border border-destructive/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Delete Expense Record?</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-bold text-foreground truncate max-w-[180px]">{deleteConfirmItem.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-destructive mono">INR {Number(deleteConfirmItem.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date & Time:</span>
                <span className="text-foreground">{deleteConfirmItem.date} {deleteConfirmItem.time ? `• ${deleteConfirmItem.time}` : ''}</span>
              </div>
              {deleteConfirmItem.notes && (
                <div className="flex justify-between pt-1 border-t border-border/40 text-[11px]">
                  <span className="text-muted-foreground">Note:</span>
                  <span className="text-foreground truncate max-w-[180px]">{deleteConfirmItem.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="input-shell px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmItem.id)}
                className="btn-danger rounded-xl px-4 py-2 text-xs font-bold shadow-sm"
              >
                Yes, Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
