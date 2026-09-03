// BillingMaster Frontend API Service (Node.js + MySQL REST Client)

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('billingmaster_api_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  }
  return ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5000').replace(/\/$/, '');
}

export function setApiBaseUrl(url: string | null) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('billingmaster_api_url', url.trim());
    } else {
      localStorage.removeItem('billingmaster_api_url');
    }
  }
}

export const supabaseConfigured = true; // Always enabled with Node.js backend

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('billingmaster_auth_token') : null;
let currentSession: any = null;
let currentBusinessId: string | null = typeof window !== 'undefined' ? localStorage.getItem('billingmaster_business_id') : null;

export function setCurrentBusinessId(id: string | null) {
  currentBusinessId = id;
  if (typeof window !== 'undefined') {
    if (id) {
      localStorage.setItem('billingmaster_business_id', id);
    } else {
      localStorage.removeItem('billingmaster_business_id');
    }
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || `API error (${response.status})`);
  }

  return data as T;
}

export const auth = {
  session() {
    return currentSession;
  },
  async getSession() {
    if (!authToken) {
      currentSession = null;
      return null;
    }
    try {
      const res: any = await request('/api/auth/session');
      if (res && res.session) {
        currentSession = res.session;
        return currentSession;
      }
    } catch (e) {
      console.warn('Failed to fetch session from backend:', e);
    }
    return currentSession;
  },
  async signIn(email: string, password: string) {
    const res: any = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.access_token) {
      authToken = res.access_token;
      localStorage.setItem('billingmaster_auth_token', res.access_token);
      currentSession = res.session;
      currentBusinessId = null;
      localStorage.removeItem('billingmaster_business_id');
    }
    return res.session;
  },
  async signUp(email: string, password: string, name?: string, phone?: string) {
    const res: any = await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        options: {
          data: {
            full_name: name || '',
            name: name || '',
            phone: phone || '',
          },
        },
      }),
    });

    if (res.access_token) {
      authToken = res.access_token;
      localStorage.setItem('billingmaster_auth_token', res.access_token);
      currentSession = res.session;
    }
    return res.session;
  },
  async updateUser(attributes: { password?: string; data?: any }) {
    return await request('/api/auth/user', {
      method: 'PUT',
      body: JSON.stringify(attributes),
    });
  },
  signOut() {
    authToken = null;
    currentSession = null;
    currentBusinessId = null;
    localStorage.removeItem('billingmaster_auth_token');
    localStorage.removeItem('billingmaster_business_id');
  },
};

export async function getBusinessId(): Promise<string | null> {
  if (currentBusinessId) return currentBusinessId;

  const session = await auth.getSession();
  if (!session) return null;

  try {
    const profiles: any = await request(`/api/db/profiles?id=eq.${session.user.id}&limit=1`);
    if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].business_id) {
      currentBusinessId = profiles[0].business_id;
      if (currentBusinessId) {
        localStorage.setItem('billingmaster_business_id', currentBusinessId);
      }
      return currentBusinessId;
    }
  } catch (err) {
    console.error('Failed to get business ID from backend:', err);
  }
  return null;
}

type Query = Record<string, string | number | boolean | undefined>;

