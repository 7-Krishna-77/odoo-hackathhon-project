import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';

export default function AddProductModal({ categories, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', sku: '', category_id: '', unit_of_measure: 'unit' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { product } = await api.createProduct(form);
      onCreated(product);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="glass-panel w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Add Product</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Product Name</label>
            <input
              required
              className="input-field"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Steel Rods"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">SKU</label>
            <input
              required
              className="input-field font-mono"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="e.g. RM-STEEL-002"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category</label>
            <select
              className="input-field"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Unit of Measure</label>
            <input
              className="input-field"
              value={form.unit_of_measure}
              onChange={(e) => setForm((f) => ({ ...f, unit_of_measure: e.target.value }))}
              placeholder="e.g. kg, unit, box"
            />
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg bg-crimson-soft text-crimson-bad border border-crimson-bad/30">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
