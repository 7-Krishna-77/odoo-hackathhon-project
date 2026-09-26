import { Plus, Trash2 } from 'lucide-react';

/**
 * items: [{ product_id, quantity, counted_quantity? }]
 * mode 'adjustment' shows a "System Qty" (read-only, resolved from products)
 * and a "Counted Qty" input, computing live variance.
 */
export default function LineItemsEditor({ items, onChange, products, mode = 'standard' }) {
  function updateItem(index, patch) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  }

  function addItem() {
    onChange([...items, { product_id: '', quantity: 1, counted_quantity: 0 }]);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function systemQtyFor(productId) {
    return products.find((p) => p.id === productId)?.totalQuantity ?? 0;
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const systemQty = mode === 'adjustment' ? systemQtyFor(item.product_id) : null;
        const variance = mode === 'adjustment' ? (item.counted_quantity ?? 0) - systemQty : null;

        return (
          <div key={idx} className="flex flex-wrap items-end gap-3 bg-white/5 border border-panel-border rounded-xl p-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] text-slate-500">Product</label>
              <select
                required
                className="input-field"
                value={item.product_id}
                onChange={(e) => updateItem(idx, { product_id: e.target.value })}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            {mode !== 'adjustment' && (
              <div className="w-28">
                <label className="text-[11px] text-slate-500">Quantity</label>
                <input
                  required
                  type="number"
                  min={1}
                  className="input-field"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                />
              </div>
            )}

            {mode === 'adjustment' && (
              <>
                <div className="w-28">
                  <label className="text-[11px] text-slate-500">System Qty</label>
                  <div className="input-field bg-white/0 text-slate-400">{systemQty}</div>
                </div>
                <div className="w-28">
                  <label className="text-[11px] text-slate-500">Counted Qty</label>
                  <input
                    required
                    type="number"
                    min={0}
                    className="input-field"
                    value={item.counted_quantity}
                    onChange={(e) => updateItem(idx, { counted_quantity: Number(e.target.value), quantity: 1 })}
                  />
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-slate-500">Variance</label>
                  <div
                    className={`input-field bg-white/0 font-semibold ${
                      variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-pill' : 'text-crimson-bad'
                    }`}
                  >
                    {variance > 0 ? `+${variance}` : variance}
                  </div>
                </div>
              </>
            )}

            <button type="button" onClick={() => removeItem(idx)} className="text-slate-500 hover:text-crimson-bad p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      <button type="button" onClick={addItem} className="btn-ghost text-sm flex items-center gap-2">
        <Plus className="w-4 h-4" /> Add Line
      </button>
    </div>
  );
}
