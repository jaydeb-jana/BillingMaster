import { useState } from 'react';
import { useScrollReset, useBodyScrollLock } from '@/lib/useScrollReset';
import {
  HelpCircle, Mail, Phone, MessageSquare, Search, Copy, Check,
  ChevronDown, ChevronUp, ExternalLink, X, Clock, ShieldCheck,
  FileText, BookOpen, Package, Printer, Send, CheckCircle2, Sparkles
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  id: string;
  category: 'billing' | 'khata' | 'stock' | 'printer' | 'account';
  question: string;
  answer: string;
  tags: string[];
}

const FAQ_LIST: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'billing',
    question: 'How do I generate GST Invoices with HSN Codes?',
    answer: 'Go to Invoices → New Invoice. If your business GSTIN is configured in Settings, the tax engine automatically calculates CGST, SGST, or IGST based on the state of supply. You can choose HSN/SAC codes for each line item.',
    tags: ['gst', 'invoice', 'hsn', 'tax', 'cgst', 'sgst', 'igst']
  },
  {
    id: 'faq-2',
    category: 'khata',
    question: 'How does Khata Book customer credit tracking work?',
    answer: 'When creating an invoice with payment status "Unpaid" or "Partial", the remaining balance is automatically posted to the customer\'s Khata Ledger. You can record payments, view transaction histories, and send payment reminders with UPI QR codes anytime.',
    tags: ['khata', 'credit', 'ledger', 'udhar', 'payment', 'due', 'balance']
  },
  {
    id: 'faq-3',
    category: 'printer',
    question: 'How do I configure POS Thermal Receipt Printers (58mm / 80mm)?',
    answer: 'In the invoice preview, click "Print / Thermal POS". You can choose between 58mm (2-inch mini portable Bluetooth) and 80mm (3-inch countertop USB/LAN) formats. Thermal print layouts are optimized for ESC/POS with barcode and QR payment code support.',
    tags: ['printer', 'thermal', 'pos', 'receipt', '58mm', '80mm', 'bluetooth', 'usb']
  },
  {
    id: 'faq-4',
    category: 'stock',
    question: 'How do I track stock and set Low Stock Alerts?',
    answer: 'Under Products, every item can have a stock quantity and a Minimum Alert Level. When inventory drops below the threshold, the system displays real-time warning badges on your Dashboard overview.',
    tags: ['stock', 'inventory', 'low stock', 'products', 'alert', 'warehouse']
  },
  {
    id: 'faq-5',
    category: 'billing',
    question: 'Can I add my business logo, signature, and UPI payment QR?',
    answer: 'Yes! Navigate to Settings → Business Profile to upload your company logo, authorized signatory signature, bank account details, and UPI ID for automatic dynamic payment QR codes on every invoice.',
    tags: ['logo', 'signature', 'upi', 'qr code', 'bank', 'profile', 'branding']
  },
  {
    id: 'faq-6',
    category: 'account',
    question: 'How is my business data secured and backed up?',
    answer: 'All data is stored in real-time encrypted cloud storage with automatic continuous backups. You can also export your GSTR-1, GSTR-3B, ledger books, and Excel statements anytime under the Reports section.',
    tags: ['backup', 'security', 'export', 'excel', 'reports', 'ca', 'gstr']
  }
];

