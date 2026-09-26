import { useEffect, useState } from 'react';
import { Search, Plus, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import { StockLevelPill } from '../components/StatusPill.jsx';
import AddProductModal from '../components/AddProductModal.jsx';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await api.getProducts({
        ...(search && { search }),
        ...(categoryFilter && { category_id: categoryFilter }),
      });
      setProducts(res.products || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.getCategories().then((r) => setCategories(r.categories || []));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 250); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Product Catalog</h2>
          <p className="text-sm text-slate-500">{products.length} products tracked across all locations</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="glass-panel p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-52"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wide border-b border-panel-border">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Total Qty</th>
                <th className="px-5 py-3 font-medium">By Location</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-panel-border/50 hover:bg-white/5 transition align-top">
                  <td className="px-5 py-3 text-white font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{p.sku}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{p.category?.name || 'Uncategorized'}</td>
                  <td className="px-5 py-3"><StockLevelPill quantity={p.totalQuantity} /></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {p.byLocation.length === 0 && <span className="text-slate-600 text-xs">No stock recorded</span>}
                      {p.byLocation.map((loc) => (
                        <span key={loc.locationId} className="inline-flex items-center gap-1 text-xs bg-white/5 border border-panel-border rounded-lg px-2 py-1 text-slate-300">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {loc.locationName}: <span className="font-semibold text-white">{loc.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <AddProductModal
          categories={categories}
          onClose={() => setModalOpen(false)}
          onCreated={() => loadProducts()}
        />
      )}
    </div>
  );
}