function getLocalStore<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(`arventa_store_${table}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function setLocalStore<T>(table: string, items: T[]) {
  try {
    localStorage.setItem(`arventa_store_${table}`, JSON.stringify(items));
  } catch (e) {}
}

const NO_BUSINESS_ID_TABLES = ['businesses', 'profiles', 'settings', 'invoice_items', 'purchase_items'];

function filterLocals<T>(locals: T[], query: Query): T[] {
  let result = [...locals];
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || key === 'order' || key === 'limit') return;
    const valStr = String(value);
    const targetVal = valStr.startsWith('eq.') ? valStr.slice(3) : valStr;
    result = result.filter((item: any) => {
      if (item[key] === undefined) return false;
      return String(item[key]) === targetVal;
    });
  });

  if (query.order) {
    const [column, direction] = String(query.order).split('.');
    result.sort((a: any, b: any) => {
      if (direction === 'desc') {
        return (b[column] || '') > (a[column] || '') ? 1 : -1;
      }
      return (a[column] || '') > (b[column] || '') ? 1 : -1;
    });
  }

  if (query.limit) {
    result = result.slice(0, Number(query.limit));
  }

  return result;
}

export function getProductBarcode(product: any): string {
  if (!product) return '';
  let code = String(product.barcode || product.sku || '').trim();
  if (product.notes && typeof product.notes === 'string' && (product.notes.startsWith('{') || product.notes.startsWith('['))) {
    try {
      const parsed = JSON.parse(product.notes);
      if (parsed.barcode && !code) code = String(parsed.barcode).trim();
      if (parsed.sku && !code) code = String(parsed.sku).trim();
    } catch (e) {}
  }
  if (!code) return '';
  if (
    code.startsWith('AUTOSKU-') ||
    code.startsWith('NO_BARCODE-') ||
    code.startsWith('SYS-') ||
    code.startsWith('INTERNAL-')
  ) {
    return '';
  }
  return code;
}

export function generateInternalSku(id?: string): string {
  const cleanId = id ? id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : Date.now().toString(36);
  return `AUTOSKU-${cleanId.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export const db = {
  async list<T extends Record<string, any>>(table: string, query: Query = {}): Promise<T[]> {
    const activeQuery = { ...query };
    if (!activeQuery.business_id && !NO_BUSINESS_ID_TABLES.includes(table)) {
      const bid = await getBusinessId();
      if (bid) activeQuery.business_id = bid;
    }

    try {
      const params = new URLSearchParams();
      Object.entries(activeQuery).forEach(([k, v]) => {
        if (v !== undefined) params.append(k, String(v));
      });

      const remoteData = await request<T[]>(`/api/db/${table}?${params.toString()}`);
      const locals = getLocalStore<T>(table);

      if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
        const remoteIds = new Set(remoteData.map((r: any) => r.id));
        const missingLocals = locals.filter((l: any) => l.id && !remoteIds.has(l.id));
        const combined = [...remoteData, ...missingLocals];
        setLocalStore(table, combined);
        return filterLocals(combined, activeQuery);
      } else {
        if (locals.length > 0) return filterLocals(locals, activeQuery);
        return remoteData || [];
      }
    } catch (err) {
      console.warn(`db.list fallback to local store for table "${table}":`, err);
      const locals = getLocalStore<T>(table);
      return filterLocals(locals, activeQuery);
    }
  },

  async insert<T extends Record<string, any>>(table: string, values: Record<string, unknown>): Promise<T> {
    if (!values.business_id && !NO_BUSINESS_ID_TABLES.includes(table)) {
      const bid = await getBusinessId();
      if (bid) values.business_id = bid;
    }

    const itemWithId = {
      id: (values.id as string) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
      created_at: (values.created_at as string) || new Date().toISOString(),
      ...values,
    };

    try {
      const inserted = await request<T>(`/api/db/${table}`, {
        method: 'POST',
        body: JSON.stringify(itemWithId),
      });

      if (inserted) {
        const locals = getLocalStore<T>(table);
        const merged = { ...itemWithId, ...inserted } as unknown as T;
        setLocalStore(table, [merged, ...locals.filter((x: any) => x.id !== (inserted as any).id)]);
        return merged;
      }
    } catch (err) {
      console.warn(`db.insert fallback to local store for table "${table}":`, err);
    }

    const locals = getLocalStore<T>(table);
    setLocalStore(table, [itemWithId as unknown as T, ...locals.filter((x: any) => x.id !== itemWithId.id)]);
    return itemWithId as unknown as T;
  },

  async upsert<T extends Record<string, any>>(table: string, values: Record<string, unknown>): Promise<T> {
    const itemWithId = {
      id: (values.id as string) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}`),
      ...values,
    };

    try {
      const upserted = await request<T>(`/api/db/${table}/upsert`, {
        method: 'PUT',
        body: JSON.stringify(itemWithId),
      });

      if (upserted) {
        const locals = getLocalStore<T>(table);
        const merged = { ...itemWithId, ...upserted } as unknown as T;
        setLocalStore(table, [merged, ...locals.filter((x: any) => x.id !== (upserted as any).id)]);
        return merged;
      }
    } catch (err) {
      console.warn(`db.upsert fallback to local store for table "${table}":`, err);
    }

    const locals = getLocalStore<T>(table);
    const existingIndex = locals.findIndex((x: any) => x.id === itemWithId.id);
    if (existingIndex >= 0) {
      locals[existingIndex] = { ...locals[existingIndex], ...itemWithId };
      setLocalStore(table, locals);
    } else {
      setLocalStore(table, [itemWithId as unknown as T, ...locals]);
    }
    return itemWithId as unknown as T;
  },

  async update<T extends Record<string, any>>(table: string, id: string, values: Record<string, unknown>): Promise<T> {
    try {
      const updated = await request<T>(`/api/db/${table}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });

      if (updated) {
        const locals = getLocalStore<T>(table);
        const idx = locals.findIndex((x: any) => x.id === id);
        const merged = { ...(locals[idx] || {}), ...values, ...updated } as unknown as T;
        if (idx >= 0) {
          locals[idx] = merged;
          setLocalStore(table, locals);
        }
        return merged;
      }
    } catch (err) {
      console.warn(`db.update fallback to local store for table "${table}":`, err);
    }

    const locals = getLocalStore<T>(table);
    const idx = locals.findIndex((x: any) => x.id === id);
    if (idx >= 0) {
      locals[idx] = { ...locals[idx], ...values };
      setLocalStore(table, locals);
      return locals[idx];
    }
    return { id, ...values } as unknown as T;
  },

  async remove(table: string, id: string): Promise<void> {
    try {
      await request(`/api/db/${table}/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn(`db.remove fallback to local store for table "${table}":`, err);
    }
    const locals = getLocalStore<any>(table);
    setLocalStore(table, locals.filter((x: any) => x.id !== id));
  },

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    return await request<T>(`/api/rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
  },

  // Table proxy methods for backward compatibility
  get invoices() {
    return { list: (q?: Query) => db.list('invoices', q) };
  },
  get customers() {
    return { list: (q?: Query) => db.list('customers', q) };
  },
  get expenses() {
    return { list: (q?: Query) => db.list('expenses', q) };
  },
  get products() {
    return { list: (q?: Query) => db.list('products', q) };
  },
  get payments() {
    return { list: (q?: Query) => db.list('payments', q) };
  },
};

// Supabase compatibility layer so frontend components work seamlessly
export const supabase = {
  auth: {
    async getSession() {
      const session = await auth.getSession();
      return { data: { session }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const session = await auth.signIn(email, password);
        return { data: { session, user: session?.user || null }, error: null };
      } catch (err: any) {
        return { data: { session: null, user: null }, error: err };
      }
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
      try {
        const name = options?.data?.full_name || options?.data?.name;
        const phone = options?.data?.phone;
        const session = await auth.signUp(email, password, name, phone);
        return { data: { session, user: session?.user || null }, error: null };
      } catch (err: any) {
        return { data: { session: null, user: null }, error: err };
      }
    },
    async updateUser(attributes: any) {
      try {
        const res = await auth.updateUser(attributes);
        return { data: res, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    async signOut() {
      auth.signOut();
      return { error: null };
    },
    onAuthStateChange(_callback: any) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
  from(table: string) {
    return {
      select(_cols?: string) {
        return {
          eq(column: string, value: any) {
            return {
              limit(n: number) {
                return db.list(table, { [column]: `eq.${value}`, limit: n }).then((data) => ({ data, error: null }));
              },
              then(resolve: any) {
                return db.list(table, { [column]: `eq.${value}` }).then((data) => resolve({ data, error: null }));
              },
            };
          },
        };
      },
    };
  },
  async rpc<T>(name: string, args: Record<string, unknown>) {
    try {
      const data = await db.rpc<T>(name, args);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

export function getSupabaseErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