export function HelpCenterModal({ isOpen, onClose }: HelpCenterModalProps) {
  useScrollReset(isOpen);
  useBodyScrollLock(isOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('faq-1');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  
  // Direct Message State
  const [supportTab, setSupportTab] = useState<'faq' | 'contact'>('faq');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userSubject, setUserSubject] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [messageSubmitted, setMessageSubmitted] = useState(false);

  if (!isOpen) return null;

  const supportEmail = 'arventaventures@gmail.com';
  const supportPhone = '+919876543210';
  const supportPhoneDisplay = '+91 98765 43210';

  const copyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const copyPhone = () => {
    navigator.clipboard.writeText(supportPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const filteredFaqs = FAQ_LIST.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;
    const matchesQuery = item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  const handleSendViaEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(userSubject || 'BillingMaster Support Request');
    const body = encodeURIComponent(
      `Name: ${userName || 'Merchant'}\n` +
      `Email: ${userEmail || 'Not provided'}\n\n` +
      `Message:\n${userMessage || 'I need help with my account/billing.'}\n\n` +
      `---\nSent from BillingMaster App`
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setMessageSubmitted(true);
  };

  const handleSendViaWhatsApp = () => {
    const text = encodeURIComponent(
      `*BillingMaster - Support Request*\n` +
      `*Name:* ${userName || 'Merchant'}\n` +
      `*Subject:* ${userSubject || 'General Inquiry'}\n` +
      `*Message:* ${userMessage || 'Hello, I need assistance with BillingMaster.'}`
    );
    window.open(`https://api.whatsapp.com/send?phone=${supportPhone}&text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="card-shell w-full max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border border-border animate-rise bg-card">
        
        {/* TOP HEADER */}
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <HelpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Help & Support Desk</h3>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] px-2 py-0.5 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Official customer support, guides & contact channels</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Close"
          >
            <X size={19} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-5 pt-3 pb-0 border-b border-border/70 flex gap-2">
          <button
            onClick={() => setSupportTab('faq')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              supportTab === 'faq'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Knowledge Base & FAQs
          </button>
          <button
            onClick={() => setSupportTab('contact')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              supportTab === 'contact'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail size={13} />
            <span>Contact & Email Desk</span>
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* PRIMARY SUPPORT CHANNELS (Always prominent) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* EMAIL SUPPORT CARD */}
            <div className="p-3.5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Mail size={16} />
                    </div>
                    <span className="text-xs font-extrabold text-foreground">Official Email Support</span>
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    24/7 Inbox
                  </span>
                </div>
                <p className="text-xs font-bold font-mono text-foreground mt-2 break-all">{supportEmail}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Direct technical assistance & billing queries</p>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                <a
                  href={`mailto:${supportEmail}?subject=Support%20Request%20-%20BillingMaster`}
                  className="flex-1 btn-primary py-1.5 px-2.5 rounded-xl text-center text-xs font-bold no-underline inline-flex items-center justify-center gap-1.5"
                >
                  <Mail size={13} />
                  <span>Send Email</span>
                </a>
                <button
                  onClick={copyEmail}
                  type="button"
                  className="p-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-colors"
                  title="Copy Email"
                >
                  {copiedEmail ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* WHATSAPP & PHONE CARD */}
            <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <MessageSquare size={16} />
                    </div>
                    <span className="text-xs font-extrabold text-foreground">WhatsApp Hotline</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Instant Reply
                  </span>
                </div>
                <p className="text-xs font-bold font-mono text-foreground mt-2">{supportPhoneDisplay}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mon–Sat 9:00 AM – 8:00 PM IST</p>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                <a
                  href={`https://api.whatsapp.com/send?phone=${supportPhone}&text=Hello%2C%20I%20need%20support%20with%20BillingMaster.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-center text-xs font-bold no-underline inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <MessageSquare size={13} />
                  <span>Chat on WhatsApp</span>
                </a>
                <button
                  onClick={copyPhone}
                  type="button"
                  className="p-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-colors"
                  title="Copy Phone Number"
                >
                  {copiedPhone ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: KNOWLEDGE BASE & FAQS */}
          {supportTab === 'faq' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search questions, GST, Khata, thermal printing..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-shell w-full pl-9 pr-8 text-xs py-2"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All Topics' },
                  { id: 'billing', label: 'Invoices & GST' },
                  { id: 'khata', label: 'Khata Book' },
                  { id: 'printer', label: 'Thermal Printers' },
                  { id: 'stock', label: 'Inventory' },
                  { id: 'account', label: 'Backup & Security' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      activeCategory === cat.id
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* FAQ Accordion List */}
              <div className="space-y-2">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-xs font-bold text-foreground">No matching topics found</p>
                    <p className="text-[11px] mt-1">Please try searching with different keywords or send us an email directly.</p>
                  </div>
                ) : (
                  filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaq === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className="rounded-xl border border-border/80 bg-card overflow-hidden transition-all shadow-xs"
                      >
                        <button
                          onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                          className="w-full p-3.5 text-left flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-xs font-extrabold text-foreground">{faq.question}</span>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-primary shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-0 text-xs text-muted-foreground border-t border-border/40 bg-muted/10">
                            <p className="leading-relaxed mt-2">{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT CONTACT & EMAIL DESK */}
          {supportTab === 'contact' && (
            <div className="space-y-4 animate-fade-in">
              {messageSubmitted ? (
                <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-3">
                  <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="text-sm font-extrabold text-foreground">Inquiry Ready to Dispatch</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Your email client will open with your pre-filled inquiry. You can also send the inquiry instantly via WhatsApp.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      onClick={handleSendViaWhatsApp}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <MessageSquare size={14} />
                      <span>Send to WhatsApp Desk</span>
                    </button>
                    <button
                      onClick={() => {
                        setMessageSubmitted(false);
                        setUserMessage('');
                      }}
                      className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-bold text-xs"
                    >
                      Write Another Message
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendViaEmail} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-foreground mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Jaydeb Jana"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="input-shell w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-foreground mb-1">Your Contact Email</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g., merchant@gmail.com"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="input-shell w-full text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-foreground mb-1">Subject / Issue Topic</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., GST Invoice calculation query / Printer setup"
                      value={userSubject}
                      onChange={(e) => setUserSubject(e.target.value)}
                      className="input-shell w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-foreground mb-1">Detailed Message / Description</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe what you need help with or any features you would like added..."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      className="input-shell w-full text-xs"
                    />
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSendViaWhatsApp}
                      className="rounded-xl px-4 py-2 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare size={14} />
                      <span>Send Direct via WhatsApp</span>
                    </button>
                    
                    <button
                      type="submit"
                      className="btn-primary rounded-xl px-5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Send size={14} />
                      <span>Submit Inquiry via Email</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* BOTTOM FOOTER */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>BillingMaster Support Desk</span>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-1.5 font-bold text-foreground hover:bg-muted text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
