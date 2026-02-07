const API_BASE = '/api/v1';

/** Backend origin for resolving relative image URLs (e.g. /uploads/photos/... → https://localhost:8090/uploads/photos/...). Set VITE_API_ORIGIN or use default in dev. */
const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ??
  (import.meta.env.DEV ? 'http://localhost:8090' : '');

/**
 * Resolve product/image URL for display. Relative paths (e.g. /uploads/photos/..., /data/images/...) are prefixed with the backend origin (e.g. http://localhost:8090) so images load correctly.
 */
export function resolveImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return API_ORIGIN ? `${API_ORIGIN.replace(/\/$/, '')}${url}` : url;
}

/** Thrown when the API returns 4xx/5xx. Use fields for validation errors (400) to show inline. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('careplus_access_token');
}

/** Chat token for customer chat (from link). If set, used for /chat/* requests; else staff uses access token. */
export function getChatToken(): string | null {
  return localStorage.getItem('careplus_chat_token');
}

export function setChatToken(token: string | null): void {
  if (token) localStorage.setItem('careplus_chat_token', token);
  else localStorage.removeItem('careplus_chat_token');
}

function throwOnNotOk(res: Response, data: { message?: string; code?: string; fields?: Record<string, string> }): never {
  const message = data?.message || res.statusText;
  if (res.status === 400 && data?.fields && Object.keys(data.fields).length > 0) {
    throw new ApiError(message, data.code, data.fields);
  }
  throw new ApiError(message, data?.code);
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({})) as { message?: string; code?: string; fields?: Record<string, string> };
  if (!res.ok) {
    throwOnNotOk(res, data);
  }
  return data as T;
}

/** Multipart/form-data upload (no Content-Type header so browser sets boundary). */
export async function apiUpload<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  const data = await res.json().catch(() => ({})) as { message?: string; code?: string; fields?: Record<string, string> };
  if (!res.ok) {
    throwOnNotOk(res, data);
  }
  return data as T;
}

/** Token for chat API/WS: customer chat token if in customer chat context, else staff access token. */
export function getChatAuthToken(): string | null {
  return getChatToken() || getToken();
}

/** Chat API requests use chat token (customer) or access token (staff). */
async function apiChat<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getChatAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({})) as { message?: string; code?: string; fields?: Record<string, string> };
  if (!res.ok) {
    throwOnNotOk(res, data);
  }
  return data as T;
}

async function apiChatUpload<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const token = getChatAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  const data = await res.json().catch(() => ({})) as { message?: string; code?: string; fields?: Record<string, string> };
  if (!res.ok) {
    throwOnNotOk(res, data);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { pharmacy_id: string; email: string; password: string; name?: string; role?: string }) =>
    api<User>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (refreshToken: string) =>
    api<{ access_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  me: () => api<User>('/auth/me'),
  updateProfile: (body: { name: string }) =>
    api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    api<{ message: string }>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const addressesApi = {
  list: () => api<UserAddress[]>('/auth/me/addresses'),
  create: (body: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    phone?: string;
    set_as_default?: boolean;
  }) => api<UserAddress>('/auth/me/addresses', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: string,
    body: {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
      phone?: string;
      set_as_default?: boolean;
    }
  ) => api<UserAddress>(`/auth/me/addresses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/auth/me/addresses/${id}`, { method: 'DELETE' }),
  setDefault: (id: string) =>
    api<UserAddress>(`/auth/me/addresses/${id}/default`, { method: 'PATCH' }),
};

