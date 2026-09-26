import { supabase } from './supabaseClient.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return payload;
}

export const api = {
  // Dashboard
  getKpis: () => request('/dashboard/kpis'),
  getActivity: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/activity${qs ? `?${qs}` : ''}`);
  },

  // Products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  createProduct: (product) => request('/products', { method: 'POST', body: product }),
  getCategories: () => request('/products/categories'),
  getLocations: () => request('/products/locations'),

  // Operations / Ledger
  getLedgerDocuments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/operations/ledger${qs ? `?${qs}` : ''}`);
  },
  createLedgerDocument: (doc) => request('/operations/ledger', { method: 'POST', body: doc }),
  updateLedgerStatus: (id, status) =>
    request(`/operations/ledger/${id}/status`, { method: 'PUT', body: { status } }),
  validateLedgerDocument: (id) =>
    request(`/operations/ledger/${id}/validate`, { method: 'PUT' }),
};
