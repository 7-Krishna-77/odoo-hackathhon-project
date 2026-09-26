import { useEffect, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export default function InternalMoves() {
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function loadAll() {
    const [locRes, prodRes, docRes] = await Promise.all([
      api.getLocations(),
      api.getProducts(),
      api.getLedgerDocuments({ document_type: 'Internal' }),
    ]);
    setLocations(locRes.locations || []);
    setProducts(prodRes.products || []);
    setDocuments(docRes.documents || []);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleCreateAndValidate(e) {
    e.preventDefault();
    if (source === destination) {
      setError('Source and destination must be different locations.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { ledger } = await api.createLedgerDocument({
        document_type: 'Internal',
        source_location_id: source,
        destination_location_id: destination,
        items: items.filter((it) => it.product_id),
      });
      await api.validateLedgerDocument(ledger.id);
      setItems([{ product_id: '', quantity: 1 }]);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-indigo-accent" /> Internal Transfers
        </h2>
        <p className="text-sm text-slate-500">Move stock between two locations in one step.</p>
      </div>

      <form onSubmit={handleCreateAndValidate} className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="max-w-xs flex-1">
            <label className="text-xs text-slate-500 mb-1 block">From</label>
            <select required className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Select source…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="max-w-xs flex-1">
            <label className="text-xs text-slate-500 mb-1 block">To</label>
            <select required className="input-field" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Select destination…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <LineItemsEditor items={items} onChange={setItems} products={products} />

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-crimson-soft text-crimson-bad border border-crimson-bad/30">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 text-sm">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Post Transfer (Done)
        </button>
      </form>

      <div className="glass-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-panel-border">
          <h3 className="text-white font-semibold text-sm">Recent Transfers</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-panel-border/50">
                <td className="px-5 py-3 font-mono text-xs text-slate-300">{doc.reference}</td>
                <td className="px-5 py-3 text-xs text-slate-400">
                  {doc.source?.name} <span className="text-slate-600">→</span> {doc.destination?.name}
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{doc.ledger_items?.length || 0} lines</td>
                <td className="px-5 py-3"><StatusPill status={doc.status} /></td>
                <td className="px-5 py-3 text-xs text-slate-500">{new Date(doc.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td className="px-5 py-6 text-center text-slate-500 text-sm">No transfers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