export const pharmacyApi = {
  list: () => api<Pharmacy[]>('/pharmacies'),
  get: (id: string) => api<Pharmacy>(`/pharmacies/${id}`),
  create: (body: Partial<Pharmacy>) => api<Pharmacy>('/pharmacies', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Pharmacy>) => api<Pharmacy>(`/pharmacies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

/** Catalog sort options for product listing */
export type CatalogSort = 'name' | 'price_asc' | 'price_desc' | 'newest';

/** Public store API (no auth required) – for browsing products without login */
/** Payment gateway (e.g. eSewa, Khalti, QR, Cash on Delivery, Fonepay) – shown in checkout. */
export interface PaymentGateway {
  id: string;
  pharmacy_id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** List payment gateways (public – for checkout). Use publicStoreApi.listPaymentGateways(pharmacyId). */
export const paymentGatewaysApi = {
  /** List gateways for current pharmacy (auth). ?active=true for active only. */
  list: (params?: { active?: boolean }) => {
    const q = params?.active === true ? '?active=true' : '';
    return api<PaymentGateway[]>(`/payment-gateways${q}`);
  },
  get: (id: string) => api<PaymentGateway>(`/payment-gateways/${id}`),
  create: (body: { code: string; name: string; is_active?: boolean; sort_order?: number }) =>
    api<PaymentGateway>('/payment-gateways', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { code?: string; name?: string; is_active?: boolean; sort_order?: number }) =>
    api<PaymentGateway>(`/payment-gateways/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/payment-gateways/${id}`, { method: 'DELETE' }),
};

export const publicStoreApi = {
  listPharmacies: () => api<Pharmacy[]>('/public/pharmacies'),
  getPharmacy: (id: string) => api<Pharmacy>(`/public/pharmacies/${id}`),
  getConfig: (pharmacyId: string) => api<PharmacyConfig>(`/public/pharmacies/${pharmacyId}/config`),
  /** Active payment gateways for checkout (public). */
  listPaymentGateways: (pharmacyId: string) =>
    api<PaymentGateway[]>(`/public/pharmacies/${pharmacyId}/payment-gateways`),
  /** Categories for a pharmacy (public, for catalog filters) */
  listCategories: (pharmacyId: string) => api<Category[]>(`/public/pharmacies/${pharmacyId}/categories`),
  listProducts: (pharmacyId: string, params?: { category?: string; in_stock?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Product[]>(`/public/pharmacies/${pharmacyId}/products${q ? `?${q}` : ''}`);
  },
  /** Paginated product list for store/catalog. Supports search (q), sort, category, in_stock, hashtag, brand, label_key, label_value. Returns { items, total }. */
  listProductsPaginated: (
    pharmacyId: string,
    params?: {
      category?: string;
      in_stock?: string | boolean;
      limit?: number;
      offset?: number;
      q?: string;
      sort?: CatalogSort;
      hashtag?: string;
      brand?: string;
      label_key?: string;
      label_value?: string;
    }
  ) => {
    const p = { limit: 12, offset: 0, ...params };
    const searchParams: Record<string, string> = {
      limit: String(p.limit),
      offset: String(p.offset),
      ...(p.category ? { category: p.category } : {}),
      ...(p.in_stock !== undefined ? { in_stock: String(p.in_stock) } : {}),
      ...(p.q?.trim() ? { q: p.q.trim() } : {}),
      ...(p.sort ? { sort: p.sort } : {}),
      ...(p.hashtag?.trim() ? { hashtag: p.hashtag.trim() } : {}),
      ...(p.brand?.trim() ? { brand: p.brand.trim() } : {}),
      ...(p.label_key?.trim() ? { label_key: p.label_key.trim() } : {}),
      ...(p.label_value?.trim() ? { label_value: p.label_value.trim() } : {}),
    };
    const q = new URLSearchParams(searchParams).toString();
    return api<ProductListPaginated>(`/public/pharmacies/${pharmacyId}/products?${q}`);
  },
  getProduct: (id: string) => api<Product>(`/public/products/${id}`),
  /** Offers, announcements, events (ads-style promos) for the public store. Optional type: offer, announcement, event. */
  listPromos: (pharmacyId: string, params?: { type?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Promo[]>(`/public/pharmacies/${pharmacyId}/promos${q ? `?${q}` : ''}`);
  },
  listReviews: (productId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<ProductReviewWithMeta[]>(`/public/products/${productId}/reviews${q ? `?${q}` : ''}`);
  },
};

export const configApi = {
  get: () => api<PharmacyConfig>('/config'),
  update: (body: Partial<PharmacyConfig>) =>
    api<PharmacyConfig>('/config', { method: 'PUT', body: JSON.stringify(body) }),
};

/** Dashboard stats (orders, products; for manager also pharmacists, today roster, today dailies). */
export interface DashboardStats {
  orders_count: number;
  products_count: number;
  pharmacists_count: number;
  today_roster_count: number;
  today_dailies_count: number;
}

export const dashboardApi = {
  getStats: () => api<DashboardStats>('/dashboard/stats'),
  getActiveAnnouncements: () => api<Announcement[]>('/announcements/active'),
};

/** Announcements shown as dashboard popups (offers, open/closed status, events). */
export interface Announcement {
  id: string;
  pharmacy_id: string;
  type: 'offer' | 'status' | 'event';
  template: 'celebration' | 'banner' | 'modal';
  title: string;
  body: string;
  image_url?: string;
  link_url?: string;
  display_seconds: number;
  valid_days: number;
  show_terms: boolean;
  terms_text: string;
  allow_skip_all: boolean;
  start_at?: string | null;
  end_at?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const announcementApi = {
  list: (params?: { active?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.active !== undefined) q.set('active', String(params.active));
    const s = q.toString();
    return api<Announcement[]>(`/announcements${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api<Announcement>(`/announcements/${id}`),
  create: (body: Partial<Announcement> & { type: string; title: string }) =>
    api<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Announcement>) =>
    api<Announcement>(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    api<{ message: string }>(`/announcements/${id}`, { method: 'DELETE' }),
  acknowledge: (id: string, skipAll = false) =>
    api<{ message: string }>(`/announcements/${id}/ack`, {
      method: 'POST',
      body: JSON.stringify({ skip_all: skipAll }),
    }),
  skipAll: () =>
    api<{ message: string }>('/announcements/skip-all', { method: 'POST' }),
};

export interface Category {
  id: string;
  pharmacy_id: string;
  parent_id?: string | null;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  parent?: Category | null;
}

export const categoryApi = {
  list: (params?: { parent_id?: string | null }) => {
    const q = params?.parent_id != null && params.parent_id !== '' ? `?parent_id=${encodeURIComponent(params.parent_id)}` : '';
    return api<Category[]>(`/categories${q}`);
  },
  /** List top-level categories (no parent_id) or subcategories (parent_id = category id). */
  listByParent: (parentId: string | null) => {
    if (parentId == null || parentId === '') return api<Category[]>('/categories');
    return api<Category[]>(`/categories?parent_id=${encodeURIComponent(parentId)}`);
  },
  get: (id: string) => api<Category>(`/categories/${id}`),
  create: (body: Partial<Category> & { parent_id?: string | null }) => api<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Category> & { parent_id?: string | null }) => api<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
};

export interface ProductUnit {
  id: string;
  pharmacy_id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const productUnitApi = {
  list: () => api<ProductUnit[]>('/product-units'),
  get: (id: string) => api<ProductUnit>(`/product-units/${id}`),
  create: (body: Partial<ProductUnit>) => api<ProductUnit>('/product-units', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<ProductUnit>) => api<ProductUnit>(`/product-units/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/product-units/${id}`, { method: 'DELETE' }),
};

export interface Membership {
  id: string;
  pharmacy_id: string;
  name: string;
  description: string;
  discount_percent: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const membershipApi = {
  list: () => api<Membership[]>('/memberships'),
  get: (id: string) => api<Membership>(`/memberships/${id}`),
  create: (body: Partial<Membership>) =>
    api<Membership>('/memberships', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Membership>) =>
    api<Membership>(`/memberships/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/memberships/${id}`, { method: 'DELETE' }),
};

/** Paginated product list response (when limit > 0) */
export interface ProductListPaginated {
  items: Product[];
  total: number;
}

export const productApi = {
  list: (params?: { category?: string; in_stock?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Product[]>(`/products${q ? `?${q}` : ''}`);
  },
  /** Paginated list for 18+ products. Returns { items, total }. Optional q for search (name/SKU/brand). Default page size 10. */
  listPaginated: (params?: { category?: string; in_stock?: string; limit?: number; offset?: number; q?: string }) => {
    const p = { limit: 10, offset: 0, ...params };
    const q = new URLSearchParams({
      limit: String(p.limit),
      offset: String(p.offset),
      ...(p.category ? { category: p.category } : {}),
      ...(p.in_stock !== undefined ? { in_stock: String(p.in_stock) } : {}),
      ...(p.q?.trim() ? { q: p.q.trim() } : {}),
    }).toString();
    return api<ProductListPaginated>(`/products?${q}`);
  },
  get: (id: string) => api<Product>(`/products/${id}`),
  /** Look up product by barcode (pharmacy-scoped). */
  getByBarcode: (barcode: string) => api<Product>(`/products/by-barcode/${encodeURIComponent(barcode.trim())}`),
  create: (body: Partial<Product>) => api<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Product>) => api<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStock: (id: string, quantity: number) =>
    api<{ message: string }>(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  delete: (id: string) => api<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),
  addImage: (productId: string, file: File, isPrimary = false) => {
    const form = new FormData();
    form.append('file', file);
    form.append('is_primary', String(isPrimary));
    return apiUpload<ProductImage>(`/products/${productId}/images`, form);
  },
  setPrimaryImage: (productId: string, imageId: string) =>
    api<{ message: string }>(`/products/${productId}/images/${imageId}/primary`, { method: 'PATCH' }),
  reorderImages: (productId: string, imageIds: string[]) =>
    api<{ message: string }>(`/products/${productId}/images/reorder`, { method: 'PATCH', body: JSON.stringify({ image_ids: imageIds }) }),
  deleteImage: (productId: string, imageId: string) =>
    api<{ message: string }>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
};

export const reviewApi = {
  listByProduct: (productId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<ProductReviewWithMeta[]>(`/products/${productId}/reviews${q ? `?${q}` : ''}`);
  },
  create: (productId: string, body: { rating: number; title?: string; body?: string }) =>
    api<ProductReviewWithMeta>(`/products/${productId}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<ProductReviewWithMeta>(`/reviews/${id}`),
  update: (id: string, body: { rating?: number; title?: string; body?: string }) =>
    api<ProductReviewWithMeta>(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<{ message: string }>(`/reviews/${id}`, { method: 'DELETE' }),
  like: (id: string) => api<{ message: string }>(`/reviews/${id}/like`, { method: 'POST' }),
  unlike: (id: string) => api<{ message: string }>(`/reviews/${id}/like`, { method: 'DELETE' }),
  listComments: (reviewId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<ReviewComment[]>(`/reviews/${reviewId}/comments${q ? `?${q}` : ''}`);
  },
  createComment: (reviewId: string, body: string, parentId?: string) =>
    api<ReviewComment>(`/reviews/${reviewId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parentId || undefined }),
    }),
  deleteComment: (id: string) => api<{ message: string }>(`/comments/${id}`, { method: 'DELETE' }),
};

/** Inventory batch (batch/lot with expiry). Product may be preloaded when listing by pharmacy. */
export interface InventoryBatch {
  id: string;
  product_id: string;
  pharmacy_id: string;
  batch_number: string;
  quantity: number;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
  product?: { id: string; name: string };
}

export const inventoryApi = {
  listBatchesByPharmacy: () => api<InventoryBatch[]>('/inventory/batches'),
  listExpiringSoon: (days?: number) =>
    api<InventoryBatch[]>(`/inventory/expiring${days != null ? `?days=${days}` : ''}`),
  getBatch: (batchId: string) => api<InventoryBatch>(`/inventory/batches/${batchId}`),
  updateBatch: (batchId: string, body: { quantity?: number; expiry_date?: string | null }) =>
    api<InventoryBatch>(`/inventory/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBatch: (batchId: string) => api<{ message: string }>(`/inventory/batches/${batchId}`, { method: 'DELETE' }),
  addBatch: (productId: string, body: { batch_number: string; quantity: number; expiry_date?: string | null }) =>
    api<InventoryBatch>(`/products/${productId}/batches`, { method: 'POST', body: JSON.stringify(body) }),
};

/** Valid order statuses and allowed next statuses for transitions */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'ready',
  'completed',
  'cancelled',
] as const;

export const ORDER_NEXT_STATUS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const orderApi = {
  list: (params?: { status?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Order[]>(`/orders${q ? `?${q}` : ''}`);
  },
  get: (id: string) => api<Order>(`/orders/${id}`),
  create: (body: CreateOrderBody) => api<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  accept: (id: string) => api<Order>(`/orders/${id}/accept`, { method: 'POST' }),
  updateStatus: (id: string, status: string) =>
    api<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const paymentApi = {
  list: () => api<Payment[]>('/payments'),
  listByOrder: (orderId: string) => api<Payment[]>(`/orders/${orderId}/payments`),
  get: (id: string) => api<Payment>(`/payments/${id}`),
  create: (body: Partial<Payment>) => api<Payment>('/payments', { method: 'POST', body: JSON.stringify(body) }),
  complete: (id: string) => api<{ message: string }>(`/payments/${id}/complete`, { method: 'POST' }),
};

export interface ActivityLog {
  id: string;
  pharmacy_id: string;
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
  user?: { id: string; email: string; name: string };
}

export const activityApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<ActivityLog[]>(`/activity${q ? `?${q}` : ''}`);
  },
};

export interface Notification {
  id: string;
  pharmacy_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read_at?: string | null;
  created_at: string;
}

/** Admin: list/create/update/delete promos (offers, announcements, events). */
export const promoApi = {
  list: (params?: { type?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Promo[]>(`/promos${q ? `?${q}` : ''}`);
  },
  get: (id: string) => api<Promo>(`/promos/${id}`),
  create: (body: Partial<Promo> & { type: string; title: string }) =>
    api<Promo>('/promos', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Promo>) =>
    api<Promo>(`/promos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    api<{ message: string }>(`/promos/${id}`, { method: 'DELETE' }),
};

export const notificationApi = {
  list: (params?: { limit?: number; offset?: number; unread_only?: boolean }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<Notification[]>(`/notifications${q ? `?${q}` : ''}`);
  },
  countUnread: () => api<{ count: number }>('/notifications/unread/count'),
  markRead: (id: string) =>
    api<{ message: string }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    api<{ message: string }>('/notifications/read-all', { method: 'POST' }),
};

export interface User {
  id: string;
  pharmacy_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

/** Staff CRUD: list/create/get/update/deactivate (admin: all roles; manager: pharmacists only). */
export const usersApi = {
  list: () => api<User[]>('/users'),
  create: (body: { email: string; password: string; name?: string; role: string }) =>
    api<User>('/users', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<User>(`/users/${id}`),
  update: (id: string, body: { name?: string; role?: string; is_active?: boolean }) =>
    api<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivate: (id: string) => api<User>(`/users/${id}/deactivate`, { method: 'PATCH' }),
};

export type ShiftType = 'morning' | 'evening' | 'full';

export interface DutyRoster {
  id: string;
  pharmacy_id: string;
  user_id: string;
  date: string;
  shift_type: ShiftType;
  notes: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export const dutyRosterApi = {
  list: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<DutyRoster[]>(`/duty-roster${q ? `?${q}` : ''}`);
  },
  create: (body: { user_id: string; date: string; shift_type: ShiftType; notes?: string }) =>
    api<DutyRoster>('/duty-roster', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<DutyRoster>(`/duty-roster/${id}`),
  update: (id: string, body: { user_id?: string; date?: string; shift_type?: ShiftType; notes?: string }) =>
    api<DutyRoster>(`/duty-roster/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<void>(`/duty-roster/${id}`, { method: 'DELETE' }),
};

export type DailyLogStatus = 'open' | 'done';

export interface DailyLog {
  id: string;
  pharmacy_id: string;
  date: string;
  title: string;
  description: string;
  status: DailyLogStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: User;
}

export const dailyLogsApi = {
  list: (params?: { date?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<DailyLog[]>(`/daily-logs${q ? `?${q}` : ''}`);
  },
  create: (body: { date: string; title: string; description?: string }) =>
    api<DailyLog>('/daily-logs', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<DailyLog>(`/daily-logs/${id}`),
  update: (id: string, body: { title?: string; description?: string; status?: DailyLogStatus }) =>
    api<DailyLog>(`/daily-logs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => api<void>(`/daily-logs/${id}`, { method: 'DELETE' }),
};

export interface Pharmacy {
  id: string;
  name: string;
  license_no: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface PharmacyConfig {
  id: string;
  pharmacy_id: string;
  display_name: string;
  location: string;
  logo_url: string;
  banner_url: string;
  tagline: string;
  contact_phone: string;
  contact_email: string;
  primary_color: string;
  license_no?: string;
  verified_at?: string | null;
  established_year?: number;
  return_refund_policy?: string | null;
  chat_edit_window_minutes?: number;
  created_at: string;
  updated_at: string;
}

/** Offer, announcement, or event shown on the public store (ads-style). */
export interface Promo {
  id: string;
  pharmacy_id: string;
  type: 'offer' | 'announcement' | 'event';
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  start_at: string | null;
  end_at: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

/** Product review (rating + feedback) with like/comment counts */
export interface ProductReviewWithMeta {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  user?: { id: string; name: string; email: string };
  like_count?: number;
  user_liked?: boolean;
  comment_count?: number;
}

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  user?: { id: string; name: string; email: string };
}

/** Category with optional parent (for product type = category + subcategory). */
export interface ProductCategoryDetail {
  id: string;
  name: string;
  parent?: { id: string; name: string } | null;
}

export interface Product {
  id: string;
  pharmacy_id: string;
  name: string;
  description?: string;
  sku: string;
  category: string;
  category_id?: string | null;
  category_detail?: ProductCategoryDetail | null;
  unit_price: number;
  /** 0–100; when > 0, unit_price is sale price. Shown as "X% off" on cards. */
  discount_percent?: number;
  currency: string;
  stock_quantity: number;
  unit: string;
  requires_rx: boolean;
  is_active: boolean;
  expiry_date?: string | null;
  manufacturing_date?: string | null;
  brand?: string;
  barcode?: string;
  storage_conditions?: string;
  dosage_form?: string;
  pack_size?: string;
  generic_name?: string;
  hashtags?: string[];
  labels?: Record<string, string>;
  created_at: string;
  images?: ProductImage[];
  /** Aggregate rating (1–5) when returned from catalog listing */
  rating_avg?: number;
  /** Number of reviews when returned from catalog listing */
  review_count?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Order {
  id: string;
  pharmacy_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  sub_total: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  currency: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
}

export interface CreateOrderBody {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  notes?: string;
  discount_amount?: number;
  promo_code?: string;
  referral_code?: string;
  points_to_redeem?: number;
  /** Optional: selected payment gateway ID for mock payment (e.g. eSewa, Khalti, QR, COD, Fonepay). */
  payment_gateway_id?: string;
}

/** Discount code (pharmacy-scoped) for billing and checkout. */
export interface PromoCode {
  id: string;
  pharmacy_id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  first_order_only: boolean;
  created_at: string;
  updated_at: string;
}

/** Result of validating a promo code (auth required). */
export interface PromoCodeValidateResult {
  discount_amount: number;
  promo_code_id: string;
}

export const promoCodeApi = {
  /** Validate promo code for current pharmacy and sub_total. Auth required. */
  validate: (code: string, sub_total: number) =>
    api<PromoCodeValidateResult>('/promo-codes/validate', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim(), sub_total }),
    }),
  list: () => api<PromoCode[]>('/promo-codes'),
  get: (id: string) => api<PromoCode>(`/promo-codes/${id}`),
  create: (body: Partial<PromoCode> & { code: string; discount_type: string; discount_value: number; valid_from: string; valid_until: string }) =>
    api<PromoCode>('/promo-codes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<PromoCode>) =>
    api<PromoCode>(`/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

/** Referral & points (public validate; auth for config and customers) */
export interface ReferralCodeValidateResult {
  valid: boolean;
  message?: string;
  name?: string;
}

export interface ReferralPointsConfig {
  id: string;
  pharmacy_id: string;
  points_per_currency_unit: number;
  currency_unit_for_points: number;
  referral_reward_points: number;
  redemption_rate_points: number;
  redemption_rate_currency: number;
  max_redeem_points_per_order: number;
  created_at: string;
  updated_at: string;
}

export interface RedeemPointsResult {
  discount_amount: number;
  points_redeemed: number;
  max_redeemable: number;
  points_balance: number;
}

export interface Customer {
  id: string;
  pharmacy_id: string;
  name: string;
  phone: string;
  email: string;
  referral_code: string;
  points_balance: number;
  referred_by_id?: string;
  created_at: string;
  updated_at: string;
  /** Present when customer has an active membership (from GET /customers/by-phone). */
  membership?: { id: string; name: string };
}

export interface PointsTransaction {
  id: string;
  customer_id: string;
  amount: number;
  type: 'earn_purchase' | 'earn_referral' | 'redeem';
  order_id?: string;
  referral_customer_id?: string;
  created_at: string;
}

export const referralApi = {
  /** Public: validate referral code for a pharmacy. */
  validateReferralCode: (pharmacyId: string, code: string) =>
    api<ReferralCodeValidateResult>(`/public/pharmacies/${pharmacyId}/referral/validate?code=${encodeURIComponent(code.trim())}`),
  getConfig: () => api<ReferralPointsConfig>('/referral/config'),
  upsertConfig: (body: Partial<ReferralPointsConfig>) =>
    api<ReferralPointsConfig>('/referral/config', { method: 'PUT', body: JSON.stringify(body) }),
  listCustomers: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<{ items: Customer[]; total: number }>(`/customers${q ? `?${q}` : ''}`);
  },
  getCustomerByPhone: (phone: string) =>
    api<Customer>(`/customers/by-phone?phone=${encodeURIComponent(phone)}`),
  listPointsTransactions: (customerId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<PointsTransaction[]>(`/customers/${customerId}/points${q ? `?${q}` : ''}`);
  },
  redeemPreview: (params: { customer_id: string; points_to_redeem?: number; sub_total?: number }) => {
    const p = new URLSearchParams({ customer_id: params.customer_id });
    if (params.points_to_redeem != null) p.set('points_to_redeem', String(params.points_to_redeem));
    if (params.sub_total != null) p.set('sub_total', String(params.sub_total));
    return api<RedeemPointsResult>(`/referral/redeem-preview?${p.toString()}`);
  },
};

export interface Payment {
  id: string;
  order_id: string;
  pharmacy_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string;
  paid_at?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  pharmacy_id: string;
  order_id: string;
  invoice_number: string;
  status: 'draft' | 'issued';
  issued_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceView {
  invoice: Invoice;
  order: Order;
  payments: Payment[];
}

// --- Chat ---
export interface Conversation {
  id: string;
  pharmacy_id: string;
  customer_id?: string;
  user_id?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  pharmacy?: Pharmacy;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'customer';
  sender_id: string;
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatConversationsResponse {
  items: Conversation[];
  total: number;
}

export interface ChatMessagesResponse {
  items: ChatMessage[];
  total: number;
}

export const chatApi = {
  listConversations: (params?: { limit?: number; offset?: number }) => {
    const q = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiChat<ChatConversationsResponse>(`/chat/conversations${q ? `?${q}` : ''}`);
  },
  createConversation: (customerId: string) =>
    apiChat<Conversation>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId }),
    }),
  getConversation: (id: string) => apiChat<Conversation>(`/chat/conversations/${id}`),
  getMyConversation: () => apiChat<Conversation>('/chat/me'),
  listMessages: (id: string, params?: { limit?: number; offset?: number }) => {
    const q = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiChat<ChatMessagesResponse>(`/chat/conversations/${id}/messages${q ? `?${q}` : ''}`);
  },
  sendMessage: (
    conversationId: string,
    body: {
      body?: string;
      attachment_url?: string;
      attachment_name?: string;
      attachment_type?: string;
    }
  ) =>
    apiChat<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  issueCustomerToken: (customerId: string) =>
    apiChat<{ token: string }>('/chat/customer-token', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId }),
    }),
  upload: (formData: FormData) => apiChatUpload<{ url: string; path: string; filename: string }>('/chat/upload', formData),
  getSettings: () => apiChat<{ chat_edit_window_minutes: number }>('/chat/settings'),
  editMessage: (conversationId: string, messageId: string, body: string) =>
    apiChat<ChatMessage>(`/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  deleteMessage: (conversationId: string, messageId: string) =>
    apiChat<void>(`/chat/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' }),
  deleteConversation: (conversationId: string) =>
    apiChat<void>(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),
};

export const invoiceApi = {
  list: () => api<Invoice[]>('/invoices'),
  get: (id: string) => api<InvoiceView>(`/invoices/${id}`),
  createFromOrder: (orderId: string) =>
    api<Invoice>(`/orders/${orderId}/invoices`, { method: 'POST' }),
  issue: (id: string) =>
    api<Invoice>(`/invoices/${id}/issue`, { method: 'POST' }),
};
