import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Phone,
  MessageCircle, Download, Trash2, Pencil, Calendar, Clock,
  CheckCircle2, AlertCircle, RefreshCw, X, ChevronRight, ChevronDown, User, UserCheck,
  FileText, Share2, Copy, Check, ArrowLeft, Printer, MoreVertical,
  HelpCircle, CreditCard, Landmark, Wallet, Layers, ShieldCheck,
  Mail, Bell, PhoneCall, ExternalLink, Send, Lock
} from 'lucide-react';
import jsPDF from 'jspdf';
import { db, getBusinessId, auth, getSupabaseErrorMessage } from '@/lib/api';
import { useScrollReset } from '@/lib/useScrollReset';
import { toast } from 'sonner';
import { GSTVerificationInput } from './GSTVerificationInput';

// Helper to extract GSTIN safely
function getCustomerGstin(row: any): string {
  if (!row) return '';
  if (row.gstin) return String(row.gstin).toUpperCase().trim();
  if (row.gst_number) return String(row.gst_number).toUpperCase().trim();
  if (row.notes && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
    try {
      const parsed = JSON.parse(row.notes);
      if (parsed.gstin) return String(parsed.gstin).toUpperCase().trim();
      if (parsed.gst_number) return String(parsed.gst_number).toUpperCase().trim();
    } catch (e) { }
  }
  return '';
}

// Helper to extract clean customer notes
function getCustomerNotes(row: any): string {
  if (!row || !row.notes) return '';
  if (row.notes.startsWith('{') || row.notes.startsWith('[')) {
    try {
      const parsed = JSON.parse(row.notes);
      return parsed.notes || '';
    } catch (e) {
      return row.notes;
    }
  }
  return row.notes;
}

export interface KhataEntry {
  id: string;
  business_id?: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  type: 'gave' | 'got'; // 'gave' = You Gave (Udhar/Credit/Customer owes), 'got' = You Got (Payment/Advance/Customer paid)
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM AM/PM
  payment_mode?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other' | string;
  bill_reference?: string;
  note?: string;
  created_at?: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  totalGave: number; // You gave / customer took on credit
  totalGot: number; // You received / customer paid
  netBalance: number; // totalGave - totalGot (> 0 means You'll Receive, < 0 means You'll Give, 0 means Settled)
  lastEntryDate?: string;
  lastEntryNote?: string;
  entryCount: number;
}

interface KhataBookProps {
  initialCustomerId?: string;
}

export function KhataBook({ initialCustomerId }: KhataBookProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected customer for full passbook statement
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId || null);
  const [passbookFilter, setPassbookFilter] = useState<'all' | 'gave' | 'got'>('all');
  const [passbookSearch, setPassbookSearch] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'receive' | 'give' | 'settled'>(() => {
    try {
      const searchStr = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const params = new URLSearchParams(searchStr);
      const f = params.get('filter');
      if (f === 'receive' || f === 'give' || f === 'settled' || f === 'all') {
        return f;
      }
    } catch (e) { }
    return 'all';
  });

  useEffect(() => {
    const handleUrlFilter = () => {
      try {
        const searchStr = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
        const params = new URLSearchParams(searchStr);
        const f = params.get('filter');
        if (f === 'receive' || f === 'give' || f === 'settled' || f === 'all') {
          setFilterType(f);
        }
      } catch (e) { }
    };
    handleUrlFilter();
    window.addEventListener('popstate', handleUrlFilter);
    return () => window.removeEventListener('popstate', handleUrlFilter);
  }, []);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'activity' | 'balance_high' | 'name'>('activity');

  useEffect(() => {
    if (!showFilterDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  // Modals state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalType, setEntryModalType] = useState<'gave' | 'got'>('gave');
  const [editingEntry, setEditingEntry] = useState<KhataEntry | null>(null);
  useScrollReset(selectedCustomerId || showEntryModal || editingEntry);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    openingBalanceType: 'none' as 'none' | 'gave' | 'got',
    openingAmount: '',
    openingNote: 'Opening Balance',
  });

  const [showDeleteModal, setShowDeleteModal] = useState<KhataEntry | null>(null);
  const [showReminderModal, setShowReminderModal] = useState<CustomerSummary | null>(null);
  const [reminderEmailInput, setReminderEmailInput] = useState('');
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'email' | 'call'>('whatsapp');
  const [copiedReminder, setCopiedReminder] = useState(false);

  const [showContactModal, setShowContactModal] = useState<CustomerSummary | null>(null);
  const [copiedContactField, setCopiedContactField] = useState<string | null>(null);

  // Entry Form state
  const [entryForm, setEntryForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    type: 'gave' as 'gave' | 'got',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    payment_mode: '',
    bill_reference: '',
    note: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [businessName, setBusinessName] = useState('My Business');

  // Load Business & Data
  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [custs, rawEntries] = await Promise.all([
        db.list<any>('customers', { order: 'name.asc' }),
        db.list<KhataEntry>('khata_entries', { order: 'date.desc' }),
      ]);

      setCustomers(custs || []);
      setEntries(rawEntries || []);

      // Try loading business name
      try {
        const bid = await getBusinessId();
        if (bid) {
          const bList = await db.list<any>('businesses', { id: bid });
          if (bList && bList[0]?.name) {
            setBusinessName(bList[0].name);
          }
        }
      } catch (e) { }
    } catch (err) {
      console.error('Error loading khata data:', err);
      setError(getSupabaseErrorMessage(err, 'Failed to load ledger data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  // Compute Customer summaries
  const customerSummaries = useMemo<CustomerSummary[]>(() => {
    // Map entries by customer_id
    const entryMap = new Map<string, KhataEntry[]>();
    entries.forEach((e) => {
      const list = entryMap.get(e.customer_id) || [];
      list.push(e);
      entryMap.set(e.customer_id, list);
    });

    // Create summaries for all registered customers
    const list: CustomerSummary[] = customers.map((c) => {
      const cEntries = entryMap.get(c.id) || [];
      let totalGave = 0;
      let totalGot = 0;

      cEntries.forEach((entry) => {
        const amt = Number(entry.amount) || 0;
        if (entry.type === 'gave') {
          totalGave += amt;
        } else {
          totalGot += amt;
        }
      });

      // Sort entries by date descending to find latest
      const sortedEntries = [...cEntries].sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time || '12:00 PM'}`).getTime();
        const dateB = new Date(`${b.date} ${b.time || '12:00 PM'}`).getTime();
        return dateB - dateA;
      });

      const latest = sortedEntries[0];

      return {
        id: c.id,
        name: c.name || 'Unnamed Customer',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        notes: c.notes || '',
        totalGave,
        totalGot,
        netBalance: totalGave - totalGot,
        lastEntryDate: latest ? `${latest.date} ${latest.time || ''}`.trim() : undefined,
        lastEntryNote: latest?.note || latest?.bill_reference || (latest ? (latest.type === 'gave' ? 'Debit Entry' : 'Payment Received') : undefined),
        entryCount: cEntries.length,
      };
    });

    // Also include any customers present in entries but not in customers table
    const knownCustomerIds = new Set(customers.map((c) => c.id));
    entryMap.forEach((cEntries, cId) => {
      if (!knownCustomerIds.has(cId) && cEntries.length > 0) {
        let totalGave = 0;
        let totalGot = 0;
        const first = cEntries[0];

        cEntries.forEach((entry) => {
          const amt = Number(entry.amount) || 0;
          if (entry.type === 'gave') totalGave += amt;
          else totalGot += amt;
        });

        const sortedEntries = [...cEntries].sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time || '12:00 PM'}`).getTime();
          const dateB = new Date(`${b.date} ${b.time || '12:00 PM'}`).getTime();
          return dateB - dateA;
        });
        const latest = sortedEntries[0];

        list.push({
          id: cId,
          name: first.customer_name || 'Customer',
          phone: first.customer_phone || '',
          totalGave,
          totalGot,
          netBalance: totalGave - totalGot,
          lastEntryDate: latest ? `${latest.date} ${latest.time || ''}`.trim() : undefined,
          lastEntryNote: latest?.note || (latest?.type === 'gave' ? 'Debit Entry' : 'Payment Received'),
          entryCount: cEntries.length,
        });
      }
    });

    return list;
  }, [customers, entries]);

  // High-level Ledger Metrics
  const overallMetrics = useMemo(() => {
    let totalToReceive = 0; // sum of positive net balances (Customer owes us)
    let totalToGive = 0; // sum of negative net balances (We owe customer / advance)
    let countReceive = 0;
    let countGive = 0;
    let countSettled = 0;

    customerSummaries.forEach((c) => {
      if (c.netBalance > 0) {
        totalToReceive += c.netBalance;
        countReceive++;
      } else if (c.netBalance < 0) {
        totalToGive += Math.abs(c.netBalance);
        countGive++;
      } else {
        countSettled++;
      }
    });

    return {
      totalToReceive,
      totalToGive,
      netBalance: totalToReceive - totalToGive,
      countReceive,
      countGive,
      countSettled,
      totalCustomers: customerSummaries.length,
    };
  }, [customerSummaries]);

  // Filtered & Sorted Customer List
  const filteredCustomers = useMemo(() => {
    let result = customerSummaries.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );

      if (!matchesSearch) return false;

      if (filterType === 'receive') return c.netBalance > 0;
      if (filterType === 'give') return c.netBalance < 0;
      if (filterType === 'settled') return c.netBalance === 0;
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'balance_high') {
        return Math.abs(b.netBalance) - Math.abs(a.netBalance);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // default: activity (recent entries or with records first)
      if (a.entryCount > 0 && b.entryCount === 0) return -1;
      if (b.entryCount > 0 && a.entryCount === 0) return 1;
      if (a.lastEntryDate && b.lastEntryDate) {
        return b.lastEntryDate.localeCompare(a.lastEntryDate);
      }
      return 0;
    });

    return result;
  }, [customerSummaries, searchQuery, filterType, sortBy]);

  // Selected Customer details and entries
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customerSummaries.find((c) => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customerSummaries]);

  const selectedCustomerEntries = useMemo(() => {
    if (!selectedCustomerId) return [];
    const list = entries.filter((e) => e.customer_id === selectedCustomerId);

    // Sort chronological: oldest first for running balance calculation
    const chronological = [...list].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || '12:00 PM'}`).getTime();
      const dateB = new Date(`${b.date} ${b.time || '12:00 PM'}`).getTime();
      return dateA - dateB;
    });

    // Calculate running balance after each entry
    let running = 0;
    const withRunning = chronological.map((e) => {
      const amt = Number(e.amount) || 0;
      if (e.type === 'gave') {
        running += amt; // Increased due
      } else {
        running -= amt; // Reduced due / increased advance
      }
      return {
        ...e,
        runningBalance: running,
      };
    });

    // Return descending for UI display (newest first)
    return withRunning.reverse();
  }, [selectedCustomerId, entries]);

  // Format Time to 12-Hour AM/PM: e.g. "02:03 PM"
  const formatTimeTo12Hour = (timeStr?: string) => {
    if (!timeStr) return '';
    if (/am|pm/i.test(timeStr)) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].slice(0, 2).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return timeStr;
  };

  // Convert any time string to HH:mm for HTML5 time input
  const convertTimeTo24Hour = (timeStr?: string) => {
    if (!timeStr) return '';
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return timeStr;
  };

  // Format Date for Header: e.g. "Today, 25 Aug 2026" or "25 Aug 2026"
  const formatDateHeader = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const checkDate = new Date(d);
        checkDate.setHours(0, 0, 0, 0);

        const dateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        if (checkDate.getTime() === today.getTime()) {
          return `Today • ${dateFormatted}`;
        }
        if (checkDate.getTime() === yesterday.getTime()) {
          return `Yesterday • ${dateFormatted}`;
        }
        return dateFormatted;
      }
    } catch (_) { }
    return dateStr;
  };

  // Format Date cleanly: e.g. "25 Aug 2026"
  const formatCardDate = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (_) { }
    return dateStr;
  };

  // Format Date & Time: e.g. "24 Apr 2026 • 02:03 PM"
  const formatTransactionDateTime = (dateStr: string, timeStr?: string) => {
    const formattedDate = formatCardDate(dateStr);
    if (!timeStr) return formattedDate;
    return `${formattedDate} • ${formatTimeTo12Hour(timeStr)}`;
  };

  // Filtered and grouped entries by Date for Passbook Feed
  const filteredCustomerEntries = useMemo(() => {
    return selectedCustomerEntries.filter((entry) => {
      if (passbookFilter !== 'all' && entry.type !== passbookFilter) return false;
      if (passbookSearch.trim()) {
        const q = passbookSearch.toLowerCase().trim();
        const matchesNote = entry.note?.toLowerCase().includes(q);
        const matchesBill = entry.bill_reference?.toLowerCase().includes(q);
        const matchesAmount = String(entry.amount).includes(q);
        const matchesMode = entry.payment_mode?.toLowerCase().includes(q);
        if (!matchesNote && !matchesBill && !matchesAmount && !matchesMode) return false;
      }
      return true;
    });
  }, [selectedCustomerEntries, passbookFilter, passbookSearch]);

  const groupedCustomerEntries = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: typeof selectedCustomerEntries }[] = [];
    filteredCustomerEntries.forEach((entry) => {
      const rawDate = entry.date;
      const label = formatDateHeader(rawDate);
      let existing = groups.find((g) => g.dateKey === rawDate);
      if (!existing) {
        existing = { dateKey: rawDate, dateLabel: label, items: [] };
        groups.push(existing);
      }
      existing.items.push(entry);
    });
    return groups;
  }, [filteredCustomerEntries]);

  // Action: Open Modal for New Entry
  const openNewEntryModal = (type: 'gave' | 'got', customer?: CustomerSummary) => {
    setEditingEntry(null);
    setEntryModalType(type);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentTime24 = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    setEntryForm({
      customer_id: customer?.id || selectedCustomerId || (customers[0]?.id || ''),
      customer_name: customer?.name || selectedCustomer?.name || (customers[0]?.name || ''),
      customer_phone: customer?.phone || selectedCustomer?.phone || (customers[0]?.phone || ''),
      type: type,
      amount: '',
      date: todayDate,
      time: currentTime24,
      payment_mode: '',
      bill_reference: '',
      note: '',
    });
    setShowEntryModal(true);
  };

  // Action: Open Edit Entry Modal
  const openEditEntryModal = (entry: KhataEntry) => {
    setEditingEntry(entry);
    setEntryModalType(entry.type);
    setEntryForm({
      customer_id: entry.customer_id,
      customer_name: entry.customer_name,
      customer_phone: entry.customer_phone || '',
      type: entry.type,
      amount: String(entry.amount || ''),
      date: entry.date,
      time: convertTimeTo24Hour(entry.time) || '',
      payment_mode: entry.payment_mode || '',
      bill_reference: entry.bill_reference || '',
      note: entry.note || '',
    });
    setShowEntryModal(true);
  };

  // Handle Save Entry (Insert / Update)
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(entryForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Please enter a valid amount greater than 0.');
      return;
    }

    if (!entryForm.customer_id) {
      toast.warning('Please select or add a customer.');
      return;
    }

    // Find customer details
    const targetCust = customers.find((c) => c.id === entryForm.customer_id);
    const custName = targetCust?.name || entryForm.customer_name || 'Customer';
    const custPhone = targetCust?.phone || entryForm.customer_phone || '';

    setSubmitting(true);
    try {
      const payload: Partial<KhataEntry> = {
        customer_id: entryForm.customer_id,
        customer_name: custName,
        customer_phone: custPhone,
        type: entryForm.type,
        amount: amt,
        date: editingEntry ? editingEntry.date : entryForm.date,
        time: editingEntry ? editingEntry.time : entryForm.time,
        payment_mode: entryForm.payment_mode,
        bill_reference: entryForm.bill_reference || '',
        note: entryForm.note || '',
      };

      if (editingEntry) {
        await db.update('khata_entries', editingEntry.id, payload);
      } else {
        await db.insert('khata_entries', payload);
      }

      await loadAllData();
      setShowEntryModal(false);
      setEditingEntry(null);
      toast.success(editingEntry ? 'Transaction updated successfully!' : 'Transaction recorded successfully!');
    } catch (err) {
      console.error('Error saving khata entry:', err);
      toast.error(getSupabaseErrorMessage(err, 'Failed to save transaction. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Entry
  const handleDeleteEntry = async () => {
    if (!showDeleteModal) return;
    setSubmitting(true);
    try {
      await db.remove('khata_entries', showDeleteModal.id);
      await loadAllData();
      setShowDeleteModal(null);
      toast.success('Transaction deleted successfully.');
    } catch (err) {
      console.error('Error deleting entry:', err);
      toast.error(getSupabaseErrorMessage(err, 'Failed to delete transaction.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add New Customer with optional Opening Balance
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      toast.warning('Please enter a customer name.');
      return;
    }
    if (!newCustomerForm.phone.trim()) {
      toast.warning('Phone number is required for customer accounts.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert customer into customers table
      const createdCustomer = await db.insert<any>('customers', {
        name: newCustomerForm.name.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim() || null,
        address: newCustomerForm.address.trim() || null,
        notes: newCustomerForm.notes.trim() || null,
      });

      const newCustId = createdCustomer.id;

      // 2. If opening balance provided, create initial khata entry
      const openAmt = parseFloat(newCustomerForm.openingAmount);
      if (newCustomerForm.openingBalanceType !== 'none' && !isNaN(openAmt) && openAmt > 0) {
        const now = new Date();
        await db.insert<KhataEntry>('khata_entries', {
          customer_id: newCustId,
          customer_name: newCustomerForm.name.trim(),
          customer_phone: newCustomerForm.phone.trim(),
          type: newCustomerForm.openingBalanceType,
          amount: openAmt,
          date: now.toISOString().split('T')[0],
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          payment_mode: '',
          bill_reference: 'OPENING-BAL',
          note: newCustomerForm.openingNote || 'Opening balance record',
        });
      }

      await loadAllData();
      setShowCustomerModal(false);
      setNewCustomerForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        openingBalanceType: 'none',
        openingAmount: '',
        openingNote: 'Opening Balance',
      });
      setSelectedCustomerId(newCustId);
      toast.success('Customer added successfully!');
    } catch (err) {
      console.error('Error creating customer:', err);
      toast.error(getSupabaseErrorMessage(err, 'Failed to add customer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Generate WhatsApp Reminder Text
  const getWhatsAppMessage = (cust: CustomerSummary) => {
    const isDue = cust.netBalance > 0;
    const isAdvance = cust.netBalance < 0;
    const formattedAmount = `₹${Math.abs(cust.netBalance).toLocaleString('en-IN')}`;

    if (isDue) {
      return `Dear ${cust.name},\n\nThis is a polite reminder from *${businessName}* regarding your pending account balance.\n\n*Outstanding Due:* ${formattedAmount}\n*Total Credit Taken:* ₹${cust.totalGave.toLocaleString('en-IN')}\n*Total Paid:* ₹${cust.totalGot.toLocaleString('en-IN')}\n\nPlease settle the pending payment at your earliest convenience.\n\nThank you for your business!\n*${businessName}*`;
    } else if (isAdvance) {
      return `Dear ${cust.name},\n\nHere is your account statement summary from *${businessName}*:\n\n*Current Advance Balance:* ${formattedAmount} (Credit in your favor)\n*Total Purchases:* ₹${cust.totalGave.toLocaleString('en-IN')}\n*Total Paid:* ₹${cust.totalGot.toLocaleString('en-IN')}\n\nThank you for choosing *${businessName}*!`;
    } else {
      return `Dear ${cust.name},\n\nYour account with *${businessName}* is completely *Settled (₹0 Balance)*.\n\nThank you for your timely payments!\n*${businessName}*`;
    }
  };

  // Generate Email Reminder Content
  const getEmailReminder = (cust: CustomerSummary) => {
    const isDue = cust.netBalance > 0;
    const isAdvance = cust.netBalance < 0;
    const formattedAmount = `₹${Math.abs(cust.netBalance).toLocaleString('en-IN')}`;
    const subject = isDue
      ? `Payment Reminder: Outstanding Balance ${formattedAmount} - ${businessName}`
      : isAdvance
        ? `Account Statement: Advance Balance ${formattedAmount} - ${businessName}`
        : `Account Statement: Fully Settled - ${businessName}`;

    let body = `Dear ${cust.name},\n\n`;
    if (isDue) {
      body += `We hope this message finds you well.\n\nThis is a polite reminder from ${businessName} regarding your outstanding account balance.\n\n`;
      body += `Account Summary:\n`;
      body += `- Outstanding Balance Due: ${formattedAmount}\n`;
      body += `- Total Credit Given: ₹${cust.totalGave.toLocaleString('en-IN')}\n`;
      body += `- Total Payments Received: ₹${cust.totalGot.toLocaleString('en-IN')}\n\n`;
      body += `Please clear the pending balance at your earliest convenience.\n\n`;
    } else if (isAdvance) {
      body += `Here is your current account statement summary with ${businessName}.\n\n`;
      body += `Account Summary:\n`;
      body += `- Current Advance Credit: ${formattedAmount}\n`;
      body += `- Total Purchases: ₹${cust.totalGave.toLocaleString('en-IN')}\n`;
      body += `- Total Paid: ₹${cust.totalGot.toLocaleString('en-IN')}\n\n`;
    } else {
      body += `Your account with ${businessName} is fully settled with a ₹0 balance.\n\n`;
    }
    body += `Thank you for your valued business!\n\nBest regards,\n${businessName}`;

    return { subject, body };
  };

  // WhatsApp Web link for Reminder
  const openWhatsApp = (cust: CustomerSummary) => {
    const cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(getWhatsAppMessage(cust));
    const url = `https://wa.me/${phoneWithCountry}?text=${msg}`;
    window.open(url, '_blank');
  };

  // WhatsApp Direct Chat (Contact)
  const openDirectWhatsApp = (cust: CustomerSummary) => {
    const cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(`Hello ${cust.name}, contacting you from ${businessName}.`);
    const url = `https://wa.me/${phoneWithCountry}?text=${msg}`;
    window.open(url, '_blank');
  };

  // Open Email Composer for Reminder
  const openEmailReminder = (cust: CustomerSummary, targetEmail?: string) => {
    const email = targetEmail || cust.email;
    if (!email) {
      toast.warning('Please enter or provide an email address for this customer.');
      return;
    }
    const { subject, body } = getEmailReminder(cust);
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  // Copy Reminder to Clipboard
  const copyReminderText = (cust: CustomerSummary) => {
    const text = getWhatsAppMessage(cust);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReminder(true);
      setTimeout(() => setCopiedReminder(false), 2500);
    });
  };

  // Copy Contact Text
  const copyContactText = (field: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedContactField(field);
      setTimeout(() => setCopiedContactField(null), 2500);
    });
  };

  // Export PDF Passbook / Statement
  const generateCustomerPdf = (cust: CustomerSummary) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(249, 115, 22); // Orange theme accent #F97316
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(businessName.toUpperCase(), 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('CUSTOMER KHATA BOOK / ACCOUNT STATEMENT', 14, 21);

      const genDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      doc.text(`Statement Date: ${genDate}`, pageWidth - 14, 21, { align: 'right' });

      // Customer Info Box
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Customer: ${cust.name}`, 14, 38);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      if (cust.phone) doc.text(`Phone: ${cust.phone}`, 14, 44);
      if (cust.address) doc.text(`Address: ${cust.address}`, 14, 50);

      // Financial Summary Box
      const summaryY = cust.address ? 56 : 50;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, summaryY, pageWidth - 28, 24, 3, 3, 'FD');

      // Metric 1: Total Given (Credit)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL YOU GAVE (DEBIT)', 20, summaryY + 8);
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(`Rs. ${cust.totalGave.toLocaleString('en-IN')}`, 20, summaryY + 16);

      // Metric 2: Total Received (Credit)
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL YOU GOT (CREDIT)', 75, summaryY + 8);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`Rs. ${cust.totalGot.toLocaleString('en-IN')}`, 75, summaryY + 16);

      // Metric 3: Net Balance
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const isDue = cust.netBalance > 0;
      const isAdv = cust.netBalance < 0;
      doc.text(isDue ? 'NET BALANCE (YOU WILL RECEIVE)' : (isAdv ? 'NET BALANCE (CUSTOMER ADVANCE)' : 'NET BALANCE (SETTLED)'), 135, summaryY + 8);
      doc.setFontSize(12);
      if (isDue) doc.setTextColor(234, 88, 12); // Orange / Red
      else if (isAdv) doc.setTextColor(37, 99, 235); // Blue
      else doc.setTextColor(16, 185, 129); // Green
      doc.text(`Rs. ${Math.abs(cust.netBalance).toLocaleString('en-IN')}`, 135, summaryY + 16);

      // Table Header
      let tableY = summaryY + 32;
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(14, tableY, pageWidth - 28, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DATE & TIME', 18, tableY + 5.5);
      doc.text('DESCRIPTION / REF', 55, tableY + 5.5);
      doc.text('MODE', 105, tableY + 5.5);
      doc.text('YOU GAVE (-)', 135, tableY + 5.5, { align: 'right' });
      doc.text('YOU GOT (+)', 165, tableY + 5.5, { align: 'right' });
      doc.text('BALANCE', pageWidth - 18, tableY + 5.5, { align: 'right' });

      // Table Rows (chronological)
      const cEntries = entries.filter((e) => e.customer_id === cust.id).sort((a, b) => {
        return new Date(`${a.date} ${a.time || '12:00 PM'}`).getTime() - new Date(`${b.date} ${b.time || '12:00 PM'}`).getTime();
      });

      let currentBalance = 0;
      let rowY = tableY + 8;

      if (cEntries.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('No ledger transactions recorded for this account.', pageWidth / 2, rowY + 12, { align: 'center' });
      } else {
        cEntries.forEach((entry, idx) => {
          if (rowY > 270) {
            doc.addPage();
            rowY = 20;
          }

          const amt = Number(entry.amount) || 0;
          if (entry.type === 'gave') currentBalance += amt;
          else currentBalance -= amt;

          // Alternate row bg
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, rowY, pageWidth - 28, 8, 'F');
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);

          // Date & Time
          doc.text(`${entry.date} ${entry.time || ''}`.trim(), 18, rowY + 5.5);

          // Note
          const desc = entry.note || entry.bill_reference || (entry.type === 'gave' ? 'Debit' : 'Payment');
          doc.text(desc.length > 25 ? desc.substring(0, 23) + '..' : desc, 55, rowY + 5.5);

          // Mode
          const modeText = entry.payment_mode && entry.payment_mode.toLowerCase() !== 'cash' ? entry.payment_mode : '—';
          doc.text(modeText, 105, rowY + 5.5);

          // Gave (Debit)
          if (entry.type === 'gave') {
            doc.setTextColor(239, 68, 68);
            doc.setFont('helvetica', 'bold');
            doc.text(`Rs. ${amt.toLocaleString('en-IN')}`, 135, rowY + 5.5, { align: 'right' });
          } else {
            doc.setTextColor(148, 163, 184);
            doc.text('—', 135, rowY + 5.5, { align: 'right' });
          }

          // Got (Credit)
          if (entry.type === 'got') {
            doc.setTextColor(16, 185, 129);
            doc.setFont('helvetica', 'bold');
            doc.text(`Rs. ${amt.toLocaleString('en-IN')}`, 165, rowY + 5.5, { align: 'right' });
          } else {
            doc.setTextColor(148, 163, 184);
            doc.text('—', 165, rowY + 5.5, { align: 'right' });
          }

          // Running Balance
          doc.setFont('helvetica', 'bold');
          if (currentBalance > 0) doc.setTextColor(234, 88, 12);
          else if (currentBalance < 0) doc.setTextColor(37, 99, 235);
          else doc.setTextColor(16, 185, 129);
          doc.text(`Rs. ${Math.abs(currentBalance).toLocaleString('en-IN')}${currentBalance > 0 ? ' Due' : (currentBalance < 0 ? ' Adv' : '')}`, pageWidth - 18, rowY + 5.5, { align: 'right' });

          rowY += 8;
        });
      }

      // Bottom Footer
      const totalPages = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated by ${businessName} Khata Book System`, 14, 290);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, 290, { align: 'right' });
      }

      doc.save(`Khata_${cust.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement.pdf`);
    } catch (pdfErr) {
      console.error('Error generating PDF statement:', pdfErr);
      toast.error('Failed to generate PDF statement. Please try again.');
    }
  };

  // Full Khata Book Overall Export
  const generateOverallLedgerPdf = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(15, 23, 42); // Black / Dark Slate #0F172A
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(`${businessName.toUpperCase()} — ALL ACCOUNTS LEDGER`, 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 21);

      // Top Overview Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 34, pageWidth - 28, 22, 3, 3, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL TO RECEIVE (DUE)', 20, 42);
      doc.setFontSize(11);
      doc.setTextColor(234, 88, 12);
      doc.text(`Rs. ${overallMetrics.totalToReceive.toLocaleString('en-IN')}`, 20, 50);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL TO GIVE (ADVANCE)', 85, 42);
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text(`Rs. ${overallMetrics.totalToGive.toLocaleString('en-IN')}`, 85, 50);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('NET MARKET OUTSTANDING', 145, 42);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${overallMetrics.netBalance.toLocaleString('en-IN')}`, 145, 50);

      // Table Header
      let tableY = 62;
      doc.setFillColor(249, 115, 22); // Orange Accent
      doc.rect(14, tableY, pageWidth - 28, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTOMER NAME', 18, tableY + 5.5);
      doc.text('PHONE', 75, tableY + 5.5);
      doc.text('TOTAL GIVEN', 110, tableY + 5.5, { align: 'right' });
      doc.text('TOTAL GOT', 145, tableY + 5.5, { align: 'right' });
      doc.text('NET BALANCE', pageWidth - 18, tableY + 5.5, { align: 'right' });

      let rowY = tableY + 8;
      customerSummaries.forEach((cust, idx) => {
        if (rowY > 270) {
          doc.addPage();
          rowY = 20;
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, rowY, pageWidth - 28, 8, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        // Name & Phone
        doc.text(cust.name.length > 28 ? cust.name.substring(0, 26) + '..' : cust.name, 18, rowY + 5.5);
        doc.text(cust.phone || '—', 75, rowY + 5.5);

        // Given & Got
        doc.text(`Rs. ${cust.totalGave.toLocaleString('en-IN')}`, 110, rowY + 5.5, { align: 'right' });
        doc.text(`Rs. ${cust.totalGot.toLocaleString('en-IN')}`, 145, rowY + 5.5, { align: 'right' });

        // Net Balance
        doc.setFont('helvetica', 'bold');
        if (cust.netBalance > 0) {
          doc.setTextColor(234, 88, 12);
          doc.text(`Rs. ${cust.netBalance.toLocaleString('en-IN')} (Due)`, pageWidth - 18, rowY + 5.5, { align: 'right' });
        } else if (cust.netBalance < 0) {
          doc.setTextColor(37, 99, 235);
          doc.text(`Rs. ${Math.abs(cust.netBalance).toLocaleString('en-IN')} (Adv)`, pageWidth - 18, rowY + 5.5, { align: 'right' });
        } else {
          doc.setTextColor(16, 185, 129);
          doc.text('Rs. 0 (Settled)', pageWidth - 18, rowY + 5.5, { align: 'right' });
        }

        rowY += 8;
      });

      doc.save(`KhataBook_Complete_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('Error generating summary PDF:', e);
      toast.error('Failed to generate full ledger PDF.');
    }
  };

  return (
    <div className="space-y-6 pb-36 sm:pb-24 animate-in fade-in-50 duration-200">
      {/* Top Header / Breadcrumb */}
      {selectedCustomer ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCustomerId(null)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground hover:bg-muted hover:border-primary/50 transition-all shadow-xs active:scale-95 group cursor-pointer"
              title="Back to Customer Accounts List"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary flex items-center gap-1.5">
                <span>Khata Book</span>
                <span className="text-muted-foreground/60">/</span>
                <span className="text-muted-foreground">Passbook Statement</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5 flex items-center gap-2.5 flex-wrap">
                <span className="truncate text-foreground">{selectedCustomer.name}</span>
                {selectedCustomer.netBalance > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Due: ₹{Math.abs(selectedCustomer.netBalance).toLocaleString('en-IN')}
                  </span>
                ) : selectedCustomer.netBalance < 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Advance: ₹{Math.abs(selectedCustomer.netBalance).toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Settled Clean
                  </span>
                )}
              </h2>
              {selectedCustomer.phone && (
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="text-primary" />
                    <span className="font-semibold text-foreground">{selectedCustomer.phone}</span>
                  </span>
                  <span>•</span>
                  <span>{selectedCustomerEntries.length} total {selectedCustomerEntries.length === 1 ? 'record' : 'records'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Reminder Button */}
            <button
              type="button"
              onClick={() => {
                setShowReminderModal(selectedCustomer);
                setReminderEmailInput(selectedCustomer.email || '');
                setReminderChannel('whatsapp');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-bold hover:bg-amber-500/20 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Send Balance Reminder via WhatsApp, Email or Phone"
            >
              <Bell size={15} className="text-amber-600 dark:text-amber-400" />
              <span>Reminder</span>
            </button>

            {/* 2. Contact Button */}
            <button
              type="button"
              onClick={() => setShowContactModal(selectedCustomer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs sm:text-sm font-bold hover:bg-primary/20 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Contact Customer via WhatsApp, Phone or Email"
            >
              <PhoneCall size={15} />
              <span>Contact</span>
            </button>

            {/* 3. PDF Statement */}
            <button
              type="button"
              onClick={() => generateCustomerPdf(selectedCustomer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs active:scale-95 cursor-pointer"
              title="Download Passbook PDF Statement"
            >
              <Download size={14} />
              <span className="hidden sm:inline">PDF Statement</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              Financial Ledger & Balance Tracker
            </div>
            <h2 className="text-2xl font-extrabold tracking-[-.05em] sm:text-[30px]">
              Khata Book
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Record customer credit dues (You Gave) and incoming payments (You Got) to maintain clear account balances.
            </p>
          </div>
        </div>
      )}

      {/* Main Metric Cards: Exactly 2 boxes for Due (You'll Receive) and Advance (You'll Give) with symmetrical layout */}
      {!selectedCustomer && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch animate-rise">
          {/* Box 1: Total Due / You'll Receive (Pending Due) */}
          <button
            type="button"
            onClick={() => setFilterType(filterType === 'receive' ? 'all' : 'receive')}
            title={filterType === 'receive' ? 'Click to show all accounts' : 'Click to view only accounts with pending Due'}
            className={`card-shell text-left p-3.5 sm:p-5 border-l-4 border-l-amber-500 bg-card hover:bg-muted/10 transition-all flex flex-col justify-between cursor-pointer ${filterType === 'receive' ? 'ring-2 ring-amber-500 shadow-md bg-amber-500/5' : ''
              }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <ArrowDownLeft size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
                      You'll Receive (Due)
                    </div>
                  </div>
                </div>
                {filterType === 'receive' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-white shrink-0 shadow-2xs">
                    Active
                  </span>
                )}
              </div>

              <div className="mono mt-3 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground truncate">
                ₹{overallMetrics.totalToReceive.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] sm:text-xs text-muted-foreground flex items-center justify-between gap-1">
              <span className="truncate">Pending Due:</span>
              <span className="font-bold text-foreground shrink-0">{overallMetrics.countReceive} cust</span>
            </div>
          </button>

          {/* Box 2: Total Advance / You'll Give (Customer Advance Deposit) */}
          <button
            type="button"
            onClick={() => setFilterType(filterType === 'give' ? 'all' : 'give')}
            title={filterType === 'give' ? 'Click to show all accounts' : 'Click to view only accounts with Advance balance'}
            className={`card-shell text-left p-3.5 sm:p-5 border-l-4 border-l-blue-500 bg-card hover:bg-muted/10 transition-all flex flex-col justify-between cursor-pointer ${filterType === 'give' ? 'ring-2 ring-blue-500 shadow-md bg-blue-500/5' : ''
              }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">
                      You'll Give (Advance)
                    </div>
                  </div>
                </div>
                {filterType === 'give' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-600 text-white shrink-0 shadow-2xs">
                    Active
                  </span>
                )}
              </div>

              <div className="mono mt-3 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground truncate">
                ₹{overallMetrics.totalToGive.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] sm:text-xs text-muted-foreground flex items-center justify-between gap-1">
              <span className="truncate">Advance Hold:</span>
              <span className="font-bold text-foreground shrink-0">{overallMetrics.countGive} cust</span>
            </div>
          </button>
        </div>
      )}

      {/* VIEW 1: CUSTOMER DETAIL PASSBOOK STATEMENT */}
      {selectedCustomer ? (
        <div className="space-y-6">
          {/* Executive Customer Balance Hero Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-7 shadow-xs">
            {/* Subtle background ambient glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Net Balance & Status breakdown */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Net Account Balance
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-2xs ${selectedCustomer.netBalance > 0
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : selectedCustomer.netBalance < 0
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedCustomer.netBalance > 0 ? 'bg-amber-500 animate-pulse' : selectedCustomer.netBalance < 0 ? 'bg-blue-500' : 'bg-emerald-500'
                        }`} />
                      {selectedCustomer.netBalance > 0 ? "You'll Receive (Pending Due)" : selectedCustomer.netBalance < 0 ? "You'll Give (Customer Advance)" : "Settled Clean (₹0)"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline gap-3">
                    <span className={`mono text-4xl sm:text-5xl font-black tracking-tight ${selectedCustomer.netBalance > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : selectedCustomer.netBalance < 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-foreground'
                      }`}>
                      ₹{Math.abs(selectedCustomer.netBalance).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground font-medium">
                    {selectedCustomer.netBalance > 0
                      ? `${selectedCustomer.name} currently owes you ₹${Math.abs(selectedCustomer.netBalance).toLocaleString('en-IN')}.`
                      : selectedCustomer.netBalance < 0
                        ? `${selectedCustomer.name} has ₹${Math.abs(selectedCustomer.netBalance).toLocaleString('en-IN')} advance balance deposited.`
                        : 'All account dues and incoming payments are fully settled.'}
                  </p>
                </div>
              </div>

              {/* Right: Modern Executive Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:w-72">
                <button
                  type="button"
                  onClick={() => openNewEntryModal('gave', selectedCustomer)}
                  className="group relative flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md hover:shadow-red-500/20 active:scale-[0.98] transition-all text-left cursor-pointer"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowDownLeft size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black tracking-tight leading-none">
                      + You Gave (Credit)
                    </div>
                    <div className="text-[11px] text-white/80 font-medium mt-1">
                      Goods given • Increases customer due
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openNewEntryModal('got', selectedCustomer)}
                  className="group relative flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-emerald-500/20 active:scale-[0.98] transition-all text-left cursor-pointer"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowUpRight size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black tracking-tight leading-none">
                      - You Got (Payment)
                    </div>
                    <div className="text-[11px] text-white/80 font-medium mt-1">
                      Payment received • Clears balance
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Passbook Transactions Feed Section */}
          <div className="space-y-3.5">
            {/* Toolbar: Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
              {/* Type Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setPassbookFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${passbookFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  All ({selectedCustomerEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPassbookFilter('gave')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${passbookFilter === 'gave'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  You Gave ({selectedCustomerEntries.filter((e) => e.type === 'gave').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPassbookFilter('got')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${passbookFilter === 'got'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  You Got ({selectedCustomerEntries.filter((e) => e.type === 'got').length})
                </button>
              </div>

              {/* Passbook Search Input */}
              <div className="relative min-w-48 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  type="text"
                  value={passbookSearch}
                  onChange={(e) => setPassbookSearch(e.target.value)}
                  placeholder="Search entries..."
                  className="input-shell w-full pl-8 pr-8 py-1.5 text-xs rounded-xl"
                />
                {passbookSearch && (
                  <button
                    type="button"
                    onClick={() => setPassbookSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List of Grouped Entries */}
            {selectedCustomerEntries.length === 0 ? (
              <div className="card-shell p-12 text-center border border-border">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-primary mb-3">
                  <BookOpen size={24} />
                </div>
                <h4 className="font-extrabold text-base">No transactions recorded yet</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Start recording credit sales or incoming payments for {selectedCustomer.name}.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => openNewEntryModal('gave', selectedCustomer)}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <ArrowDownLeft size={14} className="stroke-[2.5]" />
                    <span>+ You Gave ₹</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewEntryModal('got', selectedCustomer)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <ArrowUpRight size={14} className="stroke-[2.5]" />
                    <span>- You Got ₹</span>
                  </button>
                </div>
              </div>
            ) : filteredCustomerEntries.length === 0 ? (
              <div className="card-shell p-8 text-center border border-border">
                <h4 className="font-extrabold text-sm">No matching transactions</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Try clearing your search query or switching filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPassbookFilter('all');
                    setPassbookSearch('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-muted text-xs font-bold hover:bg-muted/80"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedCustomerEntries.map((group) => (
                  <div key={group.dateKey} className="space-y-2.5">
                    {/* Centered Date Pill Header */}
                    <div className="flex items-center justify-center my-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-3.5 py-1 rounded-full bg-muted/80 border border-border/80 shadow-2xs">
                        <Calendar size={12} className="text-primary" />
                        <span>{group.dateLabel}</span>
                      </span>
                    </div>

                    {/* Transaction Cards */}
                    <div className="space-y-2.5">
                      {group.items.map((entry) => {
                        const isGave = entry.type === 'gave';
                        const amt = Number(entry.amount) || 0;
                        const runBal = (entry as any).runningBalance || 0;
                        const formattedTime = formatTimeTo12Hour(entry.time);
                        const formattedDate = formatCardDate(entry.date);

                        return (
                          <div
                            key={entry.id}
                            className="rounded-2xl border border-border/80 bg-card hover:border-primary/40 hover:bg-muted/10 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all group"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                              {/* Left: Icon & Description */}
                              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                {/* Transaction Type Avatar Icon */}
                                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-105 shadow-2xs ${isGave
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                  }`}>
                                  {isGave ? (
                                    <ArrowDownLeft size={20} className="stroke-[2.5]" />
                                  ) : (
                                    <ArrowUpRight size={20} className="stroke-[2.5]" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  {/* Title & Badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-extrabold text-sm sm:text-base text-foreground">
                                      {isGave ? 'You Gave (Credit / Due)' : 'You Got (Payment Received)'}
                                    </h4>

                                    {entry.bill_reference && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                        <FileText size={11} />
                                        <span>{entry.bill_reference}</span>
                                      </span>
                                    )}

                                    {entry.payment_mode && entry.payment_mode.toLowerCase() !== 'cash' && (
                                      <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted border border-border/50">
                                        {entry.payment_mode}
                                      </span>
                                    )}
                                  </div>

                                  {/* Note / Item details if present */}
                                  {entry.note && (
                                    <p className="text-xs text-foreground/80 mt-1 font-medium leading-relaxed break-words">
                                      {entry.note}
                                    </p>
                                  )}

                                  {/* Timestamp */}
                                  <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                      <Calendar size={12} className="text-muted-foreground" />
                                      <span>{formattedDate}</span>
                                    </span>
                                    {formattedTime && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 font-mono font-medium">
                                          <Clock size={11} className="text-muted-foreground" />
                                          <span>{formattedTime}</span>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Amount, Running Balance, Actions */}
                              <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                                {/* Amount Display */}
                                <div className="text-left sm:text-right">
                                  <div className={`mono text-lg sm:text-xl font-black tracking-tight ${isGave
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                    {isGave ? '+ ' : '- '}₹{amt.toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[11px] font-bold font-mono text-muted-foreground mt-0.5">
                                    Bal: <span className={runBal > 0 ? 'text-amber-600 dark:text-amber-400 font-extrabold' : runBal < 0 ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400 font-extrabold'}>
                                      ₹{Math.abs(runBal).toLocaleString('en-IN')} {runBal > 0 ? 'Due' : runBal < 0 ? 'Adv' : 'Settled'}
                                    </span>
                                  </div>
                                </div>

                                {/* Edit / Delete actions */}
                                <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => openEditEntryModal(entry)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Edit transaction"
                                  >
                                    <Pencil size={12} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteModal(entry)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Delete transaction"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW 2: CUSTOMER LEDGER LIST OVERVIEW */
        <div className="space-y-4">
          {/* Search Customer Input & Filter Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer by name or phone..."
                className="input-shell w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdown Button */}
            <div ref={filterDropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm ${filterType !== 'all'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                  }`}
                title="Filter accounts by balance type"
              >
                <Filter size={15} />
                <span className="hidden sm:inline">
                  {filterType === 'all'
                    ? 'Filter'
                    : filterType === 'receive'
                      ? "You'll Receive"
                      : "You'll Give"}
                </span>
                {filterType !== 'all' && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-white sm:hidden" />
                )}
                <ChevronDown size={14} className={`transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-2xl border border-border bg-card p-1.5 shadow-xl animate-rise">
                    <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                      Filter Customers
                    </div>

                    <div className="space-y-1 py-1">
                      {/* Option 1: All Customers */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterType('all');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filterType === 'all'
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen size={15} />
                          <span>All Customers</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                          {customerSummaries.length}
                        </span>
                      </button>

                      {/* Option 2: You'll Receive (Pending Due) */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterType('receive');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filterType === 'receive'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'text-foreground hover:bg-muted'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft size={15} className="text-amber-600 dark:text-amber-400" />
                          <span>You'll Receive (Due)</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                          {overallMetrics.countReceive}
                        </span>
                      </button>

                      {/* Option 3: You'll Give (Advance Hold) */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterType('give');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filterType === 'give'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'text-foreground hover:bg-muted'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowUpRight size={15} className="text-blue-600 dark:text-blue-400" />
                          <span>You'll Give (Advance)</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono">
                          {overallMetrics.countGive}
                        </span>
                      </button>
                    </div>

                    {filterType !== 'all' && (
                      <div className="pt-1 border-t border-border/50">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterType('all');
                            setShowFilterDropdown(false);
                          }}
                          className="w-full text-center py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Reset to All
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Quick Filter Tabs for direct one-tap switching */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterType === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              All Accounts ({customerSummaries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('receive')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterType === 'receive'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-card border border-border text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
            >
              Due ({overallMetrics.countReceive})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('give')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterType === 'give'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-card border border-border text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                }`}
            >
              Advance ({overallMetrics.countGive})
            </button>
            {overallMetrics.countSettled > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('settled')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterType === 'settled'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-card border border-border text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
              >
                Settled ({overallMetrics.countSettled})
              </button>
            )}
          </div>

          {/* Customer Cards List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="card-shell p-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-primary mb-3">
                <BookOpen size={26} />
              </div>
              <h3 className="text-base font-extrabold">No accounts found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No customer matches "${searchQuery}". Try a different name or phone.`
                  : 'Start by adding a customer or recording your first credit/debit transaction.'}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="btn-primary px-4 py-2 text-xs font-bold rounded-xl"
                >
                  + Add New Customer
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCustomers.map((cust) => {
                const isReceive = cust.netBalance > 0;
                const isGive = cust.netBalance < 0;
                const isSettled = cust.netBalance === 0;
                const initials = cust.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'CU';

                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="card-shell p-4 sm:p-5 hover:border-primary/50 transition-all group cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Avatar & Info */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xs font-extrabold shadow-xs transition-transform group-hover:scale-105 ${isReceive
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : isGive
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                              : 'bg-muted text-foreground border border-border'
                          }`}>
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                              {cust.name}
                            </h4>
                            {isReceive && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilterType('receive');
                                }}
                                title="Click to view all Due accounts"
                                className="shrink-0 text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-all shadow-2xs"
                              >
                                Due
                              </button>
                            )}
                            {isGive && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilterType('give');
                                }}
                                title="Click to view all Advance accounts"
                                className="shrink-0 text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-all shadow-2xs"
                              >
                                Advance
                              </button>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            {cust.phone ? (
                              <span>{cust.phone}</span>
                            ) : (
                              <span className="italic text-[11px]">No phone</span>
                            )}
                            {cust.lastEntryDate && (
                              <>
                                <span>•</span>
                                <span className="text-[11px]">Last: {cust.lastEntryDate}</span>
                              </>
                            )}
                          </div>

                          {cust.lastEntryNote && (
                            <div className="text-[11px] text-muted-foreground/80 truncate mt-1">
                              Note: {cust.lastEntryNote}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Net Balance & Quick Action Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60 shrink-0">
                        {/* Balance display */}
                        <div className="text-left sm:text-right">
                          <div className={`mono text-lg sm:text-xl font-black ${isReceive
                              ? 'text-amber-600 dark:text-amber-400'
                              : isGive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                            ₹{Math.abs(cust.netBalance).toLocaleString('en-IN')}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isReceive) setFilterType('receive');
                              else if (isGive) setFilterType('give');
                            }}
                            title={isReceive ? "Click to view Due accounts" : isGive ? "Click to view Advance accounts" : "Settled"}
                            className={`text-xs sm:text-[13px] font-black uppercase tracking-wider hover:underline transition-colors block text-left sm:text-right ${isReceive
                                ? 'text-amber-600 dark:text-amber-400'
                                : isGive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                          >
                            {isReceive ? 'Due' : isGive ? 'Advance' : 'Settled'}
                          </button>
                        </div>

                        {/* Quick Entry Action Buttons */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {/* Quick Give (Udhar / Credit Given) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewEntryModal('gave', cust);
                            }}
                            className="h-7 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold hover:bg-red-500/20 active:scale-95 transition-all shadow-2xs shrink-0 flex items-center justify-center"
                            title="Add Credit / Goods Given (You Gave)"
                          >
                            Give
                          </button>

                          {/* Quick Got (Payment Received) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewEntryModal('got', cust);
                            }}
                            className="h-7 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 active:scale-95 transition-all shadow-2xs shrink-0 flex items-center justify-center"
                            title="Add Payment Received (You Got)"
                          >
                            Got
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT TRANSACTION ENTRY */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <BookOpen size={18} className="text-primary" />
                  <span>
                    {editingEntry
                      ? `Edit ${entryForm.type === 'gave' ? 'Credit (You Gave)' : 'Payment (You Got)'} Entry`
                      : entryForm.type === 'gave'
                        ? 'Give Payment Form (You Gave)'
                        : 'Got Payment Form (You Got)'}
                  </span>
                </h3>
                {(entryForm.customer_name || selectedCustomer?.name) && (
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    Customer: {entryForm.customer_name || selectedCustomer?.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              {/* Type Switcher: Only shown when creating a new transaction, hidden when editing */}
              {!editingEntry && (
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">
                    Transaction Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEntryModalType('gave');
                        setEntryForm({ ...entryForm, type: 'gave' });
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-extrabold transition-all ${entryForm.type === 'gave'
                          ? 'border-red-600 bg-red-600 text-white shadow-sm'
                          : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        }`}
                    >
                      <ArrowDownLeft size={16} />
                      <span>You Gave (Credit / Due)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEntryModalType('got');
                        setEntryForm({ ...entryForm, type: 'got' });
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-extrabold transition-all ${entryForm.type === 'got'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        }`}
                    >
                      <ArrowUpRight size={16} />
                      <span>You Got (Payment / Adv)</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {entryForm.type === 'gave'
                      ? 'Increases what the customer owes you (credit/due).'
                      : 'Reduces customer due or adds advance balance.'}
                  </p>
                </div>
              )}

              {/* Amount Field */}
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    autoFocus
                    className="input-shell w-full pl-8 pr-4 py-2.5 text-base font-bold mono"
                  />
                </div>

                {/* Quick denomination buttons */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[100, 200, 500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setEntryForm({ ...entryForm, amount: String(amt) })}
                      className="px-2.5 py-1 rounded-lg border border-border bg-muted/30 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time (Locked when editing existing entry) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar size={13} className="text-primary" />
                      <span>Date *</span>
                    </label>
                    {editingEntry && (
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Lock size={10} className="text-amber-500" /> Locked
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                    disabled={!!editingEntry}
                    readOnly={!!editingEntry}
                    required
                    className={`input-shell w-full p-2.5 text-xs font-normal ${editingEntry ? 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-80 border-dashed select-none' : ''
                      }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock size={13} className="text-primary" />
                      <span>Time *</span>
                    </label>
                    {editingEntry ? (
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Lock size={10} className="text-amber-500" /> Locked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          setEntryForm((prev) => ({
                            ...prev,
                            date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
                            time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
                          }));
                        }}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Current
                      </button>
                    )}
                  </div>
                  <input
                    type="time"
                    value={entryForm.time}
                    onChange={(e) => setEntryForm({ ...entryForm, time: e.target.value })}
                    disabled={!!editingEntry}
                    readOnly={!!editingEntry}
                    required
                    className={`input-shell w-full p-2.5 text-xs font-normal ${editingEntry ? 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-80 border-dashed select-none' : ''
                      }`}
                  />
                </div>
              </div>

              {editingEntry && (
                <div className="text-[11px] text-muted-foreground bg-muted/30 border border-border/70 rounded-xl p-2.5 flex items-center gap-2">
                  <Lock size={13} className="text-amber-500 shrink-0" />
                  <span>Entry date & time cannot be modified after recording to maintain ledger integrity.</span>
                </div>
              )}

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">
                  Note / Item Details (Optional)
                </label>
                <textarea
                  value={entryForm.note}
                  onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
                  placeholder="e.g. 2 shirts taken on credit, partial payment via PhonePe..."
                  className="input-shell w-full p-2.5 text-xs font-normal min-h-16"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !entryForm.amount}
                  className={`rounded-xl px-5 py-2.5 text-xs font-extrabold text-white transition-all shadow-sm ${entryForm.type === 'gave'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {submitting
                    ? 'Saving...'
                    : editingEntry
                      ? 'Update Entry'
                      : entryForm.type === 'gave'
                        ? 'Save Give Entry (Debit)'
                        : 'Save Got Entry (Payment In)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW CUSTOMER WITH OPENING BALANCE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <User size={18} className="text-primary" />
                  <span>Add Customer Account</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Saved to database and synced across Customers list, Invoices & Khata Book.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. Rajesh Kumar"
                  required
                  autoFocus
                  className="input-shell w-full p-2.5 text-xs font-normal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  required
                  className="input-shell w-full p-2.5 text-xs font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Email (Optional)</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="email@example.com"
                    className="input-shell w-full p-2.5 text-xs font-normal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Address / City (Optional)</label>
                  <input
                    type="text"
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    placeholder="e.g. Kolkata"
                    className="input-shell w-full p-2.5 text-xs font-normal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-foreground">Notes / Remarks (Optional)</label>
                <textarea
                  value={newCustomerForm.notes}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  placeholder="e.g. Regular wholesale buyer, VIP customer..."
                  className="input-shell w-full p-2.5 text-xs font-normal min-h-16"
                />
              </div>

              {/* Opening Balance */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <label className="block text-xs font-bold text-foreground">
                  Opening Balance (Optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: 'Zero (₹0)' },
                    { id: 'gave', label: "You'll Receive (Due)" },
                    { id: 'got', label: "You'll Give (Advance)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewCustomerForm({ ...newCustomerForm, openingBalanceType: opt.id as any })}
                      className={`p-2 rounded-lg border text-[11px] font-bold transition-all text-center ${newCustomerForm.openingBalanceType === opt.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {newCustomerForm.openingBalanceType !== 'none' && (
                  <div className="pt-2 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Opening Amount (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newCustomerForm.openingAmount}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, openingAmount: e.target.value })}
                        placeholder="0.00"
                        required
                        className="input-shell w-full p-2 text-xs font-bold mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Opening Note / Reason
                      </label>
                      <input
                        type="text"
                        value={newCustomerForm.openingNote}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, openingNote: e.target.value })}
                        placeholder="e.g. Previous unpaid invoice or advance"
                        className="input-shell w-full p-2 text-xs font-normal"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newCustomerForm.name || !newCustomerForm.phone}
                  className="btn-primary rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE TRANSACTION CONFIRMATION */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-float relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-bold">Delete Transaction</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this <span className="font-bold text-foreground">₹{showDeleteModal.amount}</span> ({showDeleteModal.type === 'gave' ? 'You Gave' : 'You Got'}) entry? Account balance will automatically re-calculate.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEntry}
                disabled={submitting}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-all"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AUTOMATED REMINDER (WHATSAPP, EMAIL, CALLING) */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-float relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Send Balance Reminder</h3>
                  <p className="text-xs text-muted-foreground">Automated notification via WhatsApp, Email, or Calling</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Recipient info */}
            <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</div>
                <div className="font-extrabold text-sm text-foreground">{showReminderModal.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  {showReminderModal.phone && <span>{showReminderModal.phone}</span>}
                  {showReminderModal.email && <span>• {showReminderModal.email}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</div>
                <div className={`text-xs font-extrabold ${showReminderModal.netBalance > 0 ? 'text-amber-600 dark:text-amber-400' : showReminderModal.netBalance < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {showReminderModal.netBalance > 0 ? `Due: ₹${showReminderModal.netBalance.toLocaleString('en-IN')}` : showReminderModal.netBalance < 0 ? `Advance: ₹${Math.abs(showReminderModal.netBalance).toLocaleString('en-IN')}` : 'Settled (₹0)'}
                </div>
              </div>
            </div>

            {/* Channel Tabs */}
            <div className="mt-4 flex rounded-xl bg-muted/40 p-1 border border-border">
              <button
                type="button"
                onClick={() => setReminderChannel('whatsapp')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderChannel === 'whatsapp' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <MessageCircle size={14} className="text-emerald-600" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setReminderChannel('email')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderChannel === 'email' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Mail size={14} className="text-blue-600" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => setReminderChannel('call')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderChannel === 'call' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Phone size={14} className="text-amber-600" />
                <span>Calling</span>
              </button>
            </div>

            {/* Channel Content */}
            <div className="mt-4 space-y-4">
              {reminderChannel === 'whatsapp' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      WhatsApp Message Preview
                    </label>
                    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {getWhatsAppMessage(showReminderModal)}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => copyReminderText(showReminderModal)}
                      className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedReminder ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Message</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        openWhatsApp(showReminderModal);
                        setShowReminderModal(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MessageCircle size={15} />
                      <span>Open WhatsApp</span>
                    </button>
                  </div>
                </>
              )}

              {reminderChannel === 'email' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      value={reminderEmailInput}
                      onChange={(e) => setReminderEmailInput(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Email Body Preview
                    </label>
                    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {getEmailReminder(showReminderModal).body}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const { body } = getEmailReminder(showReminderModal);
                        navigator.clipboard.writeText(body).then(() => {
                          setCopiedReminder(true);
                          setTimeout(() => setCopiedReminder(false), 2500);
                        });
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedReminder ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        openEmailReminder(showReminderModal, reminderEmailInput);
                        setShowReminderModal(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Mail size={15} />
                      <span>Send Email</span>
                    </button>
                  </div>
                </>
              )}

              {reminderChannel === 'call' && (
                <div className="py-2 space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                    <PhoneCall size={32} className="mx-auto text-amber-600 dark:text-amber-400 mb-2" />
                    <h4 className="text-sm font-extrabold text-foreground">Direct Voice Call Reminder</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Call {showReminderModal.name} directly on their registered phone number to discuss pending balance.
                    </p>
                    <div className="text-base font-mono font-bold text-foreground mt-2">
                      {showReminderModal.phone || 'No phone number on record'}
                    </div>
                  </div>

                  {showReminderModal.phone ? (
                    <a
                      href={`tel:${showReminderModal.phone}`}
                      onClick={() => setShowReminderModal(null)}
                      className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Phone size={15} />
                      <span>Call Customer Now ({showReminderModal.phone})</span>
                    </a>
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-2">
                      No phone number registered for this customer.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONTACT CUSTOMER (WHATSAPP, PHONE DIALER, EMAIL) */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Contact Customer</h3>
                  <p className="text-xs text-muted-foreground">Direct WhatsApp, phone dialer, or email communication</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Details Card */}
            <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-extrabold text-foreground">{showContactModal.name}</div>
                  <div className="text-xs text-muted-foreground">Ledger Account #{showContactModal.id.slice(0, 8)}</div>
                </div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${showContactModal.netBalance > 0 ? 'bg-amber-500/15 text-amber-600' : showContactModal.netBalance < 0 ? 'bg-blue-500/15 text-blue-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                  {showContactModal.netBalance > 0 ? 'Due Pending' : showContactModal.netBalance < 0 ? 'Advance Balance' : 'Settled'}
                </div>
              </div>

              {showContactModal.address && (
                <div className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                  <span className="font-bold text-foreground">Address:</span> {showContactModal.address}
                </div>
              )}
            </div>

            {/* Direct Communication Action Options */}
            <div className="mt-4 space-y-2.5">
              {/* WhatsApp Action */}
              <button
                type="button"
                onClick={() => {
                  if (!showContactModal.phone) {
                    toast.warning('No phone number recorded for this customer.');
                    return;
                  }
                  openDirectWhatsApp(showContactModal);
                  setShowContactModal(null);
                }}
                className="w-full p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-2xs">
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-foreground group-hover:text-emerald-600 transition-colors">
                      WhatsApp Chat
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {showContactModal.phone ? `Open chat with ${showContactModal.phone}` : 'No phone number added'}
                    </div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-muted-foreground group-hover:text-emerald-600 transition-colors" />
              </button>

              {/* Phone Dialer Action (opens phone dialer pad pre-filled) */}
              {showContactModal.phone ? (
                <a
                  href={`tel:${showContactModal.phone}`}
                  onClick={() => setShowContactModal(null)}
                  className="w-full p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/15 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-2xs">
                      <Phone size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground group-hover:text-primary transition-colors">
                        Phone Call (Dialer)
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {showContactModal.phone} (opens dialer)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        copyContactText('phone', showContactModal.phone || '');
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Copy Phone Number"
                    >
                      {copiedContactField === 'phone' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                    <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </a>
              ) : (
                <div className="w-full p-3.5 rounded-xl border border-border bg-muted/20 text-left flex items-center gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Phone size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-foreground">Phone Call</div>
                    <div className="text-[11px] text-muted-foreground">No phone number recorded</div>
                  </div>
                </div>
              )}

              {/* Email Action */}
              {showContactModal.email ? (
                <a
                  href={`mailto:${showContactModal.email}`}
                  onClick={() => setShowContactModal(null)}
                  className="w-full p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs">
                      <Mail size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground group-hover:text-blue-600 transition-colors">
                        Send Email
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {showContactModal.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        copyContactText('email', showContactModal.email || '');
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Copy Email Address"
                    >
                      {copiedContactField === 'email' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                    <ExternalLink size={14} className="text-muted-foreground group-hover:text-blue-600 transition-colors" />
                  </div>
                </a>
              ) : (
                <div className="w-full p-3.5 rounded-xl border border-border bg-muted/20 text-left flex items-center gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Mail size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-foreground">Send Email</div>
                    <div className="text-[11px] text-muted-foreground">No email address recorded</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
